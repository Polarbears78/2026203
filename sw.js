/* 서비스 워커
 * - HTML 문서와 data.json: 네트워크 우선(항상 최신), 오프라인 시 캐시로 폴백
 * - 그 외 정적 파일(css/js/이미지): 캐시 우선 */
const CACHE = 'jayubok-v39';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './content.html',
  './admin.css',
  './jayubok.html',
  './weekly.html',
  './survey.html',
  './study-log.html',
  './board.html',
  './manage.html',
  './counsel.html',
  './grades.html',
  './chat.js',
  './vendor/xlsx.full.min.js',
  './vendor/fflate.min.js',
  './timetable.html',
  './notice-camp.html',
  './room-survey.html',
  './rooms.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res.ok && new URL(request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() => caches.match(request).then((c) => c || caches.match('./index.html')));
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((res) => {
      if (res.ok && new URL(request.url).origin === self.location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    });
  });
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const isHTML = e.request.mode === 'navigate' ||
    url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isData = url.pathname.endsWith('/data.json') || url.pathname.endsWith('/menu.json');

  if (isHTML || isData) {
    e.respondWith(networkFirst(e.request));
  } else {
    e.respondWith(cacheFirst(e.request));
  }
});

/* ── 새 소식 알림 ──
 * 공지·주간안내·게시판 갱신을 주기적으로 확인해 알림 표시.
 * periodicsync는 안드로이드 크롬에서 앱(PWA) 설치 시 동작. */
const NOTIFY_ENDPOINT = 'https://script.google.com/macros/s/AKfycby9POET85dvQoraZRfvx4XvAdWX-ZN3xWkVIQPCyQeDp3TwRyvURm1aqhEYfcqv48IG/exec';

async function checkUpdates(silentFirstRun) {
  let content = null, board = null;
  try { content = await fetch(NOTIFY_ENDPOINT + '?action=content').then((r) => r.json()); } catch {}
  try { board = await fetch(NOTIFY_ENDPOINT + '?action=board').then((r) => r.json()); } catch {}
  if (!content && !board) return;

  const posts = (board && board.posts) || [];
  const state = {
    notice: (content && content.content && content.content.notice && content.content.notice.updated) || '',
    weekly: (content && content.content && content.content.weekly && content.content.weekly.updated) || '',
    board: posts.length ? posts.length + '#' + (posts[posts.length - 1].time || '') : '',
  };

  const cache = await caches.open('notify-state');
  const prevRes = await cache.match('./__notify_state__');
  const prev = prevRes ? await prevRes.json() : null;
  await cache.put('./__notify_state__', new Response(JSON.stringify(state)));
  if (!prev) { if (!silentFirstRun) return; return; }

  const msgs = [];
  if (state.notice && state.notice !== prev.notice) msgs.push('📢 새 공지가 올라왔어요');
  if (state.weekly && state.weekly !== prev.weekly) msgs.push('🗓️ 주간안내가 업데이트됐어요');
  if (state.board && state.board !== prev.board) msgs.push('💬 게시판에 새 글이 있어요');
  if (msgs.length) {
    await self.registration.showNotification('2학년 3반 안내', {
      body: msgs.join('\n'),
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'class-update',
    });
  }
}

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'content-check') e.waitUntil(checkUpdates(false));
});

// 앱을 열 때도 한 번 확인 (periodicsync 미지원 브라우저 대비)
self.addEventListener('message', (e) => {
  if (e.data === 'check-updates') e.waitUntil ? e.waitUntil(checkUpdates(false)) : checkUpdates(false);
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('./'));
});
