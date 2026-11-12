/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkOnly, NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

clientsClaim();
cleanupOutdatedCaches();

// Remove the REST cache that earlier versions of this worker filled.
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('supabase-rest-v1'));
});

/**
 * The app routes by hash (#/attendance). Push payloads carry plain paths such as
 * "/attendance" or "attendance", which would open the 404 page; map them onto the
 * hash route. Absolute URLs and targets that already carry a hash pass through.
 */
function toAppUrl(target: string): string {
  if (/^https?:\/\//.test(target) || target.includes('#')) return target;
  const path = target.startsWith('/') ? target : '/' + target;
  return path === '/' ? '/' : '/#' + path;
}

// Injected by VitePWA at build time
precacheAndRoute(self.__WB_MANIFEST);

// ── Runtime caching ──────────────────────────────────────────────────────────

// Supabase Auth — never cache
registerRoute(
  ({ url }) => url.host.endsWith('.supabase.co') && /^\/auth\/v1\//.test(url.pathname),
  new NetworkOnly(),
);

// Supabase Realtime — never cache
registerRoute(
  ({ url }) => url.host.endsWith('.supabase.co') && /^\/realtime\/v1\//.test(url.pathname),
  new NetworkOnly(),
);

// Supabase Edge Functions — never cache
registerRoute(
  ({ url }) => url.host.endsWith('.supabase.co') && /^\/functions\/v1\//.test(url.pathname),
  new NetworkOnly(),
);

// Supabase Storage — CacheFirst (avatars, logos, covers)
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.host.endsWith('.supabase.co') &&
    /^\/storage\/v1\/object\/public\//.test(url.pathname),
  new CacheFirst({
    cacheName: 'supabase-storage-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

// Supabase Settings — never cache (theme, configs, workflows must be fresh).
// Placed BEFORE the general REST route because Workbox uses first-match.
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.host.endsWith('.supabase.co') &&
    /^\/rest\/v1\/settings/.test(url.pathname),
  new NetworkOnly(),
);

// Supabase REST — never cache. These responses are private employee data
// (attendance, leave, profiles, salaries); a cached copy would outlive sign-out
// on a shared device. The pages that read them need a connection anyway.
registerRoute(
  ({ url }) => url.host.endsWith('.supabase.co') && /^\/rest\/v1\//.test(url.pathname),
  new NetworkOnly(),
);

// Google Fonts stylesheets
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' }),
);

// Google Fonts webfonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  }),
);

// ESM modules
registerRoute(
  ({ url }) => url.origin === 'https://esm.sh',
  new CacheFirst({
    cacheName: 'esm-modules',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Images
registerRoute(
  ({ url }) => /\/img\//.test(url.pathname),
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// Navigation fallback — serve index.html for SPA routes
// Exclude static assets and API paths
registerRoute(
  new NavigationRoute(
    new NetworkFirst({ cacheName: 'navigation', networkTimeoutSeconds: 8 }),
    {
      denylist: [
        /^\/sitemap\.xml$/,
        /^\/feed\.xml$/,
        /^\/robots\.txt$/,
        /^\/manifest\.json$/,
        /^\/downloads\//,
        /^\/\.well-known\//,
        /^\/save-password/,
      ],
    },
  ),
);

// ── Web Push handlers ────────────────────────────────────────────────────────

self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string; icon?: string; tag?: string } = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'StaffCove', body: event.data.text() };
    }
  }
  // Empty push (no payload) — show generic notification

  const title = payload.title ?? 'StaffCove';
  const options = {
    body: payload.body ?? '',
    icon: payload.icon ?? '/img/icon-192.png',
    badge: '/img/icon-192.png',
    tag: payload.tag ?? 'openhr-checkin',
    renotify: true,
    data: { url: payload.url ?? '/dashboard' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const targetUrl = toAppUrl((event.notification.data?.url as string) ?? '/dashboard');

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            void (client as WindowClient).navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
