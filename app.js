/* 자유복의 날 — 육민관중학교
 * 자유복 입는 날을 저장하고 D-day로 알려주는 웹앱.
 * 데이터는 localStorage 에만 저장됩니다. */

const STORAGE_KEY = 'jayubok-dates';
const SCHOOL_SCHEDULE_URL = 'https://ymk.gwe.ms.kr/main.do';

// ---- 상태 ----
let dates = loadDates();           // ['YYYY-MM-DD', ...] 정렬·중복 제거됨
let viewYear, viewMonth;           // 달력에 보이는 연/월 (month: 0~11)

// ---- 유틸 ----
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
function daysBetween(fromISO, toISOstr) {
  const ms = parseISO(toISOstr) - parseISO(fromISO);
  return Math.round(ms / 86400000);
}
function ddayLabel(diff) {
  if (diff === 0) return 'D-DAY';
  if (diff > 0) return `D-${diff}`;
  return `D+${-diff}`;
}
function fmtKorean(iso) {
  const d = parseISO(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${wd})`;
}

// ---- 저장/불러오기 ----
function loadDates() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return normalize(raw);
  } catch {
    return [];
  }
}
function saveDates() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dates));
}
function normalize(arr) {
  return [...new Set(arr.filter(Boolean))].sort();
}
function addDate(iso) {
  if (!iso || dates.includes(iso)) return false;
  dates = normalize([...dates, iso]);
  saveDates();
  renderAll();
  return true;
}
function removeDate(iso) {
  dates = dates.filter(d => d !== iso);
  saveDates();
  renderAll();
}

// ---- 렌더링 ----
function renderHero() {
  const today = todayStr();
  const upcoming = dates.filter(d => d >= today);
  const heroDday = document.getElementById('heroDday');
  const heroDate = document.getElementById('heroDate');
  if (upcoming.length === 0) {
    heroDday.textContent = '—';
    heroDate.textContent = dates.length
      ? '예정된 자유복의 날이 없어요'
      : '아래에서 날짜를 추가해 주세요';
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
    if (dates.includes(iso)) cell.classList.add('free');
    if (iso === today) cell.classList.add('today');

    const span = document.createElement('span');
    span.textContent = day;
    if (!cell.classList.contains('free')) {
      if (dow === 0) span.className = 'sunc';
      else if (dow === 6) span.className = 'satc';
    }
    cell.appendChild(span);

    cell.title = dates.includes(iso) ? '자유복의 날 (눌러서 해제)' : '눌러서 자유복의 날로 지정';
    cell.addEventListener('click', () => {
      if (dates.includes(iso)) removeDate(iso);
      else addDate(iso);
    });
    body.appendChild(cell);
  }
}

function renderList() {
  const list = document.getElementById('dateList');
  const hint = document.getElementById('emptyHint');
  list.innerHTML = '';
  hint.classList.toggle('hidden', dates.length > 0);

  const today = todayStr();
  for (const iso of dates) {
    const li = document.createElement('li');
    const diff = daysBetween(today, iso);
    if (diff < 0) li.classList.add('past');

    const left = document.createElement('div');
    const main = document.createElement('span');
    main.className = 'd-main';
    main.textContent = fmtKorean(iso);
    left.appendChild(main);

    if (diff >= 0) {
      const dd = document.createElement('span');
      dd.className = 'd-dday';
      dd.textContent = ddayLabel(diff);
      left.appendChild(dd);
    } else {
      const sub = document.createElement('span');
      sub.className = 'd-sub';
      sub.textContent = '지남';
      left.appendChild(sub);
    }

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.textContent = '삭제';
    del.addEventListener('click', () => removeDate(iso));

    li.appendChild(left);
    li.appendChild(del);
    list.appendChild(li);
  }
}

function renderAll() {
  renderHero();
  renderCalendar();
  renderList();
}

// ---- 월중교육활동 텍스트 파싱 ----
// 붙여넣은 일정 텍스트에서 "자유복" 이 들어간 부분의 날짜를 추출한다.
function parseFreeDressDates(text, baseYear, baseMonth) {
  const found = new Set();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.includes('자유복')) continue;

    // 1) M월 D일  또는  M/D  또는  M.D  형태 (월 포함)
    let m = line.match(/(\d{1,2})\s*[월./]\s*(\d{1,2})\s*일?/);
    if (m) {
      const mm = +m[1], dd = +m[2];
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        found.add(toISO(baseYear, mm, dd));
        continue;
      }
    }
    // 2) "D일" 형태 (기준 월 사용)
    m = line.match(/(\d{1,2})\s*일/);
    if (m) {
      const dd = +m[1];
      if (dd >= 1 && dd <= 31) { found.add(toISO(baseYear, baseMonth, dd)); continue; }
    }
    // 3) 줄 안의 단독 숫자 (1~31) — 기준 월 사용
    const nums = line.match(/\d{1,2}/g);
    if (nums) {
      const dd = +nums.find(n => +n >= 1 && +n <= 31);
      if (dd) found.add(toISO(baseYear, baseMonth, dd));
    }
  }
  return [...found].sort();
}

function renderParseResult(results) {
  const box = document.getElementById('parseResult');
  box.innerHTML = '';
  if (results.length === 0) {
    box.innerHTML = '<p class="parse-none">“자유복”이 들어간 날짜를 찾지 못했어요. 기준 연·월이 맞는지 확인하거나 직접 추가해 주세요.</p>';
    return;
  }
  const wrap = document.createElement('div');
  wrap.className = 'parse-found';
  wrap.innerHTML = '<h3>찾은 자유복 날짜</h3>';

  const checks = [];
  for (const iso of results) {
    const row = document.createElement('div');
    row.className = 'parse-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.id = 'pi-' + iso;
    const label = document.createElement('label');
    label.htmlFor = cb.id;
    label.textContent = fmtKorean(iso) + (dates.includes(iso) ? ' (이미 저장됨)' : '');
    row.appendChild(cb);
    row.appendChild(label);
    wrap.appendChild(row);
    checks.push({ iso, cb });
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-block';
  addBtn.style.marginTop = '10px';
  addBtn.textContent = '선택한 날짜 저장';
  addBtn.addEventListener('click', () => {
    let n = 0;
    checks.forEach(({ iso, cb }) => { if (cb.checked && addDate(iso)) n++; });
    box.innerHTML = `<p class="parse-none">${n}개의 날짜를 저장했어요.</p>`;
  });
  wrap.appendChild(addBtn);
  box.appendChild(wrap);
}

// ---- 이벤트 연결 ----
function init() {
  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  document.getElementById('schoolLink').href = SCHOOL_SCHEDULE_URL;

  // 기준 연·월 기본값 = 이번 달
  document.getElementById('parseMonth').value =
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;

  document.getElementById('prevMonth').addEventListener('click', () => {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  document.getElementById('addManual').addEventListener('click', () => {
    const input = document.getElementById('manualDate');
    if (input.value) { addDate(input.value); input.value = ''; }
  });

  document.getElementById('parseBtn').addEventListener('click', () => {
    const text = document.getElementById('parseInput').value;
    const ym = document.getElementById('parseMonth').value; // YYYY-MM
    if (!ym) { alert('기준 연·월을 선택해 주세요.'); return; }
    const [by, bm] = ym.split('-').map(Number);
    renderParseResult(parseFreeDressDates(text, by, bm));
  });

  document.getElementById('clearAll').addEventListener('click', () => {
    if (dates.length && confirm('저장된 모든 자유복 날짜를 삭제할까요?')) {
      dates = [];
      saveDates();
      renderAll();
    }
  });

  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

// ---- PWA: 서비스 워커 등록 + 설치 버튼 ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const card = document.getElementById('installCard');
  if (card) card.hidden = false;
});
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('installBtn');
  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('installCard').hidden = true;
    });
  }
});
window.addEventListener('appinstalled', () => {
  const card = document.getElementById('installCard');
  if (card) card.hidden = true;
});
