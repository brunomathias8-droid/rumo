/* app-mapa.js — mapa interativo (MapLibre + OpenFreeMap), com marcadores por dia/tipo, agrupamento, filtros, rota do dia,
   "perto de mim", adicionar ponto tocando e segurando, e lista deslizante. Sem internet: lista + botões Apple/Google/Waze. */
'use strict';

const MAPA = { map: null, el: null, marcadores: [], temp: null, eu: null, pos: null, watch: null, ok: false, semFundo: false };
const COR_TIPO = { hospedagem: '#1d4ed8', atividade: '#c2410c', restaurante: '#be185d', transporte: '#475569', interesse: '#047857', outro: '#57534e' };
const ESTILO_VAZIO = { version: 8, sources: {}, layers: [{ id: 'fundo', type: 'background', paint: { 'background-color': '#e8e2d4' } }] };

function estadoMapa() {
  return S.ui.mapa = S.ui.mapa || { rota: false, dia: '', tipos: [], status: [], perto: false, lista: 1 };
}

/** Dias em que cada lugar aparece (atividades + hospedagem). */
function diasPorLugar() {
  const out = {};
  daV('Atividades').forEach(a => { if (a.LugarID) (out[a.LugarID] = out[a.LugarID] || new Set()).add(a.Data); });
  daV('Reservas').forEach(r => {
    if (!r.LugarID || !r.Inicio) return;
    const ini = String(r.Inicio).slice(0, 10), fim = String(r.Fim || r.Inicio).slice(0, 10);
    N_dias(ini, fim).forEach(d => (out[r.LugarID] = out[r.LugarID] || new Set()).add(d));
  });
  return out;
}

function diaDaRota(E) {
  if (E.dia) return E.dia;
  const dias = diasDaViagem();
  return dias.includes(hoje()) ? hoje() : (S.ui.mapaFiltroDia || dias[0]);
}

/** Pontos filtrados para o mapa e para a lista. */
function pontosMapa() {
  const E = estadoMapa();
  if (S.ui.mapaFiltroDia) { E.dia = S.ui.mapaFiltroDia; S.ui.mapaFiltroDia = null; }
  const dpl = diasPorLugar();
  const comCoord = daV('Lugares').filter(l => l.Lat !== '' && l.Lat !== undefined && l.Lng !== '');
  if (E.rota) {
    const dia = diaDaRota(E);
    const ats = atividadesDoDia(dia).filter(a => { const l = ach('Lugares', a.LugarID); return l && l.Lat !== ''; });
    const hosp = hospedagemDoDia(dia);
    const lista = ats.map((a, i) => ({ l: ach('Lugares', a.LugarID), a, n: i + 1 }));
    return { dia, rota: true, lista, hosp: hosp && hosp.lugar && hosp.lugar.Lat !== '' ? hosp.lugar : null };
  }
  let l = comCoord;
  if (E.dia) l = l.filter(x => dpl[x.ID] && dpl[x.ID].has(E.dia));
  if (E.tipos.length) l = l.filter(x => E.tipos.includes(x.Tipo));
  if (E.status.length) l = l.filter(x => E.status.includes(x.Status));
  const lista = l.map(x => {
    const ds = dpl[x.ID] ? Array.from(dpl[x.ID]).sort() : [];
    return { l: x, dia: E.dia || ds[0] || '', dist: MAPA.pos ? N_distKm(MAPA.pos.lat, MAPA.pos.lng, Number(x.Lat), Number(x.Lng)) : null };
  });
  if (E.perto && MAPA.pos) lista.sort((a, b) => a.dist - b.dist);
  else lista.sort((a, b) => String(a.dia || '9').localeCompare(String(b.dia || '9')) || a.l.Nome.localeCompare(b.l.Nome));
  return { rota: false, lista, semCoord: daV('Lugares').filter(x => x.Lat === '' || x.Lat === undefined) };
}

