// Service worker do Mimo: rede primeiro, cache como reserva.
// Só o "casco" (HTML, JS, CSS e imagens) entra no cache. A API (/api/*) nunca
// passa por aqui: dado financeiro não pode ficar num cache que sobrevive ao logout.
// Rede primeiro garante que um deploy novo aparece na hora quando há conexão.
const CACHE = "mimo-shell-v2";
const SHELL = ["/", "/manifest.webmanifest", "/assets/mimo-logo.png", "/assets/mimo-simbolo.png", "/assets/nav.png", "/icons/icon-192.png"];

// Os arquivos do build têm hash no nome; em vez de manter uma lista, lê o
// index.html atual e guarda também o JS/CSS que ele referencia.
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL);
  try {
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
    await cache.addAll([...new Set(refs)]);
  } catch {
    // sem rede na instalação: os arquivos entram no cache na próxima visita
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copia = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia));
        }
        return res;
      })
      .catch(async () => {
        const salvo = await caches.match(req);
        if (salvo) return salvo;
        // rotas do SPA (/duo, /metas...) caem no index.html em cache
        if (req.mode === "navigate") return (await caches.match("/")) ?? Response.error();
        return Response.error();
      }),
  );
});
