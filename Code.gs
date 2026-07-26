/**
 * 2학년 3반 폼 → 구글 시트 자동 저장 + 통계 읽기 (Google Apps Script 웹 앱)
 * - 학교생활 소감 설문        → '응답' 탭
 * - 방학 학습 기록(type=study) → '학습기록' 탭
 * - 통계 페이지 읽기(GET action=studyStats) → '학습기록' 데이터를 JSONP로 반환
 * - 콘텐츠 게시(type=publish, 관리자 키 필요) → '콘텐츠' 탭  ※ 관리 콘솔 전용
 * - 콘텐츠 읽기(GET action=content) → 주간안내·공지사항 JSONP 반환
 * 설정 방법은 SHEET_SETUP.md 참고.
 * ※ 콘텐츠 게시를 쓰려면 [프로젝트 설정 → 스크립트 속성]에 ADMIN_KEY를 등록하세요.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var d = JSON.parse(e.postData.contents);

    if (d.type === 'board') {
      var bd = ss.getSheetByName('게시판') || ss.insertSheet('게시판');
      if (bd.getLastRow() === 0) bd.appendRow(['작성시각', '닉네임', '내용']);
      bd.appendRow([
        new Date(),
        String(d.name || '익명').slice(0, 20),
        String(d.text || '').slice(0, 1000)
      ]);
    } else if (d.type === 'study') {
      var log = ss.getSheetByName('학습기록') || ss.insertSheet('학습기록');
      // 과학·독서활동은 기존 데이터 정렬 보존을 위해 맨 뒤(9·10열)에 추가
      var logHeaders = ['제출시각', '날짜', '번호', '이름', '국어(문항)', '수학(문항)', '영어(문항)', '영어단어(암기)', '과학(문항)', '독서활동'];
      if (log.getLastRow() === 0) log.appendRow(logHeaders);
      else if (log.getLastColumn() < logHeaders.length) log.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
      log.appendRow([
        new Date(), d.date || '', d.num || '', d.name || '',
        d.kor || '', d.math || '', d.eng || '', d.word || '', d.sci || '', d.reading || ''
      ]);
    } else if (d.type === 'publish') {
      // 관리 콘솔 → 주간안내·공지사항 게시 (ADMIN_KEY 검증)
      var adminKey = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
      if (!adminKey) {
        return ContentService
          .createTextOutput(JSON.stringify({ result: 'error', message: 'ADMIN_KEY가 설정되지 않았습니다. 스크립트 속성에 등록하세요.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (String(d.key || '') !== adminKey) {
        return ContentService
          .createTextOutput(JSON.stringify({ result: 'error', message: '관리자 키가 올바르지 않습니다.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var kind = String(d.kind || '');
      if (kind !== 'weekly' && kind !== 'notice') {
        return ContentService
          .createTextOutput(JSON.stringify({ result: 'error', message: '알 수 없는 kind: ' + kind }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var ct = ss.getSheetByName('콘텐츠') || ss.insertSheet('콘텐츠');
      if (ct.getLastRow() === 0) ct.appendRow(['kind', 'json', 'updated']);
      var json = JSON.stringify(d.data || {});
      var rowIdx = -1;
      if (ct.getLastRow() > 1) {
        var kinds = ct.getRange(2, 1, ct.getLastRow() - 1, 1).getValues();
        for (var k = 0; k < kinds.length; k++) if (String(kinds[k][0]) === kind) { rowIdx = k + 2; break; }
      }
      if (rowIdx > 0) ct.getRange(rowIdx, 1, 1, 3).setValues([[kind, json, new Date()]]);
      else ct.appendRow([kind, json, new Date()]);
    } else {
      var sheet = ss.getSheetByName('응답') || ss.insertSheet('응답');
      var headers = ['제출시각', '학번', '이름', '1인1역/직책', '학교행사',
        '학업역량', '희망진로', '진로노력', '장점과단점', '협력/갈등', '성장포인트', '기타'];
      if (sheet.getLastRow() === 0) sheet.appendRow(headers);
      sheet.appendRow([
        new Date(),
        d.sid || '', d.name || '', d.role || '', d.event || '',
        d.study || '', d.career || '', d.careerEffort || '', d.prosCons || '',
        d.coop || '', d.growth || '', d.etc || ''
      ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var cb = p.callback;

  if (p.action === 'studyStats') {
    var payload;
    try {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('학습기록');
      var out = [];
      if (sh && sh.getLastRow() > 1) {
        var values = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
        for (var i = 0; i < values.length; i++) {
          var r = values[i];
          var dv = r[1];
          var dateStr = (dv instanceof Date)
            ? Utilities.formatDate(dv, 'Asia/Seoul', 'yyyy-MM-dd')
            : String(dv || '');
          out.push({
            date: dateStr,
            num: r[2],
            name: String(r[3] || ''),
            kor: Number(r[4]) || 0,
            math: Number(r[5]) || 0,
            eng: Number(r[6]) || 0,
            word: Number(r[7]) || 0,
            sci: Number(r[8]) || 0,
            reading: String(r[9] || '')
          });
        }
      }
      payload = JSON.stringify({ ok: true, rows: out });
    } catch (err) {
      payload = JSON.stringify({ ok: false, message: String(err) });
    }
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + payload + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
  }

  if (p.action === 'board') {
    var bpayload;
    try {
      var bsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('게시판');
      var posts = [];
      if (bsh && bsh.getLastRow() > 1) {
        var bvals = bsh.getRange(2, 1, bsh.getLastRow() - 1, 3).getValues();
        for (var j = 0; j < bvals.length; j++) {
          var tv = bvals[j][0];
          var ts = (tv instanceof Date)
            ? Utilities.formatDate(tv, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
            : String(tv || '');
          posts.push({ time: ts, name: String(bvals[j][1] || ''), text: String(bvals[j][2] || '') });
        }
      }
      bpayload = JSON.stringify({ ok: true, posts: posts });
    } catch (err) {
      bpayload = JSON.stringify({ ok: false, message: String(err) });
    }
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + bpayload + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(bpayload).setMimeType(ContentService.MimeType.JSON);
  }

  if (p.action === 'content') {
    // 주간안내·공지사항 읽기 (학생용 페이지·관리 콘솔 공용, 인증 불필요)
    var cpayload;
    try {
      var csh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('콘텐츠');
      var content = {};
      if (csh && csh.getLastRow() > 1) {
        var cvals = csh.getRange(2, 1, csh.getLastRow() - 1, 3).getValues();
        for (var c = 0; c < cvals.length; c++) {
          var ckind = String(cvals[c][0] || '');
          if (!ckind) continue;
          var cdata;
          try { cdata = JSON.parse(String(cvals[c][1] || '{}')); } catch (pe) { cdata = null; }
          var cup = cvals[c][2];
          content[ckind] = {
            data: cdata,
            updated: (cup instanceof Date) ? Utilities.formatDate(cup, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(cup || '')
          };
        }
      }
      cpayload = JSON.stringify({ ok: true, content: content });
    } catch (err) {
      cpayload = JSON.stringify({ ok: false, message: String(err) });
    }
    if (cb) {
      return ContentService.createTextOutput(cb + '(' + cpayload + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(cpayload).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput('2학년 3반 폼 수집 엔드포인트가 동작 중입니다.');
}