TELAS.mapa = () => {
  const E = estadoMapa();
  return {
    titulo: 'mapa',
    largo: true,
    html: `<div class="mapa-casca">
      <div id="mapa" role="application" aria-label="Mapa da viagem"></div>
      <div class="mapa-filtros"><div class="chips" id="mapa-chips">${chipsMapa(E)}</div></div>
      <div class="mapa-acoes" style="top:64px">
        <button class="icone-btn" data-a="mapa-local" aria-label="Minha localização" title="Minha localização">◎</button>
        <button class="icone-btn" data-a="mapa-perto" aria-label="Perto de mim" title="Perto de mim" ${E.perto ? 'style="background:var(--tinta);color:var(--papel)"' : ''}>⇣</button>
        ${podeEditar() ? '<button class="icone-btn" data-a="novo-lugar" aria-label="Adicionar lugar" title="Adicionar lugar" style="background:var(--acao);color:var(--acao-txt);border-color:var(--acao)">+</button>' : ''}
      </div>
      <div id="mapa-aviso" class="mapa-aviso oculto"></div>
      <section class="mapa-lista" data-pos="${E.lista}" id="mapa-lista"><div class="alca" data-a="mapa-lista-pos" style="padding:10px 0 6px;display:grid;place-items:center;cursor:pointer"><i style="width:44px;height:5px;border-radius:3px;background:var(--linha)"></i></div>
        <div class="conteudo" id="mapa-lista-conteudo">${listaMapaHtml()}</div></section>
    </div>`,
    depois: () => iniciarMapa()
  };
};
TELAS.mapa.atualizar = () => {
  if (!MAPA.el || !document.body.contains(MAPA.el)) return false;
  $('#mapa-chips').innerHTML = chipsMapa(estadoMapa());
  $('#mapa-lista-conteudo').innerHTML = listaMapaHtml();
  desenharPontos(false);
  return true;
};

function chipsMapa(E) {
  const tipos = [['hospedagem', '🛏️'], ['atividade', '⭐'], ['interesse', '📍'], ['restaurante', '🍽️'], ['transporte', '🚆']];
  const dia = E.rota ? diaDaRota(E) : E.dia;
  return `<button class="chip ${E.rota ? 'on' : ''}" data-a="mapa-rota">🧭 ${faseViagem() === 'durante' && dia === hoje() ? 'Hoje' : 'Rota do dia'}</button>
    <button class="chip ${dia && (E.dia || E.rota) ? 'on' : ''}" data-a="mapa-dia">${dia && (E.dia || E.rota) ? `<i class="pt" style="background:${corDia(dia)}"></i>${esc(fmtDiaCurto(dia))}` : 'Todos os dias'} ▾</button>
    ${E.rota ? '' : tipos.map(t => `<button class="chip ${E.tipos.includes(t[0]) ? 'on' : ''}" data-a="mapa-tipo" data-t="${t[0]}" aria-label="${t[0]}">${t[1]}</button>`).join('') +
      ['ideia', 'agendado', 'reservado'].map(s => `<button class="chip ${E.status.includes(s) ? 'on' : ''}" data-a="mapa-status" data-s="${s}">${s}</button>`).join('')}
    ${E.dia || E.tipos.length || E.status.length || E.rota ? '<button class="chip" data-a="mapa-limpar">✕ limpar</button>' : ''}`;
}

