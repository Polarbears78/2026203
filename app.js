/* 자유복의 날 — 육민관중학교 (자동 표시 전용)
 * data.json(매일 자동 갱신)을 읽어 다음 자유복의 날 D-day, 달력, 목록을 보여준다. */

let dates = [];          // ['YYYY-MM-DD', ...]
let titles = {};         // 'YYYY-MM-DD' -> title
let viewYear, viewMonth; // 달력에 보이는 연/월(month 0~11)

// ---- 날짜 유틸 ----
function todayStr() {
  const d = new Date();
  return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
function toISO(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
function ddayLabel(diff) {
  if (diff === 0) return 'D-DAY';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}
function fmtKorean(iso) {
  const d = parseISO(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

// ---- 렌더링 ----
function renderHero() {
  const today = todayStr();
  const upcoming = dates.filter((d) => d >= today);
  const heroDday = document.getElementById('heroDday');
  const heroDate = document.getElementById('heroDate');
  if (upcoming.length === 0) {
    heroDday.textContent = '—';
    heroDate.textContent = dates.length ? '예정된 자유복의 날이 없어요' : '표시할 날짜가 없어요';
    return;
  }
  const next = upcoming[0];
  heroDday.textContent = ddayLabel(daysBetween(today, next));
  heroDate.textContent = fmtKorean(next);
}

function renderCalendar() {
  document.getElementById('calTitle').textContent = `${viewYear}년 ${viewMonth + 1}월`;
  const body = document.getElementById('calBody');
  body.innerHTML = '';

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayStr();

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    body.appendChild(cell);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toISO(viewYear, viewMonth + 1, day);
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    const dow = new Date(viewYear, viewMonth, day).getDay();
    if (dates.includes(iso)) {
      cell.classList.add('free');
      cell.title = titles[iso] || '자유복 입는 날';
    }
    if (iso === today) cell.classList.add('today');

    const span = document.createElement('span');
    span.textContent = day;
    if (!cell.classList.contains('free')) {
      if (dow === 0) span.className = 'sunc';
      else if (dow === 6) span.className = 'satc';
    }
    cell.appendChild(span);
    body.appendChild(cell);
  }
}

function renderList() {
  const list = document.getElementById('dateList');
  const hint = document.getElementById('emptyHint');
  list.innerHTML = '';
  const today = todayStr();
  const shown = dates.filter((d) => d >= today);          // 다가오는 날짜 우선
  const source = shown.length ? shown : dates.slice(-5);   // 없으면 최근 지난 날짜
  hint.classList.toggle('hidden', source.length > 0);

  for (const iso of source) {
    const li = document.createElement('li');
    const diff = daysBetween(today, iso);
    if (diff < 0) li.classList.add('past');

    const left = document.createElement('div');
    const main = document.createElement('span');
    main.className = 'd-main';
    main.textContent = fmtKorean(iso);
    left.appendChild(main);

    const tag = document.createElement('span');
    tag.className = 'd-sub';
    tag.textContent = titles[iso] || '자유복 입는 날';
    left.appendChild(tag);

    const dd = document.createElement('span');
    dd.className = diff >= 0 ? 'd-dday' : 'd-sub';
    dd.textContent = diff >= 0 ? ddayLabel(diff) : '지남';

    li.appendChild(left);
    li.appendChild(dd);
    list.appendChild(li);
  }
}

function renderAll() {
  renderHero();
  // 달력 기본 위치: 다가오는 자유복의 날이 있으면 그 달, 없으면 이번 달
  const today = todayStr();
  const next = dates.find((d) => d >= today) || dates[dates.length - 1];
  const base = next ? parseISO(next) : new Date();
  if (viewYear === undefined) {
    viewYear = base.getFullYear();
    viewMonth = base.getMonth();
  }
  renderCalendar();
  renderList();
}

function setStatus(text) {
  document.getElementById('statusLine').textContent = text;
}

// ---- 데이터 로드 ----
async function loadData() {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('data.json ' + res.status);
    const data = await res.json();
    dates = (data.dates || []).map((x) => x.date).filter(Boolean).sort();
    titles = {};
    (data.dates || []).forEach((x) => { if (x.date) titles[x.date] = x.title || '자유복 입는 날'; });

    if (data.source) {
      document.getElementById('sourceLink').href = data.source;
    }
    if (data.updatedAt) {
      const u = new Date(data.updatedAt);
      const txt = `마지막 자동 확인: ${u.getFullYear()}.${String(u.getMonth() + 1).padStart(2, '0')}.${String(u.getDate()).padStart(2, '0')} ${String(u.getHours()).padStart(2, '0')}:${String(u.getMinutes()).padStart(2, '0')}`;
      setStatus(txt);
      document.getElementById('updatedFoot').textContent = '육민관중학교 · 매일 자동 갱신';
    } else {
      setStatus('데이터를 불러왔습니다. (자동 갱신 대기 중)');
    }
  } catch (e) {
    setStatus('일정을 불러오지 못했어요. 잠시 후 새로고침하거나 아래 링크로 직접 확인해 주세요.');
    document.getElementById('heroDday').textContent = '—';
    document.getElementById('heroDate').textContent = '불러오기 실패';
  }
  renderAll();
}

// ---- 이벤트 ----
function init() {
  document.getElementById('prevMonth').addEventListener('click', () => {
    if (--viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    if (++viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });
  loadData();
}

document.addEventListener('DOMContentLoaded', init);

// ---- PWA: 서비스 워커 등록 ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
