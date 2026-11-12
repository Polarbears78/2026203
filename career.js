'use strict';
// 자리 선택과 같은 Apps Script 웹 앱을 사용한다. (Code.gs의 careerResponse_)
const CAREER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzewxbmqadjJsrXZxfaMGCWBDS3QOQ2sH2afDfIdoQjWePUaXbuQcEcXnQQijaw9U6p/exec';
const $ = id => document.getElementById(id);
const PERIODS = [['p3', '3교시'], ['p4', '4교시']];
let state = null, adminState = null, busy = false, reading = false, epoch = 0;
const pick = { p3: null, p4: null };
if (location.hash === '#teacher') $('teacher').open = true;

function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function request(data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(data ? CAREER_ENDPOINT : CAREER_ENDPOINT + '?action=career&t=' + Date.now(), data ? {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'career', ...data }), signal: controller.signal, credentials: 'omit', redirect: 'follow'
    } : { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('직업 선택 서버가 아직 준비되지 않았어요. 선생님이 최신 Code.gs를 Apps Script에 저장하고 새 버전으로 재배포해야 합니다.'); }
    if (!result.ok) throw new Error(result.message || '요청을 처리하지 못했어요.');
    if (result.mode !== 'career') throw new Error('직업 선택 서버 업데이트가 필요합니다.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('서버 응답을 확인하지 못했어요. 연결을 확인한 뒤 같은 번호로 다시 눌러 주세요. 이미 확정됐다면 같은 선택이 표시돼요.');
    throw error;
  } finally { clearTimeout(timeout); }
}

const myNum = () => Number($('num').value);
const myPick = () => state?.picks.find(k => k.num === myNum()) || null;
const count = (period, job) => state.picks.filter(k => k[period] === job).length;

function render(next) {
  state = next;
  const mine = state && myPick();
  for (const [period, label] of PERIODS) {
    const box = $(period); box.replaceChildren();
    if (!state) continue;
    const other = period === 'p3' ? 'p4' : 'p3';
    // 그 사이 마감된 직업은 선택에서 뺀다.
    if (pick[period] !== null && count(period, pick[period]) >= state.cap) pick[period] = null;
    state.jobs.forEach((job, j) => {
      const left = state.cap - count(period, j);
      const clash = !state.sameJob && pick[other] === j;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'job' + (left <= 0 ? ' full' : '') + (pick[period] === j ? ' selected' : '') + (clash ? ' other' : '') + (mine && mine[period] === j ? ' mine' : '');
      b.disabled = busy || !state.open || left <= 0 || clash || !!mine;
      b.setAttribute('aria-pressed', String(pick[period] === j));
      b.setAttribute('aria-label', `${label} ${job.name}, ${left <= 0 ? '마감' : '남은 자리 ' + left + '명'}`);
      b.onclick = () => { pick[period] = pick[period] === j ? null : j; render(state); };
      const name = document.createElement('b'); name.textContent = job.name;
      const room = document.createElement('small'); room.textContent = job.room;
      const seats = document.createElement('span'); seats.className = 'left';
      seats.textContent = mine && mine[period] === j ? '내 선택' : left <= 0 ? '마감' : clash ? `${other === 'p3' ? '3' : '4'}교시에 선택함` : `남은 자리 ${left} / ${state.cap}`;
      b.append(name, room, seats); box.append(b);
    });
  }
  const ready = state && pick.p3 !== null && pick.p4 !== null;
  $('submit').disabled = busy || !state || (!mine && (!state.open || !ready));
  $('submit').textContent = mine ? '내 확정 내용 확인' : ready ? `3교시 ${state.jobs[pick.p3].name} · 4교시 ${state.jobs[pick.p4].name} 확정` : '확정하기';
  $('selection').textContent = !state ? '' : mine ? `${mine.num}번은 이미 확정했어요.` : !state.open ? '아직 신청 시간이 아니에요. 선생님이 시작하면 선택할 수 있어요.' : ready ? '아래 버튼을 눌러야 확정돼요.' : '아래에서 3교시 1개, 4교시 1개를 선택하세요.';
  $('result').textContent = mine ? `✅ ${mine.num}번 확정 · 3교시 ${state.jobs[mine.p3].name} / 4교시 ${state.jobs[mine.p4].name}` : '';
  $('progress').textContent = state ? `${state.open ? '신청 진행 중' : '신청 닫힘'} · ${state.picks.length} / ${state.maxNum}명 완료` : '';
  if (state) $('num').max = state.maxNum;
}