function listaMapaHtml() {
  const P = pontosMapa();
  const offline = !navigator.onLine ? '<div class="aviso alerta" style="margin-top:4px">Sem internet: o fundo do mapa pode não aparecer, mas a lista e os botões de navegação funcionam (com mapas offline baixados no Google/Apple Maps).</div>' : '';
  if (P.rota) {
    const cd = calc().atividades;
    return `<div class="secao-topo" style="margin-top:0"><b>${esc(fmtDia(P.dia))}${cidadeDoDia(P.dia) ? ' · ' + esc(cidadeDoDia(P.dia).Nome) : ''}</b><span class="peq">${plural(P.lista.length, 'parada')}</span></div>${offline}
      ${P.hosp ? itemHtml({ a: 'mapa-foco', id: P.hosp.ID, ic: '🛏️', t: esc(P.hosp.Nome), s: 'hospedagem' }) : ''}
      ${P.lista.length ? `<div class="lista">${P.lista.map((x, i) => {
        const d = cd[x.a.ID] || {};
        return itemHtml({ a: 'mapa-foco', id: x.l.ID, ic: `<b>${x.n}</b>`, cor: corDia(P.dia), t: esc(x.a.HoraInicio || '') + ' ' + esc(x.a.Titulo), s: esc(x.l.Nome) + (d.min && i < P.lista.length - 1 ? ` · até a próxima ~${d.min} min ${esc(d.modo)}` : ''),
          v: linkRota(x.l) ? `<a class="btn" style="min-height:40px;padding:0 12px" href="${linkRota(x.l)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Ir</a>` : '' });
      }).join('')}</div>` : vazio('Nenhuma atividade com lugar (e coordenadas) neste dia.')}
      <p class="mpeq">Linha reta entre as paradas; tempos estimados. O trajeto real abre no app de mapas.</p>`;
  }
  return `<div class="secao-topo" style="margin-top:0"><b>${plural(P.lista.length, 'lugar', 'lugares')}${estadoMapa().perto && MAPA.pos ? ' · mais perto primeiro' : ''}</b>${podeEditar() ? '<button class="btn" style="min-height:40px" data-a="novo-lugar">+ Lugar</button>' : ''}</div>${offline}
    ${P.lista.length ? `<div class="lista">${P.lista.map(x => itemHtml({ a: 'mapa-foco', id: x.l.ID, ic: ICONE_TIPO[x.l.Tipo] || '📍', cor: x.dia ? corDia(x.dia) : null,
      t: esc(x.l.Nome), s: (x.dia ? esc(fmtDiaCurto(x.dia)) + ' · ' : '') + esc(x.l.Status) + (x.l.CidadeID ? ' · ' + esc(nomeDe('Cidades', x.l.CidadeID)) : ''),
      v: x.dist !== null ? (x.dist < 1 ? Math.round(x.dist * 1000) + ' m' : x.dist.toFixed(1).replace('.', ',') + ' km') : '' })).join('')}</div>` : vazio('Nenhum lugar com esses filtros.')}
    ${P.semCoord.length ? `<details><summary class="peq" style="cursor:pointer;padding:8px 0">${plural(P.semCoord.length, 'lugar', 'lugares')} sem coordenadas (não aparecem no mapa)</summary><div class="lista">${P.semCoord.map(l => itemHtml({ a: 'editar-lugar', id: l.ID, ic: '❔', t: esc(l.Nome), s: 'toque para completar' })).join('')}</div></details>` : ''}`;
}

