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
    depois: () => { medirTopoMapa(); iniciarMapa(); ativarArrastarRota(); }
  };
};
TELAS.mapa.atualizar = () => {
  if (!MAPA.el || !document.body.contains(MAPA.el)) return false;
  $('#mapa-chips').innerHTML = chipsMapa(estadoMapa());
  $('#mapa-lista-conteudo').innerHTML = listaMapaHtml();
  ativarArrastarRota();
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
    const info = infoRota(P.dia);
    const r = info.rota;
    const tempo = s => { const mm = Math.max(1, Math.round(s / 60)); return mm < 60 ? mm + ' min' : Math.floor(mm / 60) + ' h ' + String(mm % 60).padStart(2, '0'); };
    const km = mt => (mt / 1000).toFixed(mt < 10000 ? 1 : 0).replace('.', ',') + ' km';
    const status = r ? `Rota pelas ruas · ${esc(r.fonte || 'OpenStreetMap')}` : !navigator.onLine ? 'Sem internet: linha reta. A rota aparece quando houver sinal.'
      : S.ui.erroRota ? esc(S.ui.erroRota) : info.pontos.length > 1 ? 'Calculando a rota pelas ruas…' : '';
    const cd = calc().atividades;
    const google = linksGoogleRota(info);
    return `<div class="secao-topo" style="margin-top:0"><b>${esc(fmtDia(P.dia))}${cidadeDoDia(P.dia) ? ' · ' + esc(cidadeDoDia(P.dia).Nome) : ''}</b><span class="peq">${plural(P.lista.length, 'parada')}</span></div>${offline}
      <div class="seg" style="margin-bottom:8px">${[['a pé', '🚶 A pé'], ['carro', '🚐 Carro'], ['bicicleta', '🚲 Bicicleta']].map(x => `<button class="${info.modo === x[0] ? 'on' : ''}" data-a="rota-modo" data-m="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${info.temHosp ? `<label class="check" style="min-height:36px"><input type="checkbox" data-a="rota-hosp" ${info.usarHosp ? 'checked' : ''}><span class="peq">Começar na hospedagem</span></label>` : ''}
      ${r ? `<div class="cartao" style="padding:10px 12px;margin-bottom:8px"><b>${km(r.distancia)} · ${tempo(r.duracao)} ${esc(info.modo)}</b><div class="mpeq">${status} · sem contar o tempo nas paradas</div></div>` : `<p class="mpeq">${status}</p>`}
      ${avisoHorarios(P.dia)}
      ${P.lista.length ? `<div class="lista" id="lista-rota">${info.seq.map((x, i) => {
        const t = r && r.trechos[i];
        const est = !r && x.a && cd[x.a.ID] ? cd[x.a.ID] : null;
        const prox = i < info.seq.length - 1 ? (t ? ` · até a próxima: ${tempo(t.s)} (${km(t.m)})` : est && est.min ? ` · até a próxima ~${est.min} min (estimativa)` : '') : '';
        if (x.hosp) return `<div class="item parada fixa"><span class="emoji">🛏️</span><button type="button" class="corpo" data-a="mapa-foco" data-id="${x.l.ID}"><span class="t">${esc(x.l.Nome)}</span><span class="s">saída da hospedagem${prox}</span></button></div>`;
        const n = P.lista.findIndex(y => y.a.ID === x.a.ID) + 1;
        return `<div class="item parada" data-id="${x.a.ID}"><span class="emoji" style="background:${corDia(P.dia)};color:#fff"><b>${n}</b></span>
          <button type="button" class="corpo" data-a="mapa-foco" data-id="${x.l.ID}"><span class="t">${x.a.HoraInicio ? `<span class="mono peq">${esc(x.a.HoraInicio)}</span> ` : ''}${esc(x.a.Titulo)}</span><span class="s">${esc(x.l.Nome)}${prox}</span></button>
          ${linkRota(x.l) ? `<a class="btn peq" href="${linkRota(x.l)}" target="_blank" rel="noopener">Ir</a>` : ''}
          ${podeEditar() && P.lista.length > 1 ? '<span class="alca-arr" aria-label="Arrastar para mudar a ordem" title="Arrastar para mudar a ordem">⠿</span>' : ''}</div>`;
      }).join('')}</div>
      ${podeEditar() && P.lista.length > 1 ? `<p class="mpeq" style="margin:-4px 2px 8px">Arraste ⠿ para mudar a ordem; a rota é refeita sozinha.</p>` : ''}
      ${podeEditar() && P.lista.length > 2 ? '<button class="btn bloco" style="margin-bottom:8px" data-a="rota-otimizar">🔀 Sugerir a ordem mais curta</button>' : ''}` : vazio('Nenhuma atividade com lugar (e coordenadas) neste dia.')}
      ${google.length ? `<div class="botoes" style="margin-top:4px">${google.map((u, k) => `<a class="btn prim" href="${u}" target="_blank" rel="noopener">${google.length > 1 ? 'Google Maps · parte ' + (k + 1) : 'Abrir a rota no Google Maps'}</a>`).join('')}</div>
        <p class="mpeq">${google.length > 1 ? 'O Google Maps no celular aceita poucas paradas por link, por isso a rota foi dividida. ' : ''}No Google Maps você vê o trânsito e pode trocar para transporte público em cada trecho.</p>` : ''}`;
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
  ligarPontosDeInteresse(map);
  ligarToqueLongo(map);
  if (MAPA.pos) mostrarEu();
}

function avisoMapa(txt) { const a = $('#mapa-aviso'); if (a) { a.textContent = txt; a.classList.remove('oculto'); setTimeout(() => a.classList.add('oculto'), 7000); } }

function garantirCamadaRota() {
  const map = MAPA.map;
  if (!map || !map.isStyleLoaded()) return;
  if (!map.getSource('rota')) map.addSource('rota', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // Rota pelas ruas: linha cheia com contorno branco. Sem rota (sem internet): linha reta tracejada.
  if (!map.getLayer('rota-contorno')) map.addLayer({ id: 'rota-contorno', type: 'line', source: 'rota', filter: ['==', ['get', 'tipo'], 'rota'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': 0.9 } });
  if (!map.getLayer('rota-linha')) map.addLayer({ id: 'rota-linha', type: 'line', source: 'rota', filter: ['==', ['get', 'tipo'], 'rota'], layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': ['get', 'cor'], 'line-width': 5 } });
  if (!map.getLayer('rota-reta')) map.addLayer({ id: 'rota-reta', type: 'line', source: 'rota', filter: ['==', ['get', 'tipo'], 'reta'], paint: { 'line-color': ['get', 'cor'], 'line-width': 3, 'line-dasharray': [1.5, 1.2], 'line-opacity': 0.8 } });
}

/** Atualiza linha da rota e marcadores; na primeira vez, enquadra os pontos. */
function desenharPontos(enquadrar) {
  const map = MAPA.map;
  if (!map || !MAPA.ok) return;
  garantirCamadaRota();
  const P = pontosMapa();
  const feats = [];
  if (P.rota) {
    const info = infoRota(P.dia);
    if (info.rota) feats.push({ type: 'Feature', properties: { cor: corDia(P.dia), tipo: 'rota' }, geometry: { type: 'LineString', coordinates: info.rota.coords } });
    else if (info.pontos.length > 1) {
      feats.push({ type: 'Feature', properties: { cor: corDia(P.dia), tipo: 'reta' }, geometry: { type: 'LineString', coordinates: info.pontos } });
      buscarRota(info).then(r => { if (r && estadoMapa().rota && MAPA.map) { desenharPontos(false); const c = $('#mapa-lista-conteudo'); if (c) { c.innerHTML = listaMapaHtml(); ativarArrastarRota(); } } });
    }
  }
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
    if (!E.lista) { const c = $('#mapa-lista-conteudo'); if (c) c.scrollTop = 0; }
    S.ui.ignorarToqueLista = true;
  });
}

/* ---------- ações ---------- */
AC['mapa-lista-pos'] = () => {
  if (S.ui.ignorarToqueLista) { S.ui.ignorarToqueLista = false; return; }
  const E = estadoMapa();
  E.lista = (E.lista + 1) % 3;
  $('#mapa-lista').dataset.pos = E.lista;
  if (!E.lista) { const c = $('#mapa-lista-conteudo'); if (c) c.scrollTop = 0; }
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

/* ============================== rota do dia pelas ruas ============================== */
// Rotas calculadas ficam guardadas no aparelho (e na planilha): sem internet, a última rota continua aparecendo.
let ROTAS = {};
async function carregarRotas() { try { ROTAS = (await idb.get('kv', 'rotas')) || {}; } catch (e) { ROTAS = {}; } }
function guardarRota(chave, r) {
  ROTAS[chave] = Object.assign({ em: Date.now() }, r);
  const ks = Object.keys(ROTAS);
  if (ks.length > 80) ks.sort((a, b) => ROTAS[a].em - ROTAS[b].em).slice(0, ks.length - 80).forEach(k => delete ROTAS[k]);
  idb.set('kv', 'rotas', ROTAS).catch(() => { });
}

/** Paradas do dia em ordem (opcionalmente saindo da hospedagem), modo e rota guardada, se houver. */
function infoRota(dia) {
  const ats = atividadesDoDia(dia).filter(a => { const l = ach('Lugares', a.LugarID); return l && l.Lat !== '' && l.Lat !== undefined; });
  const h = hospedagemDoDia(dia);
  const hosp = h && h.lugar && h.lugar.Lat !== '' && h.lugar.Lat !== undefined ? h.lugar : null;
  const pref = (S.ui.rotaHosp || {})[dia];
  const usarHosp = !!hosp && pref !== false;
  const seq = (usarHosp ? [{ l: hosp, hosp: true }] : []).concat(ats.map(a => ({ l: ach('Lugares', a.LugarID), a })));
  const pontos = seq.map(x => [Number(x.l.Lng), Number(x.l.Lat)]);
  let modo = (S.ui.modoRota || {})[dia];
  if (!modo) {
    // Automático: a pé se todos os trechos forem curtos; senão, carro
    let maior = 0;
    for (let i = 1; i < pontos.length; i++) maior = Math.max(maior, N_distKm(pontos[i - 1][1], pontos[i - 1][0], pontos[i][1], pontos[i][0]));
    modo = maior <= 1.5 ? 'a pé' : 'carro';
  }
  const chave = modo + '|' + pontos.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(';');
  return { dia, seq, pontos, modo, chave, usarHosp, temHosp: !!hosp, rota: pontos.length > 1 ? (ROTAS[chave] || null) : null };
}

const _pedindoRota = {};
async function buscarRota(info) {
  if (info.pontos.length < 2 || info.rota || !navigator.onLine || _pedindoRota[info.chave] || !S.sessao) return null;
  _pedindoRota[info.chave] = true;
  try {
    const r = await api('rota', { pontos: info.pontos, modo: info.modo }, { timeout: 45000 });
    S.ui.erroRota = null;
    guardarRota(info.chave, r);
    return r;
  } catch (e) { S.ui.erroRota = 'Rota indisponível agora (' + e.message + '). Mostrando a linha reta.'; return null; }
  finally { delete _pedindoRota[info.chave]; }
}

/** Tempo até a próxima parada para o roteiro: usa a rota guardada; se não houver, a estimativa em linha reta. */
function trechoApos(dia, atividadeId) {
  const info = infoRota(dia);
  const i = info.seq.findIndex(x => x.a && x.a.ID === atividadeId);
  if (info.rota && i >= 0 && i < info.seq.length - 1 && info.rota.trechos[i]) {
    const t = info.rota.trechos[i];
    return { min: Math.max(1, Math.round(t.s / 60)), km: Math.round(t.m / 100) / 10, modo: info.modo, fonte: 'rota' };
  }
  const d = calc().atividades[atividadeId] || {};
  return d.min ? { min: d.min, km: d.km, modo: d.modo, fonte: 'estimativa' } : null;
}

/** Links do Google Maps com todas as paradas (até 3 paradas intermediárias no celular e 9 no computador; acima disso, divide). */
function linksGoogleRota(info) {
  const pts = info.seq.map(x => x.l.Lat + ',' + x.l.Lng);
  if (pts.length < 2) return [];
  const max = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) ? 3 : 9;
  const tm = { 'a pé': 'walking', carro: 'driving', bicicleta: 'bicycling' }[info.modo] || 'driving';
  const out = [];
  for (let ini = 0; ini < pts.length - 1; ini += max + 1) {
    const parte = pts.slice(ini, ini + max + 2);
    const meio = parte.slice(1, -1);
    out.push('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(parte[0]) + '&destination=' + encodeURIComponent(parte[parte.length - 1]) +
      '&travelmode=' + tm + (meio.length ? '&waypoints=' + encodeURIComponent(meio.join('|')) : ''));
  }
  return out;
}

AC['rota-modo'] = el => {
  const dia = diaDaRota(estadoMapa());
  (S.ui.modoRota = S.ui.modoRota || {})[dia] = el.dataset.m;
  S.ui.erroRota = null;
  TELAS.mapa.atualizar();
};
AC['rota-hosp'] = el => {
  const dia = diaDaRota(estadoMapa());
  (S.ui.rotaHosp = S.ui.rotaHosp || {})[dia] = el.checked;
  TELAS.mapa.atualizar(); desenharPontos(true);
};

/* ---------- mudar a ordem das paradas direto na rota ---------- */
function ativarArrastarRota() {
  const lista = $('#lista-rota');
  if (!lista || !podeEditar() || !$('.alca-arr', lista)) return;
  carregarScript(CFG.sortableJs, 'Sortable').then(Sortable => {
    if (!Sortable || !document.body.contains(lista)) return;
    Sortable.create(lista, { handle: '.alca-arr', draggable: '.parada:not(.fixa)', animation: 150, forceFallback: true, fallbackTolerance: 3,
      onEnd: () => { const dia = diaDaRota(estadoMapa()); S.ui.erroRota = null; reordenarDia(dia, $$('.parada[data-id]', lista).map(e => e.dataset.id), 'Ordem da rota alterada'); } });
  }).catch(() => { /* sem a biblioteca (1º uso sem internet): a ordem muda pelo roteiro */ });
}

/** Ordem mais curta em linha reta entre as paradas do dia (testa todas as combinações até 8 paradas;
    acima disso, vizinho mais próximo). Parte da hospedagem quando ela está marcada como início. */
function ordemMaisCurta(info) {
  const paradas = info.seq.filter(x => x.a);
  const inicio = info.seq.find(x => x.hosp);
  const d = (p, q) => N_distKm(Number(p.l.Lat), Number(p.l.Lng), Number(q.l.Lat), Number(q.l.Lng));
  const custo = ordem => ordem.reduce((s, x, i) => s + (i ? d(ordem[i - 1], x) : inicio ? d(inicio, x) : 0), 0);
  let melhor = paradas.slice(), menor = custo(melhor);
  if (paradas.length <= 8) {
    const permutar = (resto, atual) => {
      if (!resto.length) { const c = custo(atual); if (c < menor - 1e-9) { menor = c; melhor = atual.slice(); } return; }
      for (let i = 0; i < resto.length; i++) { atual.push(resto[i]); permutar(resto.slice(0, i).concat(resto.slice(i + 1)), atual); atual.pop(); }
    };
    permutar(paradas, []);
  } else {
    const resto = paradas.slice(); const ordem = []; let atual = inicio || resto.shift();
    if (!inicio) ordem.push(atual);
    while (resto.length) { resto.sort((p, q) => d(atual, p) - d(atual, q)); atual = resto.shift(); ordem.push(atual); }
    if (custo(ordem) < menor) { melhor = ordem; menor = custo(ordem); }
  }
  return { ids: melhor.map(x => x.a.ID), km: menor, atual: custo(paradas) };
}
AC['rota-otimizar'] = () => {
  const dia = diaDaRota(estadoMapa());
  const o = ordemMaisCurta(infoRota(dia));
  if (o.atual - o.km < 0.05 || o.atual - o.km < o.atual * 0.03) { toast('A ordem atual já é a mais curta (ou quase).'); return; }
  S.ui.erroRota = null;
  reordenarDia(dia, o.ids, `Nova ordem: ~${(o.atual - o.km).toFixed(1).replace('.', ',')} km a menos`);
};

/* ---------- altura do mapa: entre o topo e a barra de baixo ---------- */
function medirTopoMapa() {
  const t = $('.topo');
  if (t) document.documentElement.style.setProperty('--mapa-topo', Math.round(t.getBoundingClientRect().bottom) + 'px');
}
window.addEventListener('resize', () => { if (rotaAtual().nome === 'mapa') { medirTopoMapa(); if (MAPA.map) MAPA.map.resize(); } });

/* ============================== pontos de interesse do mapa base ==============================
   Museus, restaurantes, estações etc. vêm desenhados no fundo do mapa (dados do OpenStreetMap).
   Tocar num deles abre os detalhes e permite salvar em Lugares ou pôr no roteiro. */
const POI_CLASSES = {
  restaurant: ['restaurante', '🍽️', 'Restaurante'], fast_food: ['restaurante', '🍔', 'Lanchonete'], cafe: ['restaurante', '☕', 'Café'],
  bar: ['restaurante', '🍺', 'Bar'], beer: ['restaurante', '🍺', 'Cervejaria'], ice_cream: ['restaurante', '🍦', 'Sorveteria'], bakery: ['restaurante', '🥐', 'Padaria'],
  museum: ['atividade', '🏛️', 'Museu'], attraction: ['atividade', '⭐', 'Atração'], art_gallery: ['atividade', '🖼️', 'Galeria de arte'],
  castle: ['atividade', '🏰', 'Castelo'], monument: ['atividade', '🗿', 'Monumento'], theatre: ['atividade', '🎭', 'Teatro'], cinema: ['atividade', '🎬', 'Cinema'],
  zoo: ['atividade', '🦁', 'Zoológico'], aquarium: ['atividade', '🐠', 'Aquário'], theme_park: ['atividade', '🎢', 'Parque de diversões'], playground: ['atividade', '🛝', 'Parquinho'],
  park: ['interesse', '🌳', 'Parque'], garden: ['interesse', '🌷', 'Jardim'], viewpoint: ['interesse', '🔭', 'Mirante'], place_of_worship: ['interesse', '⛪', 'Templo / igreja'],
  lodging: ['hospedagem', '🛏️', 'Hospedagem'], hotel: ['hospedagem', '🛏️', 'Hotel'],
  railway: ['transporte', '🚆', 'Estação de trem'], bus: ['transporte', '🚌', 'Ponto de ônibus'], tram: ['transporte', '🚋', 'Bonde'], subway: ['transporte', '🚇', 'Metrô'],
  ferry_terminal: ['transporte', '⛴️', 'Barco'], aerialway: ['transporte', '🚡', 'Teleférico'], parking: ['transporte', '🅿️', 'Estacionamento'], fuel: ['transporte', '⛽', 'Posto'],
  shop: ['interesse', '🛍️', 'Loja'], grocery: ['interesse', '🛒', 'Mercado'], supermarket: ['interesse', '🛒', 'Supermercado'], pharmacy: ['interesse', '💊', 'Farmácia'],
  hospital: ['interesse', '🏥', 'Hospital'], toilets: ['interesse', '🚻', 'Banheiro'], information: ['interesse', 'ℹ️', 'Informação turística']
};
function poiDoMapa(map, ponto) {
  const r = 14; // área de toque generosa (dedo)
  let fs = [];
  try { fs = map.queryRenderedFeatures([[ponto.x - r, ponto.y - r], [ponto.x + r, ponto.y + r]]); } catch (e) { return null; }
  const cand = fs.filter(f => f.properties && (f.properties.name || f.properties['name:pt']) && f.geometry && f.geometry.type === 'Point' &&
    /poi|aerodrome|transit|station/i.test(f.sourceLayer || f.layer.id));
  if (!cand.length) return null;
  const d = f => { const p = map.project(f.geometry.coordinates); return Math.hypot(p.x - ponto.x, p.y - ponto.y); };
  const f = cand.sort((a, b) => d(a) - d(b))[0];
  const pr = f.properties;
  const cls = POI_CLASSES[pr.subclass] || POI_CLASSES[pr.class] || ['interesse', '📍', String(pr.subclass || pr.class || 'Ponto de interesse').replace(/_/g, ' ')];
  return { nome: pr['name:pt'] || pr.name, lng: +f.geometry.coordinates[0].toFixed(6), lat: +f.geometry.coordinates[1].toFixed(6), tipo: cls[0], ic: cls[1], cat: cls[2] };
}
function ligarPontosDeInteresse(map) {
  map.on('click', e => {
    const p = poiDoMapa(map, e.point);
    if (!p) return;
    if (S.ui.escolherNoMapa) { pontoNovo({ lat: p.lat, lng: p.lng }); return; } // escolhendo o ponto de um lugar: usa o local tocado
    abrirPoi(p);
  });
  // No computador, a mãozinha indica o que é clicável
  map.on('mousemove', e => { map.getCanvas().style.cursor = poiDoMapa(map, e.point) ? 'pointer' : ''; });
}
function lugarParecido(p) {
  const n = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  return daV('Lugares').find(l => l.Lat !== '' && N_distKm(p.lat, p.lng, +l.Lat, +l.Lng) < 0.12 && (n(l.Nome) === n(p.nome) || N_distKm(p.lat, p.lng, +l.Lat, +l.Lng) < 0.02)) || null;
}
function diaSugeridoPoi(p) {
  const E = estadoMapa();
  if (E.dia) return E.dia;
  if (E.rota) return diaDaRota(E);
  const c = cidadeMaisPerto(p);
  const dias = diasDaViagem();
  const h = hoje();
  const daCid = c ? dias.filter(d => { const cd = cidadeDoDia(d); return cd && cd.ID === c.ID; }) : [];
  return daCid.find(d => d >= h) || daCid[0] || (dias.includes(h) ? h : dias[0]);
}
function cidadeMaisPerto(p) { return daV('Cidades').filter(x => x.Lat !== '').sort((a, b) => N_distKm(p.lat, p.lng, +a.Lat, +a.Lng) - N_distKm(p.lat, p.lng, +b.Lat, +b.Lng))[0] || null; }
function linkGooglePoi(p) {
  const c = cidadeMaisPerto(p);
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.nome + (c ? ', ' + c.Nome : ''));
}

function abrirPoi(p) {
  if (MAPA.temp) MAPA.temp.remove();
  const el = document.createElement('div'); el.innerHTML = `<div class="marcador" style="background:var(--tinta)"><span>${p.ic}</span></div>`;
  MAPA.temp = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 7] }).setLngLat([p.lng, p.lat]).addTo(MAPA.map);
  S.ui.poi = p; S.ui.poiDia = diaSugeridoPoi(p); S.ui.poiDet = null;
  abrirPainel({ titulo: p.nome, render: poiHtml, aoFechar: () => { if (MAPA.temp) { MAPA.temp.remove(); MAPA.temp = null; } S.ui.poi = null; } });
  if (navigator.onLine) {
    api('enderecoDoPonto', { lat: p.lat, lng: p.lng, nome: p.nome, detalhes: true }).then(r => {
      if (S.ui.poi !== p) return;
      S.ui.poiDet = r || {}; pintarPainel();
    }).catch(() => { if (S.ui.poi === p) { S.ui.poiDet = { erro: true }; pintarPainel(); } });
  }
}
function poiHtml() {
  const p = S.ui.poi; if (!p) return '';
  const d = S.ui.poiDet;
  const ja = lugarParecido(p);
  const c = cidadeMaisPerto(p);
  const linha = (ic, html) => `<span>${ic}</span><span>${html}</span>`;
  const det = d && !d.erro ? [
    d.endereco ? linha('📍', esc(d.endereco)) : '',
    d.horario ? linha('🕘', esc(d.horario)) : '',
    d.telefone ? linha('☎️', `<a href="tel:${esc(d.telefone)}">${esc(d.telefone)}</a>`) : '',
    urlSegura(d.site) ? linha('🌐', `<a href="${esc(urlSegura(d.site))}" target="_blank" rel="noopener">${esc(d.site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`) : '',
    urlSegura(d.wikipedia) ? linha('📖', `<a href="${esc(urlSegura(d.wikipedia))}" target="_blank" rel="noopener">Wikipédia</a>`) : '',
    d.acessivel ? linha('♿', esc(d.acessivel)) : ''
  ].join('') : '';
  const dias = diasDaViagem();
  return `<div class="peq" style="margin-top:-6px">${p.ic} ${esc(p.cat)}${c ? ' · ' + esc(c.Nome) : ''}</div>
    ${!navigator.onLine ? '<p class="mpeq">Sem internet: endereço e horários aparecem quando houver sinal.</p>'
      : !d ? '<div class="esq" style="height:56px;margin-top:12px"></div>'
      : `<div class="poi-det">${det || linha('ℹ️', '<span class="peq">Sem mais detalhes no OpenStreetMap. Veja fotos, avaliações e horários no Google Maps.</span>')}</div>`}
    ${ja ? `<div class="aviso info">Já está em Lugares${ja.Status !== 'ideia' ? ' (' + esc(ja.Status) + ')' : ''}. <a href="#" data-a="abrir-lugar" data-id="${ja.ID}">Abrir</a></div>` : ''}
    ${podeEditar() && dias.length ? `<div class="rotulo" style="margin-top:6px">Pôr no roteiro de</div>
      <div class="poi-dias">${dias.map(x => { const o = dataObj(x); return `<button class="chip ${x === S.ui.poiDia ? 'on' : ''}" data-a="poi-dia" data-dia="${x}"><i class="pt" style="background:${corDia(x)}"></i>${DIAS_SEM[o.getDay()]} ${o.getDate()}</button>`; }).join('')}</div>` : ''}
    <div class="botoes" style="margin-top:4px">
      ${podeEditar() ? `<button class="btn prim" data-a="poi-roteiro">🗓️ Pôr no roteiro · ${esc(fmtDiaCurto(S.ui.poiDia))}</button>
        ${ja ? '' : '<button class="btn" data-a="poi-salvar">＋ Salvar em Lugares</button>'}` : ''}
      <a class="btn" href="${linkGooglePoi(p)}" target="_blank" rel="noopener">Ver no Google Maps</a>
    </div>
    <p class="mpeq" style="margin-top:10px">Dados do OpenStreetMap. Fotos e avaliações ficam no Google Maps.</p>`;
}
AC['poi-dia'] = el => { S.ui.poiDia = el.dataset.dia; pintarPainel(); };
function salvarPoiComoLugar(status) {
  const p = S.ui.poi, d = S.ui.poiDet && !S.ui.poiDet.erro ? S.ui.poiDet : {};
  const ja = lugarParecido(p);
  if (ja) { if (status !== 'ideia' && ja.Status === 'ideia') salvar('Lugares', ja.ID, { Status: status }); return ja.ID; }
  const c = cidadeMaisPerto(p);
  const notas = [d.horario ? 'Horário: ' + d.horario : '', d.wikipedia ? d.wikipedia : ''].filter(Boolean).join('\n');
  return salvar('Lugares', null, { Nome: p.nome, Tipo: p.tipo, Status: status, CidadeID: c ? c.ID : '', Endereco: d.endereco || '', Lat: p.lat, Lng: p.lng, FonteCoord: 'toque',
    Link: d.site || '', Telefone: d.telefone || '', Acessibilidade: d.acessivel || '', Notas: notas });
}
AC['poi-salvar'] = () => {
  const p = S.ui.poi; if (!p) return;
  let id;
  emLote('Lugar salvo', () => { id = salvarPoiComoLugar('ideia'); });
  if (id && typeof id === 'object') id = id.ID;
  fecharPainel();
};
AC['poi-roteiro'] = () => {
  const p = S.ui.poi, dia = S.ui.poiDia; if (!p || !dia) return;
  emLote(`Incluído no roteiro de ${fmtDiaCurto(dia)}`, () => {
    let lid = salvarPoiComoLugar('agendado');
    if (lid && typeof lid === 'object') lid = lid.ID;
    const ult = atividadesDoDia(dia).slice(-1)[0];
    salvar('Atividades', null, { Data: dia, Titulo: p.nome, LugarID: lid, Tipo: p.tipo === 'restaurante' ? 'refeição' : 'atividade', Ordem: ult ? Number(ult.Ordem || 0) + 10 : 10 });
  });
  fecharPainel();
  const E = estadoMapa();
  if (E.rota && diaDaRota(E) === dia) { TELAS.mapa.atualizar(); desenharPontos(false); }
};
