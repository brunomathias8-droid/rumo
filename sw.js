/* sw.js — faz o app abrir sem internet. Troque VERSAO a cada publicação para os aparelhos receberem a nova versão. */
const VERSAO = 'rumo-v1.6.1';
const CASCA = ['./', 'index.html', 'config.js', 'nucleo.js', 'app-base.js', 'app-formularios.js', 'app-telas.js', 'app-mapa.js', 'app-push.js',
  'manifest.webmanifest', 'icones/icone.svg', 'icones/icone-192.png', 'icones/apple-touch-icon.png'];
const LIMITE_MAPA = 1500; // fundo do mapa já visto (blocos) guardado para rever sem internet

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(CASCA)));
});
self.addEventListener('message', e => { if (e.data === 'ativar') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== 'rumo-mapa' && k !== 'rumo-libs').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // API (POST) nunca passa por cache
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;

  // Bibliotecas (MapLibre, Sortable) e fontes: primeiro o cache
  if (/unpkg\.com|jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|www\.gstatic\.com/.test(url.hostname)) {
    e.respondWith(caches.open('rumo-libs').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // Fundo do mapa: usa o que já foi visto e atualiza em segundo plano
  if (/openfreemap\.org$/.test(url.hostname)) {
    e.respondWith(caches.open('rumo-mapa').then(async c => {
      const hit = await c.match(req);
      const rede = fetch(req).then(r => { if (r.ok) { c.put(req, r.clone()); aparar(c); } return r; }).catch(() => hit || Response.error());
      return hit || rede;
    }));
    return;
  }
  // Casca do app: rede primeiro (pega atualizações), cache se estiver sem internet
  // (com sinal fraco, espera no máximo 4 s antes de usar o cache)
  if (url.origin === self.location.origin) {
    const doCache = () => caches.match(req, { ignoreSearch: true }).then(c => c || (req.mode === 'navigate' ? caches.match('index.html') : null));
    const rede = fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
      return r;
    });
    e.respondWith(Promise.race([rede, new Promise(res => setTimeout(() => res(null), 4000))])
      .then(async r => r || (await doCache()) || rede)
      .catch(async () => (await doCache()) || Response.error()));
  }
});

let aparando = false;
async function aparar(c) {
  if (aparando) return;
  aparando = true;
  try {
    const ks = await c.keys();
    if (ks.length > LIMITE_MAPA) await Promise.all(ks.slice(0, ks.length - LIMITE_MAPA).map(k => c.delete(k)));
  } finally { aparando = false; }
}

/* ---------- notificações (push pelo Firebase Cloud Messaging) ----------
   O servidor manda só dados {titulo, corpo, url, tag}; aqui viram a notificação.
   Toda mensagem precisa mostrar uma notificação (o iPhone exige). */
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) { p = { data: { corpo: e.data ? e.data.text() : '' } }; }
  const d = p.data || {}, n = p.notification || {};
  const titulo = d.titulo || n.title || 'Rumo';
  const opcoes = { body: d.corpo || n.body || '', icon: 'icones/icone-192.png', data: { url: d.url || '#/hoje' }, lang: 'pt-BR' };
  if (d.tag) { opcoes.tag = d.tag; opcoes.renotify = true; }
  e.waitUntil(self.registration.showNotification(titulo, opcoes));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '#/hoje';
  const alvo = self.registration.scope + url;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aberto = lista.find(c => c.url.startsWith(self.registration.scope));
    if (aberto) { aberto.postMessage({ ir: url }); return aberto.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
