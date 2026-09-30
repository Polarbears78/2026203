'use strict';
const SEAT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzewxbmqadjJsrXZxfaMGCWBDS3QOQ2sH2afDfIdoQjWePUaXbuQcEcXnQQijaw9U6p/exec';
const $ = id => document.getElementById(id);
let state = null, adminState = null, adminLoaded = false, busy = false, reading = false, mySeat = null;
let setupRequest = null, epoch = 0;
const invite = new URLSearchParams(location.hash.slice(1));
$('num').value = invite.get('num') || '';
$('code').value = invite.get('code') || '';
const inviteRound = invite.get('round');
if (location.hash === '#teacher') $('teacher').open = true;
if (location.hash) history.replaceState(null, '', location.pathname + location.search);
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
async function request(data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(data ? SEAT_ENDPOINT : SEAT_ENDPOINT + '?action=seats&t=' + Date.now(), data ? {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'seats', ...data }), signal: controller.signal, credentials: 'omit', redirect: 'follow'
    } : { signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('자리 뽑기 연결이 준비되지 않았어요. 선생님이 Apps Script를 최신 버전으로 재배포해야 합니다.'); }
    if (!result.ok) throw new Error(result.message || '요청을 처리하지 못했어요.');
    if (!Object.hasOwn(result, 'state')) throw new Error('자리 뽑기 서버 업데이트가 필요합니다.');
    return result;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('서버 응답을 확인하지 못했어요. 연결 후 같은 번호와 코드로 다시 눌러 주세요. 이미 배정됐다면 같은 자리가 표시돼요.');
    throw error;
  } finally { clearTimeout(timeout); }
}
function render(next) {
  if (state?.round !== next?.round) { mySeat = null; $('result').textContent = ''; }
  state = next;
  $('grid').replaceChildren();
  $('drawBtn').disabled = busy || !state;
  if (!state) { $('progress').textContent = '선생님이 뽑기를 준비 중이에요.'; return; }
  const done = state.students.filter(s => s.seat !== null).length;
  $('progress').textContent = `${state.open ? '뽑기 진행 중' : '뽑기 일시 중지'} · ${done} / ${state.students.length}명 완료`;
  $('grid').style.gridTemplateColumns = `repeat(${state.cols}, minmax(58px, 1fr))`;
  $('grid').style.minWidth = `${state.cols * 67}px`;
  for (let seat = 1; seat <= state.cols * state.rows; seat++) {
    const student = state.students.find(s => s.seat === seat);
    const cell = document.createElement('div');
    cell.className = 'seat' + (seat > state.students.length ? ' unused' : '') + (student ? ' taken' : '') + (seat === mySeat ? ' mine' : '');
    const col = (seat - 1) % state.cols;
    if (col % 2 === 1 && col < state.cols - 1) cell.style.marginRight = '14px';
    const label = document.createElement('small'); label.textContent = `${Math.ceil(seat / state.cols)}줄 ${(seat - 1) % state.cols + 1}열`;
    const name = document.createElement('b'); name.textContent = student ? `${student.num}번` : (seat > state.students.length ? '비워 둠' : '빈자리');
    cell.append(label, name); $('grid').append(cell);
  }
}
async function refresh() {
  if (busy || reading) return;
  reading = true;
  const readEpoch = epoch;
  try { const result = await request(); if (!busy && readEpoch === epoch) { render(result.state); message(state ? '최신 배치 현황이에요.' : '아직 열린 뽑기가 없어요.'); } }
  catch (e) { message(e.message, true); } finally { reading = false; }
}
async function run(task, admin = false) {
  if (busy) return;
  busy = true; epoch++;
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  message('서버에서 확인하고 있어요…');
  try { await task(); } catch (e) { message(e.message, true); if (admin) $('adminStatus').textContent = e.message; }
  finally {
    busy = false;
    document.querySelectorAll('button').forEach(b => b.disabled = false);
    $('drawBtn').disabled = !state; $('setup').disabled = !adminLoaded;
    $('toggle').disabled = !adminLoaded || !adminState; $('download').disabled = !adminState;
  }
}
$('drawForm').addEventListener('submit', event => {
  event.preventDefault();
  run(async () => {
    if (!state) throw new Error('먼저 뽑기 정보를 불러와 주세요.');
    if (inviteRound && inviteRound !== state.round) throw new Error('지난 회차의 링크예요. 선생님께 새 개인 링크를 받아 주세요.');
    const result = await request({ action: 'draw', round: state.round, num: Number($('num').value), code: $('code').value.trim() });
    render(result.state); mySeat = result.seat; render(result.state);
    $('result').textContent = `🎉 내 자리는 ${Math.ceil(mySeat / state.cols)}줄 ${(mySeat - 1) % state.cols + 1}열!`;
    message('자리가 저장되었어요. 다시 눌러도 같은 자리예요.');
  });
});
function personalLink(s, round) { return new URL('seats.html', location.href).href + '#' + new URLSearchParams({ num: s.num, code: s.code, round }); }
function showAdmin(result) {
  adminLoaded = true; adminState = result.state; render(result.state); $('codes').replaceChildren();
  if (adminState) {
    $('cols').value = adminState.cols; $('rows').value = adminState.rows;
    $('numbers').value = adminState.students.map(s => s.num).join(',');
    const table = document.createElement('table'); table.className = 'code-table';
    const caption = document.createElement('caption'); caption.textContent = '학생별 개인 링크 (해당 학생에게만 전달)'; table.append(caption);
    for (const s of adminState.students) {
      const row = table.insertRow(); row.insertCell().textContent = `${s.num}번`;
      const input = document.createElement('input'); input.readOnly = true; input.value = personalLink(s, adminState.round); input.setAttribute('aria-label', `${s.num}번 개인 링크`); input.onclick = () => input.select(); row.insertCell().append(input);
    }
    $('codes').append(table);
  }
  $('adminStatus').textContent = adminState ? '관리 정보를 확인했어요. 개인 링크를 학생별로 전달하세요.' : '자리 수와 학생 번호를 확인한 뒤 새 뽑기를 시작하세요.';
  message('관리 정보가 반영되었어요.');
}
$('adminLoad').onclick = () => run(async () => { await request(); showAdmin(await request({ action: 'adminStatus', key: $('adminKey').value })); }, true);
$('setup').onclick = () => {
  if (!confirm('현재 배치와 개인 코드를 교체하고 새 뽑기를 시작할까요?')) return;
  run(async () => {
    const config = { cols: Number($('cols').value), rows: Number($('rows').value), numbers: $('numbers').value.trim().split(/[\s,]+/).map(Number), round: adminState?.round || '' };
    const signature = JSON.stringify(config);
    if (!setupRequest || setupRequest.signature !== signature) setupRequest = { signature, id: crypto.randomUUID() };
    const result = await request({ action: 'setup', key: $('adminKey').value, ...config, requestId: setupRequest.id });
    setupRequest = null; showAdmin(result);
  }, true);
};
$('toggle').onclick = () => run(async () => showAdmin(await request({ action: 'toggle', key: $('adminKey').value, round: adminState.round, open: !adminState.open })), true);
$('download').onclick = () => {
  const lines = ['번호,개인 링크', ...adminState.students.map(s => `${s.num},${personalLink(s, adminState.round)}`)];
  const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = '자리뽑기-개인링크.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('refresh').onclick = refresh; $('print').onclick = () => window.print();
$('num').oninput = $('code').oninput = () => { mySeat = null; $('result').textContent = ''; render(state); };
refresh(); setInterval(() => { if (!document.hidden) refresh(); }, 15000);