async function refresh() {
  if (busy || reading) return;
  reading = true;
  const readEpoch = epoch;
  try {
    const result = await request();
    if (!busy && readEpoch === epoch) { render(result.state); message(state.open ? '최신 신청 현황이에요.' : '신청이 닫혀 있어요.'); }
  } catch (e) { message(e.message, true); } finally { reading = false; }
}
async function run(task, admin = false) {
  if (busy) return;
  busy = true; epoch++;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  message('서버에서 확인하고 있어요…');
  try { await task(); } catch (e) { message(e.message, true); if (admin) $('adminStatus').textContent = e.message; }
  finally {
    busy = false;
    $('refresh').disabled = $('adminLoad').disabled = false;
    render(state); renderAdmin();
  }
}

$('form').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    if (!state) throw new Error('먼저 신청 현황을 불러와 주세요.');
    let result;
    try { result = await request({ action: 'choose', num: myNum(), name: $('name').value.trim(), p3: pick.p3, p4: pick.p4 }); }
    catch (e) { try { render((await request()).state); } catch (_) {} throw e; }
    pick.p3 = pick.p4 = null;
    render(result.state);
    message('확정되었어요. 다시 접속해도 유지돼요.');
  });
});
$('num').oninput = () => render(state);
$('refresh').onclick = refresh;

// ── 선생님 관리 ──
function renderAdmin() {
  const on = !!adminState;
  $('toggle').disabled = $('resetAll').disabled = busy || !on;
  $('download').disabled = busy || !on || !adminState.picks.length;
  if (!on) return;
  $('toggle').textContent = adminState.open ? '신청 마감' : '신청 시작';
  const jobs = adminState.jobs, label = k => `${k.num}번 ${k.name}`;
  const byJob = $('byJob'); byJob.replaceChildren();
  const head = byJob.insertRow(); ['직업', '장소', '3교시', '4교시'].forEach(t => { const th = document.createElement('th'); th.textContent = t; head.append(th); });
  jobs.forEach((job, j) => {
    const row = byJob.insertRow();
    [job.name, job.room, ...PERIODS.map(([p]) => adminState.picks.filter(k => k[p] === j).map(label).join(', ') || '-')].forEach(t => row.insertCell().textContent = t);
  });
  const byNum = $('byNum'); byNum.replaceChildren();
  const head2 = byNum.insertRow(); ['번호', '이름', '3교시', '4교시', ''].forEach(t => { const th = document.createElement('th'); th.textContent = t; head2.append(th); });
  for (const k of adminState.picks) {
    const row = byNum.insertRow();
    [k.num + '번', k.name, jobs[k.p3].name, jobs[k.p4].name].forEach(t => row.insertCell().textContent = t);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'mini'; reset.textContent = '초기화'; reset.disabled = busy;
    reset.onclick = () => { if (confirm(`${k.num}번 ${k.name} 학생의 신청을 지울까요? 해당 학생은 다시 신청할 수 있습니다.`)) adminCall({ action: 'reset', num: k.num }); };
    row.insertCell().append(reset);
  }
  const done = new Set(adminState.picks.map(k => k.num)), missing = [];
  for (let n = 1; n <= adminState.maxNum; n++) if (!done.has(n)) missing.push(n);
  $('missing').textContent = missing.length ? missing.join(', ') : '없음 (전원 완료)';
}
function adminCall(data) {
  return run(async () => {
    const result = await request({ ...data, key: $('adminKey').value });
    adminState = result.state; render(result.state);
    $('adminStatus').textContent = `${adminState.open ? '신청 진행 중' : '신청 닫힘'} · ${adminState.picks.length} / ${adminState.maxNum}명 완료`;
    message('관리 정보가 반영되었어요.');
  }, true);
}
$('adminLoad').onclick = () => adminCall({ action: 'adminStatus' });
$('toggle').onclick = () => adminCall({ action: 'toggle', open: !adminState.open });
$('resetAll').onclick = () => { if (confirm('모든 학생의 신청 내역을 지우고 신청을 닫을까요? 되돌릴 수 없습니다.')) adminCall({ action: 'resetAll' }); };
$('download').onclick = () => {
  const jobs = adminState.jobs, cell = v => `"${String(v).replace(/"/g, '""')}"`;
  const lines = ['번호,이름,3교시,4교시,신청시각', ...adminState.picks.map(k => [k.num, k.name, jobs[k.p3].name, jobs[k.p4].name, k.at].map(cell).join(','))];
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = '진로의날-2학년3반.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};

refresh();
setInterval(() => { if (!document.hidden) { refresh().then(() => { if (adminState && !busy && $('teacher').open && $('adminKey').value) request({ action: 'adminStatus', key: $('adminKey').value }).then(r => { adminState = r.state; renderAdmin(); }).catch(() => {}); }); } }, 10000);
