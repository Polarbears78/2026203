/**
 * 학교생활 소감 설문 → 구글 시트 자동 저장 (Google Apps Script 웹 앱)
 * 설정 방법은 SHEET_SETUP.md 참고.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('응답') || ss.insertSheet('응답');

    var headers = ['제출시각', '학번', '이름', '1인1역/직책', '학교행사',
      '학업역량', '희망진로', '진로노력', '장점과단점', '협력/갈등', '성장포인트', '기타'];
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);

    var d = JSON.parse(e.postData.contents);
    sheet.appendRow([
      new Date(),
      d.sid || '', d.name || '', d.role || '', d.event || '',
      d.study || '', d.career || '', d.careerEffort || '', d.prosCons || '',
      d.coop || '', d.growth || '', d.etc || ''
    ]);

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
  return ContentService.createTextOutput('학교생활 소감 설문 수집 엔드포인트가 동작 중입니다.');
}
