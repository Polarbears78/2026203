/* 육민관중학교 월중교육활동(일정)에서 "자유복" 날짜를 자동 추출해 data.json 으로 저장.
 * GitHub Actions 러너(서버사이드)에서 실행되므로 CORS·봇차단의 영향을 받지 않는다.
 *
 * 동작:
 *  1) schedule/list.do 에 schdYear/schdMonth 를 POST 하여 해당 월 달력 HTML을 받는다.
 *  2) "자유복" 이 포함된 일정의 seq 를 추출한다.
 *  3) schedule/view.do?seq=... 상세에서 정확한 날짜(YYYY/MM/DD)를 읽는다.
 *  4) 이번 달부터 몇 개월치를 모아 data.json 으로 저장한다.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const ORIGIN = 'https://ymk.gwe.ms.kr';
const BASE = `${ORIGIN}/schedule`;
const MENU = '0203';                 // 월중교육활동(일정) 게시판 메뉴 코드
const BOARD_ID = '39222';
const SOURCE_URL = `${BASE}/list.do?m=${MENU}`;
const MONTHS_AHEAD = 4;              // 이번 달 포함 향후 N개월 수집

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'User-Agent': UA, ...(options.headers || {}) },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

// 특정 연/월 달력 HTML (폼 POST 로 월 이동)
async function fetchMonthHtml(year, month) {
  const body = new URLSearchParams({
    m: MENU,
    s: 'ymkms',
    boardID: BOARD_ID,
    schdYear: String(year),
    schdMonth: String(month).padStart(2, '0'),
  });
  return fetchText(`${BASE}/list.do?m=${MENU}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

// 달력 HTML 에서 "자유복" 일정의 {seq, title} 목록 추출
function extractFreeDressEvents(html) {
  const out = new Map();
  const re = /viewData\('(\d+)'\)[^>]*>\s*([^<]*)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const seq = m[1];
    const title = m[2].replace(/\s+/g, ' ').trim();
    if (title.includes('자유복')) out.set(seq, title);
  }
  return [...out].map(([seq, title]) => ({ seq, title }));
}

// 일정 상세에서 날짜(YYYY-MM-DD) 추출
async function fetchEventDate(seq) {
  const html = await fetchText(`${BASE}/view.do?seq=${seq}&m=${MENU}`);
  const m = html.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

async function main() {
  const now = new Date();
  const found = new Map(); // date -> title

  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    let events = [];
    try {
      const html = await fetchMonthHtml(year, month);
      events = extractFreeDressEvents(html);
      console.log(`[${year}-${String(month).padStart(2, '0')}] 자유복 일정 ${events.length}건`);
    } catch (e) {
      console.error(`[${year}-${month}] 목록 조회 실패: ${e.message}`);
      continue;
    }
    for (const ev of events) {
      try {
        const date = await fetchEventDate(ev.seq);
        if (date) {
          found.set(date, ev.title || '자유복 입는 날');
          console.log(`  seq=${ev.seq} → ${date} (${ev.title})`);
        } else {
          console.warn(`  seq=${ev.seq} 날짜 추출 실패`);
        }
      } catch (e) {
        console.error(`  seq=${ev.seq} 상세 조회 실패: ${e.message}`);
      }
      await sleep(300); // 서버 부담 최소화
    }
    await sleep(300);
  }

  const dates = [...found.entries()]
    .map(([date, title]) => ({ date, title }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (dates.length === 0) {
    console.warn('자유복 날짜를 찾지 못했습니다. 기존 data.json 을 유지합니다.');
    if (existsSync('data.json')) {
      const prev = JSON.parse(readFileSync('data.json', 'utf8'));
      prev.updatedAt = new Date().toISOString();
      prev.lastCheck = new Date().toISOString();
      writeFileSync('data.json', JSON.stringify(prev, null, 2) + '\n');
    }
    return;
  }

  const data = {
    school: '육민관중학교',
    source: SOURCE_URL,
    updatedAt: new Date().toISOString(),
    dates,
  };
  writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');
  console.log(`data.json 저장: ${dates.length}개 날짜`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