/* ---------- inicialização do MapLibre ---------- */
async function iniciarMapa() {
  if (MAPA.map) { try { MAPA.map.remove(); } catch (e) { /* ok */ } MAPA.map = null; MAPA.ok = false; MAPA.eu = null; }
  MAPA.el = $('#mapa');
  MAPA.marcadores = [];
  MAPA.temp = null;
  ligarListaArrastavel();
  try {
    if (!$('link[data-maplibre]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CFG.maplibreCss; l.dataset.maplibre = '1'; document.head.appendChild(l);
    }
    await carregarScript(CFG.maplibreJs, 'maplibregl');
  } catch (e) {
    avisoMapa('Mapa indisponível sem internet. Use a lista e os botões de navegação.');
    return;
  }
  if (!document.body.contains(MAPA.el)) return;
  const cids = daV('Cidades').filter(c => c.Lat !== '');
  const centro = cids.length ? [Number(cids[0].Lng), Number(cids[0].Lat)] : [4.35, 50.85];
  MAPA.semFundo = false;
  let estilo = CFG.estiloMapa;
  if (!navigator.onLine) { estilo = ESTILO_VAZIO; MAPA.semFundo = true; }
  const map = new maplibregl.Map({ container: MAPA.el, style: estilo, center: centro, zoom: 11, attributionControl: { compact: true }, cooperativeGestures: false, dragRotate: false, pitchWithRotate: false });
  MAPA.map = map;
  map.touchZoomRotate.disableRotation();
  // Se o estilo não carregar em 8 s (rede ruim / provedor fora), segue com fundo neutro: os pontos continuam
  const t = setTimeout(() => { if (!map.isStyleLoaded()) { MAPA.semFundo = true; map.setStyle(ESTILO_VAZIO); avisoMapa('Fundo do mapa indisponível agora; mostrando só os pontos.'); } }, 8000);
  map.on('error', e => { if (!MAPA.ok && e && e.error && /style|fetch|Failed/i.test(String(e.error.message || e.error))) { clearTimeout(t); if (!MAPA.semFundo) { MAPA.semFundo = true; map.setStyle(ESTILO_VAZIO); avisoMapa('Fundo do mapa indisponível agora; mostrando só os pontos.'); } } });
  const pronto = () => { clearTimeout(t); if (MAPA.ok) { garantirCamadaRota(); desenharPontos(false); return; } MAPA.ok = true; desenharPontos(true); };
  map.on('load', pronto);
  map.on('style.load', pronto);
  map.on('moveend', () => desenharMarcadores());
  map.on('contextmenu', e => pontoNovo(e.lngLat));
  ligarToqueLongo(map);
  if (MAPA.pos) mostrarEu();
}

function avisoMapa(txt) { const a = $('#mapa-aviso'); if (a) { a.textContent = txt; a.classList.remove('oculto'); setTimeout(() => a.classList.add('oculto'), 7000); } }

function garantirCamadaRota() {
  const map = MAPA.map;
  if (!map || !map.isStyleLoaded()) return;
  if (!map.getSource('rota')) map.addSource('rota', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  if (!map.getLayer('rota-linha')) map.addLayer({ id: 'rota-linha', type: 'line', source: 'rota', paint: { 'line-color': ['get', 'cor'], 'line-width': 4, 'line-dasharray': [1.5, 1.2], 'line-opacity': 0.85 } });
}

/** Atualiza linha da rota e marcadores; na primeira vez, enquadra os pontos. */
function desenharPontos(enquadrar) {
  const map = MAPA.map;
  if (!map || !MAPA.ok) return;
  garantirCamadaRota();
  const P = pontosMapa();
  const feats = [];
  if (P.rota && P.lista.length > 1) feats.push({ type: 'Feature', properties: { cor: corDia(P.dia) }, geometry: { type: 'LineString', coordinates: P.lista.map(x => [Number(x.l.Lng), Number(x.l.Lat)]) } });
  if (map.getSource('rota')) map.getSource('rota').setData({ type: 'FeatureCollection', features: feats });
  desenharMarcadores();
  if (S.ui.focoLugar) { const id = S.ui.focoLugar; S.ui.focoLugar = null; focarLugar(id, true); return; }
  if (enquadrar || P.rota) enquadrarPontos(P);
}

function enquadrarPontos(P) {
  const pts = (P.rota ? P.lista.map(x => x.l).concat(P.hosp ? [P.hosp] : []) : P.lista.map(x => x.l)).map(l => [Number(l.Lng), Number(l.Lat)]);
  if (!pts.length) return;
  if (pts.length === 1) { MAPA.map.jumpTo({ center: pts[0], zoom: 14 }); return; }
  const b = pts.reduce((bb, p) => bb.extend(p), new maplibregl.LngLatBounds(pts[0], pts[0]));
  const lista = $('#mapa-lista');
  const baixo = window.innerWidth < 900 && lista ? lista.offsetHeight + 20 : 90;
  MAPA.map.fitBounds(b, { padding: { top: 80, bottom: baixo, left: 40, right: window.innerWidth >= 900 ? 60 : 60 }, maxZoom: 15, duration: 0 });
}

/** Marcadores em HTML (funcionam mesmo sem o fundo do mapa) com agrupamento simples por proximidade na tela. */
function desenharMarcadores() {
  const map = MAPA.map;
  if (!map) return;
  MAPA.marcadores.forEach(mk => mk.remove());
  MAPA.marcadores = [];
  const P = pontosMapa();
  const itens = P.rota ? P.lista.map(x => ({ l: x.l, n: x.n, cor: corDia(P.dia) })).concat(P.hosp ? [{ l: P.hosp, cor: COR_TIPO.hospedagem }] : [])
    : P.lista.map(x => ({ l: x.l, cor: x.dia ? corDia(x.dia) : COR_TIPO[x.l.Tipo] || '#57534e' }));
  const raio = 44;
  const grupos = [];
  itens.forEach(it => {
    const px = map.project([Number(it.l.Lng), Number(it.l.Lat)]);
    it.px = px;
    if (P.rota || map.getZoom() >= 15) { grupos.push([it]); return; }
    const g = grupos.find(gr => Math.hypot(gr[0].px.x - px.x, gr[0].px.y - px.y) < raio);
    if (g) g.push(it); else grupos.push([it]);
  });
  grupos.forEach(g => {
    const el = document.createElement('div');
    if (g.length > 1) {
      el.className = 'grupo-mk';
      el.textContent = g.length;
      el.setAttribute('role', 'button'); el.setAttribute('aria-label', g.length + ' lugares');
      el.onclick = ev => {
        ev.stopPropagation();
        const b = g.reduce((bb, x) => bb.extend([Number(x.l.Lng), Number(x.l.Lat)]), new maplibregl.LngLatBounds([Number(g[0].l.Lng), Number(g[0].l.Lat)], [Number(g[0].l.Lng), Number(g[0].l.Lat)]));
        map.fitBounds(b, { padding: 80, maxZoom: 16 });
      };
      const c = g.reduce((a, x) => [a[0] + Number(x.l.Lng) / g.length, a[1] + Number(x.l.Lat) / g.length], [0, 0]);
      MAPA.marcadores.push(new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map));
      return;
    }
    const it = g[0];
    // O MapLibre usa o "transform" do elemento externo para posicionar; a gota girada fica num elemento interno
    el.innerHTML = `<div class="marcador${it.l.Status === 'ideia' && !it.n ? ' ideia' : ''}${it.n ? ' num' : ''}" style="background:${it.cor}"><span>${it.n ? it.n : (ICONE_TIPO[it.l.Tipo] || '📍')}</span></div>`;
    el.title = it.l.Nome;
    el.setAttribute('role', 'button'); el.setAttribute('aria-label', it.l.Nome);
    el.onclick = ev => { ev.stopPropagation(); AC['abrir-lugar']({ dataset: { id: it.l.ID } }); };
    MAPA.marcadores.push(new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 7] }).setLngLat([Number(it.l.Lng), Number(it.l.Lat)]).addTo(map));
  });
}

