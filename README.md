# 👕 자유복의 날 (육민관중학교)

육민관중학교 **자유복 입는 날**을 **자동으로 찾아서 보여주는** 페이지입니다.
학교 홈페이지의 *학교소식 → 월중교육활동* 일정을 매일 자동으로 확인해, “자유복”이 포함된
날짜를 골라 **다음 자유복의 날 D-day / 달력 / 목록**으로 표시합니다. 별도 입력이 필요 없습니다.

## 어떻게 자동으로 가져오나요?

학교 홈페이지는 외부에서의 자동 접속(CORS·봇 차단)이 막혀 있어, 브라우저가 직접 일정을
가져올 수 없습니다. 그래서 **GitHub Actions가 서버에서 학교 사이트를 대신 조회**합니다.

1. `scripts/scrape.mjs` 가 학교 일정(`schedule/list.do`)을 월별로 조회
2. “자유복”이 들어간 일정의 상세 페이지에서 **정확한 날짜**(예: `2026/06/12`)를 추출
3. 결과를 `data.json` 으로 저장
4. 웹페이지는 같은 도메인의 `data.json` 을 읽어 자동 표시 (CORS 문제 없음)

`.github/workflows/scrape.yml` 이 **매일 1회(06:00 KST)** 실행되어 `data.json` 을 갱신하고
GitHub Pages로 재배포합니다. `Actions` 탭에서 수동 실행(Run workflow)도 가능합니다.

## 화면 구성

- **다음 자유복의 날** — D-day와 날짜
- **달력** — 자유복 날짜 강조 표시 (읽기 전용)
- **목록** — 다가오는 자유복 입는 날 목록
- **마지막 자동 확인 시각**과 학교 일정 **바로가기** 링크
- **PWA** — 홈 화면에 설치, 오프라인에서도 마지막 데이터 표시

## 로컬 실행

```bash
python3 -m http.server 8000
# http://localhost:8000 접속  (data.json 을 함께 읽습니다)
```

스크래퍼만 단독 실행(네트워크 필요):

```bash
node scripts/scrape.mjs   # data.json 생성/갱신
```

## 페이지 구성

- `index.html` — **상위 페이지**: 주간안내 / 자유복의 날 선택
- `weekly.html` — **주간안내**: 이번 주 일정 · 시간표 · 청소 당번 (2학년 3반)
- `jayubok.html` — **자유복의 날**: 다음 자유복 입는 날 자동 확인

## 파일 구성

- `index.html` / `weekly.html` / `jayubok.html` — 페이지
- `style.css` / `app.js` — 공통 스타일 · 자유복 페이지 로직
- `data.json` — 자동 추출된 자유복 날짜 (Actions가 갱신)
- `scripts/scrape.mjs` — 학교 일정 스크래퍼
- `.github/workflows/scrape.yml` — 매일 스크래핑 + Pages 배포
- `.github/workflows/pages.yml` — 코드 변경 시 Pages 배포
- `manifest.webmanifest` / `sw.js` / `icon-*.png` — PWA 설정·아이콘

## 참고

- 학교 일정: <https://ymk.gwe.ms.kr/schedule/list.do?m=0203>
