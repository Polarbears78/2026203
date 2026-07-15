/**
 * 2학년 3반 폼 → 구글 시트 자동 저장 (Google Apps Script 웹 앱)
 * - 학교생활 소감 설문   → '응답' 탭
 * - 방학 학습 기록(type=study) → '학습기록' 탭
 * 설정 방법은 SHEET_SETUP.md 참고.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var d = JSON.parse(e.postData.contents);

    if (d.type === 'study') {
      // 방학 학습 기록
      var log = ss.getSheetByName('학습기록') || ss.insertSheet('학습기록');
      var logHeaders = ['제출시각', '날짜', '번호', '이름', '국어(문항)', '수학(문항)', '영어(문항)', '영어단어(암기)'];
      if (log.getLastRow() === 0) log.appendRow(logHeaders);
      log.appendRow([
        new Date(), d.date || '', d.num || '', d.name || '',
        d.kor || '', d.math || '', d.eng || '', d.word || ''
      ]);
    } else {
      // 학교생활 소감 설문
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

function doGet() {
  return ContentService.createTextOutput('2학년 3반 폼 수집 엔드포인트가 동작 중입니다.');
}
