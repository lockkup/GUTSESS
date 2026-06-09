/* frontend/public/sw.js */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // ให้ API หรือ request ที่ไม่ใช่ GET วิ่งตรง ไม่ต้องยุ่งกับ cache
  if (request.method !== "GET") {
    return;
  }

  // ถ้าเป็น API ให้ยิงตรงเสมอ กันข้อมูลเก่าค้าง
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api")) {
    return;
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cachedResponse = await caches.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      return Response.error();
    }),
  );
});