function focarLugar(id, abrir) {
  const l = ach('Lugares', id);
  if (!l || l.Lat === '') return;
  if (MAPA.map) MAPA.map.flyTo({ center: [Number(l.Lng), Number(l.Lat)], zoom: Math.max(MAPA.map.getZoom(), 15), duration: 600 });
  if (abrir) setTimeout(() => AC['abrir-lugar']({ dataset: { id } }), 450);
}

/* ---------- adicionar ponto tocando e segurando ---------- */
function ligarToqueLongo(map) {
  const c = map.getCanvasContainer();
  let t = null, x0 = 0, y0 = 0;
  const cancelar = () => { clearTimeout(t); t = null; };
  c.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { cancelar(); return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    t = setTimeout(() => { const r = c.getBoundingClientRect(); pontoNovo(map.unproject([x0 - r.left, y0 - r.top])); t = null; }, 600);
  }, { passive: true });
  c.addEventListener('touchmove', e => { if (t && Math.hypot(e.touches[0].clientX - x0, e.touches[0].clientY - y0) > 10) cancelar(); }, { passive: true });
  c.addEventListener('touchend', cancelar);
  c.addEventListener('touchcancel', cancelar);
}

async function pontoNovo(ll) {
  if (!podeEditar()) return;
  const lat = +ll.lat.toFixed(6), lng = +ll.lng.toFixed(6);
  if (MAPA.temp) MAPA.temp.remove();
  const el = document.createElement('div'); el.innerHTML = '<div class="marcador" style="background:var(--acao)"><span>＋</span></div>';
  MAPA.temp = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 7] }).setLngLat([lng, lat]).addTo(MAPA.map);
  if (navigator.vibrate) navigator.vibrate(20);
  const rasc = S.ui.rascunhoLugar;
  S.ui.escolherNoMapa = false;
  S.ui.rascunhoLugar = null;
  const pre = Object.assign({}, rasc ? rasc.campos : {}, { Lat: lat, Lng: lng });
  const c = daV('Cidades').filter(x => x.Lat !== '').sort((a, b) => N_distKm(lat, lng, +a.Lat, +a.Lng) - N_distKm(lat, lng, +b.Lat, +b.Lng))[0];
  if (c && !pre.CidadeID) pre.CidadeID = c.ID;
  formLugar(rasc ? rasc.id : null, pre);
  S.ui.fonteCoord = 'toque';
  if (navigator.onLine && !pre.Endereco) {
    try {
      const r = await api('enderecoDoPonto', { lat, lng });
      const f = $('#form-generico');
      if (f) {
        const e = f.querySelector('[data-campo="Endereco"]'); if (e && !e.value) e.value = r.endereco || '';
        const n = f.querySelector('[data-campo="Nome"]'); if (n && !n.value && r.nome) n.value = r.nome;
        f.dispatchEvent(new Event('input'));
      }
    } catch (e) { /* endereço é opcional */ }
  }
}

