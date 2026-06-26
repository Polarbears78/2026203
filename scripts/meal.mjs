/* 육민관중학교 급식 식단을 NEIS 급식정보 OpenAPI에서 받아 menu.json 으로 저장.
 * 인증키 없이 동작(키리스). GitHub Actions(서버사이드)에서 실행. */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const ATPT = 'K10';          // 강원특별자치도교육청
const SCHUL = '7822141';     // 육민관중학교
const ENDPOINT = 'https://open.neis.go.kr/hub/mealServiceDietInfo';
const SOURCE = 'https://ymk.gwe.ms.kr/';

function ymd(d) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// "흑미밥 <br/>쇠고기미역국 (5.6.16)<br/>..." → ['흑미밥','쇠고기미역국', ...]
function parseDishes(s) {
  return (s || '')
    .split(/<br\s*\/?>/i)
    .map((x) => x.replace(/\s*\([0-9.\s]+\)/g, '').replace(/ /g, ' ').trim())
    .filter(Boolean);
}

async function main() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0); // 다음 달 말일까지

  const url = `${ENDPOINT}?Type=json&pIndex=1&pSize=300` +
    `&ATPT_OFCDC_SC_CODE=${ATPT}&SD_SCHUL_CODE=${SCHUL}` +
    `&MLSV_FROM_YMD=${ymd(from)}&MLSV_TO_YMD=${ymd(to)}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();

  const info = data.mealServiceDietInfo;
  const rows = info && info[1] && info[1].row ? info[1].row : [];
  if (!rows.length) {
    console.warn('급식 데이터가 없습니다. 기존 menu.json 유지.');
    if (existsSync('menu.json')) {
      const prev = JSON.parse(readFileSync('menu.json', 'utf8'));
      prev.updatedAt = new Date().toISOString();
      writeFileSync('menu.json', JSON.stringify(prev, null, 2) + '\n');
    }
    return;
  }

  const meals = rows.map((r) => {
    const y = r.MLSV_YMD.slice(0, 4), m = r.MLSV_YMD.slice(4, 6), d = r.MLSV_YMD.slice(6, 8);
    const kcalMatch = (r.CAL_INFO || '').match(/[\d.]+/);
    return {
      date: iso(+y, +m, +d),
      type: r.MMEAL_SC_NM || '중식',
      dishes: parseDishes(r.DDISH_NM),
      kcal: kcalMatch ? kcalMatch[0] : null,
    };
  }).sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));

  const out = {
    school: '육민관중학교',
    source: SOURCE,
    updatedAt: new Date().toISOString(),
    meals,
  };
  writeFileSync('menu.json', JSON.stringify(out, null, 2) + '\n');
  console.log(`menu.json 저장: ${meals.length}일치 급식`);
  for (const mm of meals.slice(0, 3)) console.log(`  ${mm.date} (${mm.type}) ${mm.dishes.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