/* ---------- localização ---------- */
function mostrarEu() {
  if (!MAPA.map || !MAPA.pos) return;
  if (!MAPA.eu) { const el = document.createElement('div'); el.className = 'eu-mk'; MAPA.eu = new maplibregl.Marker({ element: el }); }
  MAPA.eu.setLngLat([MAPA.pos.lng, MAPA.pos.lat]).addTo(MAPA.map);
}
function pedirLocalizacao(centralizar) {
  if (!navigator.geolocation) { toast('Localização indisponível neste aparelho.'); return; }
  if (MAPA.watch === null || MAPA.watch === undefined) {
    MAPA.watch = navigator.geolocation.watchPosition(p => {
      const primeira = !MAPA.pos;
      MAPA.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      mostrarEu();
      if (primeira && centralizar && MAPA.map) MAPA.map.flyTo({ center: [MAPA.pos.lng, MAPA.pos.lat], zoom: 15 });
      if (estadoMapa().perto) { const c = $('#mapa-lista-conteudo'); if (c && primeira) c.innerHTML = listaMapaHtml(); }
    }, () => { toast('Permita o acesso à localização nas configurações do aparelho.'); MAPA.watch = null; }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  } else if (MAPA.pos && MAPA.map) MAPA.map.flyTo({ center: [MAPA.pos.lng, MAPA.pos.lat], zoom: 15 });
}

/* ---------- lista deslizante ---------- */
function ligarListaArrastavel() {
  const lista = $('#mapa-lista');
  if (!lista) return;
  const alca = lista.querySelector('.alca');
  let y0 = null;
  alca.addEventListener('pointerdown', e => { y0 = e.clientY; });
  alca.addEventListener('pointerup', e => {
    if (y0 === null) return;
    const dy = e.clientY - y0; y0 = null;
    const E = estadoMapa();
    if (Math.abs(dy) < 8) return; // toque simples é tratado pelo data-a
    E.lista = Math.max(0, Math.min(2, E.lista + (dy < 0 ? 1 : -1)));
    lista.dataset.pos = E.lista;
    S.ui.ignorarToqueLista = true;
  });
}

/* ---------- ações ---------- */
AC['mapa-lista-pos'] = () => {
  if (S.ui.ignorarToqueLista) { S.ui.ignorarToqueLista = false; return; }
  const E = estadoMapa();
  E.lista = (E.lista + 1) % 3;
  $('#mapa-lista').dataset.pos = E.lista;
};
AC['mapa-rota'] = () => { const E = estadoMapa(); E.rota = !E.rota; if (E.rota) { E.lista = 1; } TELAS.mapa.atualizar(); desenharPontos(true); };
AC['mapa-dia'] = () => {
  const E = estadoMapa();
  abrirPainel({ titulo: 'Qual dia?', html: `<div class="lista">${itemHtml({ a: 'mapa-escolhe-dia', id: '', ic: '∗', t: 'Todos os dias' })}${diasDaViagem().map(d => itemHtml({ a: 'mapa-escolhe-dia', id: d, ic: `<b>${dataObj(d).getDate()}</b>`, cor: corDia(d), t: esc(fmtDia(d)) + (d === hoje() ? ' · hoje' : ''), s: cidadeDoDia(d) ? esc(cidadeDoDia(d).Nome) : '' })).join('')}</div>` });
  AC['mapa-escolhe-dia'] = el => { E.dia = el.dataset.id; fecharPainel(); TELAS.mapa.atualizar(); desenharPontos(true); };
};
AC['mapa-tipo'] = el => { const E = estadoMapa(); const t = el.dataset.t; E.tipos = E.tipos.includes(t) ? E.tipos.filter(x => x !== t) : E.tipos.concat(t); TELAS.mapa.atualizar(); };
AC['mapa-status'] = el => { const E = estadoMapa(); const s = el.dataset.s; E.status = E.status.includes(s) ? E.status.filter(x => x !== s) : E.status.concat(s); TELAS.mapa.atualizar(); };
AC['mapa-limpar'] = () => { const E = estadoMapa(); E.dia = ''; E.tipos = []; E.status = []; E.rota = false; TELAS.mapa.atualizar(); desenharPontos(true); };
AC['mapa-local'] = () => pedirLocalizacao(true);
AC['mapa-perto'] = el => {
  const E = estadoMapa();
  E.perto = !E.perto;
  el.style.background = E.perto ? 'var(--tinta)' : ''; el.style.color = E.perto ? 'var(--papel)' : '';
  if (E.perto) { E.rota = false; pedirLocalizacao(false); E.lista = 2; $('#mapa-lista').dataset.pos = 2; }
  TELAS.mapa.atualizar();
};
AC['mapa-foco'] = el => {
  const id = el.dataset.id;
  if (window.innerWidth < 900) { estadoMapa().lista = 0; $('#mapa-lista').dataset.pos = 0; }
  focarLugar(id, true);
};

// Ao sair do mapa, para de acompanhar a localização
window.addEventListener('hashchange', () => {
  if (rotaAtual().nome !== 'mapa') {
    if (MAPA.watch !== null && MAPA.watch !== undefined) { navigator.geolocation.clearWatch(MAPA.watch); MAPA.watch = null; }
    if (MAPA.map) { try { MAPA.map.remove(); } catch (e) { /* ok */ } MAPA.map = null; MAPA.ok = false; MAPA.eu = null; }
  }
});
