/* app-base.js — estado, armazenamento no aparelho, API, fila offline, sincronização, desfazer e componentes de tela. */
'use strict';

const CFG = Object.assign({ intervaloSincSeg: 30 }, window.RUMO_CONFIG || {});
const URLP = new URLSearchParams(location.search);

/* ============================== utilidades ============================== */
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CORES_DIA = ['#1d4ed8', '#b91c1c', '#047857', '#7c3aed', '#b45309', '#0e7490', '#be185d', '#4d7c0f'];
const ICONE_TIPO = { hospedagem: '🛏️', atividade: '⭐', restaurante: '🍽️', transporte: '🚆', interesse: '📍', outro: '•' };
const ICONE_RESERVA = { voo: '✈️', hospedagem: '🛏️', carro: '🚐', trem: '🚆', ingresso: '🎟️', restaurante: '🍽️', outro: '📄' };
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const INSTALADO = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function erroApp(msg, codigo) { const e = new Error(msg); e.codigo = codigo || 'ERRO'; return e; }
function isoLocal(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hoje() { return S.diaSimulado || isoLocal(new Date()); }
function agoraHM() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
function dataObj(iso) { const p = String(iso).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
function somaDias(iso, n) { const d = dataObj(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function diasEntre(a, b) { return Math.round((dataObj(b) - dataObj(a)) / 864e5); }
function fmtDia(iso, ano) { if (!iso) return ''; const d = dataObj(iso); return DIAS_SEM[d.getDay()] + ', ' + d.getDate() + ' ' + MESES[d.getMonth()] + (ano ? ' ' + d.getFullYear() : ''); }
function fmtDiaCurto(iso) { if (!iso) return ''; const d = dataObj(iso); return d.getDate() + ' ' + MESES[d.getMonth()]; }
function fmtDH(s) { if (!s) return ''; return fmtDiaCurto(s.slice(0, 10)) + (s.length > 10 ? ' · ' + s.slice(11, 16) : ''); }
function numBR(v) { if (v === '' || v === null || v === undefined) return null; const n = Number(String(v).trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
function m(cent, moeda) { return N_formatarMoeda(cent, moeda || moedaAcerto()); }
function mv(valor, moeda) { return N_formatarMoeda(Math.round((Number(valor) || 0) * 100), moeda); }
function iniciais(nome) { return String(nome || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase(); }
function corPessoa(id) { const p = ach('Pessoas', id); if (p && p.Cor) return p.Cor; let h = 0; String(id).split('').forEach(c => h = (h * 31 + c.charCodeAt(0)) >>> 0); return CORES_DIA[h % CORES_DIA.length]; }
function avatar(id, tam) { const p = ach('Pessoas', id); return `<span class="avatar" style="background:${esc(corPessoa(id))};${tam ? `width:${tam}px;height:${tam}px;font-size:${tam / 2.6}px` : ''}">${esc(iniciais(p ? (p.Apelido || p.Nome) : '?'))}</span>`; }
function plural(n, s, p) { return n + ' ' + (n === 1 ? s : (p || s + 's')); }
function lsGet(k) { try { return localStorage.getItem('rumo_' + k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v === null) localStorage.removeItem('rumo_' + k); else localStorage.setItem('rumo_' + k, v); } catch (e) { /* sem armazenamento */ } }

/* ============================== armazenamento (IndexedDB) ============================== */
const idb = {
  db: null, mem: { kv: new Map(), arquivos: new Map() }, falhou: false,
  abrir() {
    if (this.db || this.falhou) return Promise.resolve(this.db);
    return new Promise(res => {
      try {
        const r = indexedDB.open('rumo', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('arquivos'); };
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => { this.falhou = true; res(null); };
      } catch (e) { this.falhou = true; res(null); }
    });
  },
  async op(store, modo, fn) {
    const db = await this.abrir();
    if (!db) return fn(null, this.mem[store]);
    return new Promise((res, rej) => {
      const tx = db.transaction(store, modo), os = tx.objectStore(store);
      const q = fn(os);
      tx.oncomplete = () => res(q && q.result);
      tx.onerror = () => rej(tx.error);
    });
  },
  get(store, k) { return this.op(store, 'readonly', (os, mem) => mem ? mem.get(k) : os.get(k)); },
  set(store, k, v) { return this.op(store, 'readwrite', (os, mem) => mem ? mem.set(k, v) : os.put(v, k)); },
  del(store, k) { return this.op(store, 'readwrite', (os, mem) => mem ? mem.delete(k) : os.delete(k)); },
  chaves(store) { return this.op(store, 'readonly', (os, mem) => mem ? { result: Array.from(mem.keys()) } : os.getAllKeys()).then(r => r && r.result ? r.result : r || []); },
  async limpar() { for (const s of ['kv', 'arquivos']) await this.op(s, 'readwrite', (os, mem) => mem ? mem.clear() : os.clear()); }
};

/* ============================== estado ============================== */
const S = {
  sessao: null, api: '', codigo: '', tab: {}, seq: 0, fila: [], enviando: new Set(), conhecidas: [], viagemId: null,
  cotacoes: {}, cotacoesEm: 0, part: {}, ultimaSinc: 0, sincronizando: false, sincDeNovo: false, online: navigator.onLine,
  erroSinc: null, conflitos: [], versaoDados: 0, captura: null, offline: new Set(), ui: {}, instalarEvt: null, diaSimulado: null
};
const CHAVES_ESTADO = ['tab', 'seq', 'fila', 'conhecidas', 'viagemId', 'cotacoes', 'cotacoesEm', 'part', 'ultimaSinc'];

let _salvarT = null;
function salvarLocal() {
  clearTimeout(_salvarT);
  _salvarT = setTimeout(() => {
    const o = {};
    CHAVES_ESTADO.forEach(k => o[k] = S[k]);
    idb.set('kv', 'estado', o).catch(() => { });
  }, 300);
}

/* ============================== acesso aos dados ============================== */
const linhas = aba => Object.values(S.tab[aba] || {});
const vivos = aba => linhas(aba).filter(r => r.Excluido !== 'sim');
const daV = aba => vivos(aba).filter(r => r.ViagemID === S.viagemId);
const ach = (aba, id) => (id && S.tab[aba] ? S.tab[aba][id] : null) || null;
const nomeDe = (aba, id) => { const r = ach(aba, id); return r ? (r.Nome || r.Titulo || '') : ''; };
function viagem() { return ach('Viagens', S.viagemId); }
function moedaAcerto() { const v = viagem(); return v ? v.MoedaAcerto : 'EUR'; }
function euId() { return S.sessao && S.sessao.pessoa ? S.sessao.pessoa.ID : null; }
function participantes() { return daV('Participantes'); }
function minhaPart() { return participantes().find(p => p.PessoaID === euId()); }
function meuPapel() { const p = S.part[S.viagemId]; return p ? p.papel : (minhaPart() || {}).Papel; }
function souOrg() { return meuPapel() === 'organizador'; }
function podeEditar() { const p = meuPapel(); return !!p && p !== 'leitor'; }
function familiaDe(pid) { const p = participantes().find(x => x.PessoaID === pid); return p ? p.FamiliaID : null; }
function minhaFamilia() { return familiaDe(euId()); }
function pessoaNome(id) { const p = ach('Pessoas', id); return p ? (p.Apelido || p.Nome) : '—'; }
function pessoasDaViagem() { return participantes().map(p => ach('Pessoas', p.PessoaID)).filter(Boolean); }
function familiasDaViagem() { const ids = [...new Set(participantes().map(p => p.FamiliaID))]; return ids.map(id => ach('Familias', id)).filter(Boolean); }
function diasDaViagem() { const v = viagem(); return v ? N_dias(v.DataInicio, v.DataFim) : []; }
function corDia(iso) { const i = diasDaViagem().indexOf(iso); return i < 0 ? 'var(--tinta3)' : CORES_DIA[i % CORES_DIA.length]; }
function cidadeDoDia(dia) { return N_cidadeDoDia(daV('Cidades'), dia || hoje()); }
function categorias() { return vivos('Categorias').filter(c => c.Ativo !== 'não').sort((a, b) => (a.Ordem || 99) - (b.Ordem || 99)); }
function minhasViagens() { return vivos('Viagens').filter(v => S.part[v.ID]).sort((a, b) => a.DataInicio.localeCompare(b.DataInicio)); }
function faseViagem() {
  const v = viagem(); if (!v) return 'sem';
  const h = hoje();
  return h < v.DataInicio ? 'antes' : (h > v.DataFim ? 'depois' : 'durante');
}

let _calc = { v: -1 };
const ABAS_CALC = ['Viagens', 'Pessoas', 'Familias', 'Participantes', 'Despesas', 'DespesaPartes', 'Acertos', 'Orcamento', 'Atividades', 'Lugares', 'Cidades', 'Categorias'];
function calc() {
  if (_calc.v === S.versaoDados && _calc.id === S.viagemId) return _calc.r;
  const d = {};
  ABAS_CALC.forEach(a => d[a] = linhas(a));
  _calc = { v: S.versaoDados, id: S.viagemId, r: N_calcular(d, S.viagemId, {}) };
  return _calc.r;
}

/* ============================== cotações provisórias ============================== */
function taxa(de, para) {
  if (!de || !para) return null;
  if (de === para) return 1;
  const c = S.cotacoes;
  if (c[de + '>' + para]) return c[de + '>' + para].taxa;
  if (c[para + '>' + de]) return 1 / c[para + '>' + de].taxa;
  if (c[de + '>EUR'] && c['EUR>' + para]) return c[de + '>EUR'].taxa * c['EUR>' + para].taxa;
  return null;
}
async function atualizarCotacoes(forcar) {
  if (!navigator.onLine || !S.viagemId) return;
  if (!forcar && Date.now() - (S.cotacoesEm || 0) < 6 * 36e5) return;
  const moedas = new Set(['EUR', 'BRL', 'USD', moedaAcerto()]);
  daV('Cidades').forEach(c => c.Moeda && moedas.add(c.Moeda));
  daV('Despesas').forEach(d => moedas.add(d.Moeda));
  const pares = [];
  moedas.forEach(x => { if (x !== moedaAcerto()) pares.push([x, moedaAcerto()]); if (x !== 'BRL') pares.push([x, 'BRL']); });
  try {
    const r = await api('cotacao', { pares, data: hoje() });
    r.forEach(x => { if (x.taxa) S.cotacoes[x.de + '>' + x.para] = { taxa: x.taxa, data: x.data }; });
    S.cotacoesEm = Date.now();
    salvarLocal();
  } catch (e) { /* tenta depois */ }
}

/* ============================== API ============================== */
async function api(acao, dados, opc) {
  const url = S.api || CFG.api;
  if (!url) throw erroApp('Endereço do servidor não configurado. Abra o link de convite.', 'CONFIG');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), (opc && opc.timeout) || 35000);
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl.signal,
      body: JSON.stringify(Object.assign({ acao, token: S.sessao ? S.sessao.token : undefined }, dados || {})) });
  } catch (e) {
    throw erroApp(navigator.onLine ? 'O servidor não respondeu. Tente de novo.' : 'Sem internet agora.', 'REDE');
  } finally { clearTimeout(t); }
  let j;
  try { j = await r.json(); } catch (e) { throw erroApp('Resposta inválida do servidor (código ' + r.status + ').', 'REDE'); }
  if (!j.ok) {
    if (j.codigo === 'SESSAO' && S.sessao && acao !== 'login') sessaoExpirada();
    throw erroApp(j.erro, j.codigo);
  }
  return j.dados;
}

/* ============================== gravação local + fila ============================== */
function novoOpId() { return 'op-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9); }

function enfileirar(op, antes) {
  // Junta com uma operação ainda não enviada do mesmo item (evita conflito consigo mesmo)
  const ant = S.fila.find(x => x.op.aba === op.aba && x.op.id === op.id && !S.enviando.has(x.op.opId) && x.op.acao !== 'excluir' && x.op.acao !== 'restaurar');
  if (ant && op.acao === 'editar') { Object.assign(ant.op.campos, op.campos); return; }
  if (op.acao !== 'criar' && S.fila.some(x => x.op.aba === op.aba && x.op.id === op.id)) op.baseVersao = null;
  S.fila.push({ op, antes });
}

function reaplicarPendentes(aba, id) {
  const r = S.tab[aba] && S.tab[aba][id];
  S.fila.forEach(x => {
    if (x.op.aba !== aba || x.op.id !== id) return;
    if (!r) return;
    if (x.op.acao === 'editar' || x.op.acao === 'criar') Object.assign(r, x.op.campos);
    if (x.op.acao === 'excluir') r.Excluido = 'sim';
    if (x.op.acao === 'restaurar') r.Excluido = 'não';
    r._pendente = true;
  });
}

/** Cria (id vazio) ou edita um registro. Grava no aparelho na hora e põe na fila para o servidor. */
function salvar(aba, id, campos, opc) {
  opc = opc || {};
  const esq = ESQUEMA[aba];
  const criando = !id;
  const v = N_validar(aba, campos, !criando);
  if (!v.ok) throw erroApp(v.erros.join(' · '), 'VALIDACAO');
  const agora = new Date().toISOString();
  let antes = null, linha;
  if (criando) {
    id = N_novoId(esq.prefixo);
    const vid = esq.global ? '' : (aba === 'Viagens' ? id : (campos.ViagemID || S.viagemId));
    linha = Object.assign({}, v.campos, { ID: id, ViagemID: vid, RegistradoEm: agora, AtualizadoEm: agora, AtualizadoPor: euId(), Versao: 0, Excluido: 'não' });
    if (!esq.global && aba !== 'Viagens') v.campos.ViagemID = vid;
  } else {
    const atual = ach(aba, id);
    if (!atual) throw erroApp('Item não encontrado.');
    antes = Object.assign({}, atual);
    linha = Object.assign({}, atual, v.campos, { AtualizadoEm: agora, AtualizadoPor: euId() });
  }
  linha._pendente = true;
  (S.tab[aba] = S.tab[aba] || {})[id] = linha;
  const op = Object.assign({ opId: novoOpId(), aba, acao: criando ? 'criar' : 'editar', id, campos: v.campos, baseVersao: criando ? undefined : antes.Versao }, opc.extra || {});
  enfileirar(op, antes);
  registrarMudanca({ aba, id, acao: op.acao, antes, campos: v.campos }, opc);
  return linha;
}

function excluir(aba, id, opc) {
  opc = opc || {};
  const atual = ach(aba, id);
  if (!atual) return;
  const antes = Object.assign({}, atual);
  // Criação ainda não enviada: some sem ir ao servidor
  const pend = S.fila.findIndex(x => x.op.aba === aba && x.op.id === id && x.op.acao === 'criar' && !S.enviando.has(x.op.opId));
  if (pend >= 0) {
    S.fila = S.fila.filter(x => !(x.op.aba === aba && x.op.id === id));
    delete S.tab[aba][id];
  } else {
    atual.Excluido = 'sim'; atual._pendente = true;
    enfileirar({ opId: novoOpId(), aba, acao: 'excluir', id, baseVersao: antes.Versao }, antes);
  }
  registrarMudanca({ aba, id, acao: 'excluir', antes, recriar: pend >= 0 }, opc);
}

function restaurar(aba, id, opc) {
  const atual = ach(aba, id);
  if (!atual) return;
  const antes = Object.assign({}, atual);
  atual.Excluido = 'não'; atual._pendente = true;
  enfileirar({ opId: novoOpId(), aba, acao: 'restaurar', id, baseVersao: antes.Versao }, antes);
  registrarMudanca({ aba, id, acao: 'restaurar', antes }, opc || {});
}

function registrarMudanca(mud, opc) {
  if (S.captura) S.captura.push(mud);
  else if (!opc.semDesfazer) oferecerDesfazer(opc.msg || mensagemPadrao(mud), [mud]);
  mudou();
  agendarEnvio();
}

function mensagemPadrao(mud) {
  const nomes = { criar: 'Salvo', editar: 'Alterado', excluir: 'Excluído', restaurar: 'Restaurado' };
  return nomes[mud.acao] + (navigator.onLine ? '' : ' no aparelho (sem internet)');
}

/** Agrupa várias gravações num único "Desfazer". */
function emLote(msg, fn) {
  const cap = [];
  S.captura = cap;
  let r;
  try { r = fn(); } finally { S.captura = null; }
  if (cap.length) oferecerDesfazer(msg, cap);
  return r;
}

function desfazer(muds) {
  emLoteSilencioso(() => {
    muds.slice().reverse().forEach(x => {
      if (x.acao === 'criar') excluir(x.aba, x.id, { semDesfazer: true });
      else if (x.acao === 'editar') {
        const volta = {};
        Object.keys(x.campos || {}).forEach(k => volta[k] = x.antes[k] === undefined ? '' : x.antes[k]);
        try { salvar(x.aba, x.id, volta, { semDesfazer: true }); } catch (e) { toast(e.message); }
      } else if (x.acao === 'excluir') {
        if (x.recriar) { (S.tab[x.aba] = S.tab[x.aba] || {})[x.id] = x.antes; const campos = {}; ESQUEMA[x.aba].campos.forEach(c => { if (!c.calc && !c.servidor && x.antes[c.nome] !== undefined) campos[c.nome] = x.antes[c.nome]; }); campos.ViagemID = x.antes.ViagemID; S.fila.push({ op: { opId: novoOpId(), aba: x.aba, acao: 'criar', id: x.id, campos }, antes: null }); }
        else restaurar(x.aba, x.id, { semDesfazer: true });
      } else if (x.acao === 'restaurar') excluir(x.aba, x.id, { semDesfazer: true });
    });
  });
  toast('Desfeito');
  mudou(); agendarEnvio();
}
function emLoteSilencioso(fn) { const c = S.captura; S.captura = []; try { fn(); } finally { S.captura = c; } }

/* ============================== sincronização ============================== */
let _envioT = null;
function agendarEnvio() { clearTimeout(_envioT); _envioT = setTimeout(() => sincronizar(), 600); }

async function sincronizar(opc) {
  opc = opc || {};
  if (!S.sessao) return;
  if (S.sincronizando) { S.sincDeNovo = true; return; }
  if (!navigator.onLine) { S.online = false; atualizarStatus(); return; }
  S.sincronizando = true; atualizarStatus();
  const lote = S.fila.slice(0, 80);
  lote.forEach(x => S.enviando.add(x.op.opId));
  const recusas = [];
  try {
    const r = await api('sincronizar', { ops: lote.map(x => x.op), desde: opc.completa ? 0 : S.seq, viagensConhecidas: opc.completa ? [] : S.conhecidas });
    S.online = true; S.erroSinc = null;
    const porOp = {};
    (r.resultados || []).forEach(x => porOp[x.opId] = x);
    lote.forEach(x => {
      S.enviando.delete(x.op.opId);
      const res = porOp[x.op.opId];
      if (!res) return;
      S.fila = S.fila.filter(y => y !== x);
      if (res.ok) { if (res.linha) aplicarDoServidor(x.op.aba, res.linha); }
      else if (res.conflito) { S.conflitos.push({ op: x.op, servidor: res.linha }); aplicarDoServidor(x.op.aba, res.linha); }
      else { reverter(x); recusas.push(res.erro); }
    });
    if (r.completo) {
      const pend = {};
      S.fila.forEach(x => { const l = ach(x.op.aba, x.op.id); if (l) (pend[x.op.aba] = pend[x.op.aba] || {})[x.op.id] = l; });
      S.tab = {};
      Object.keys(pend).forEach(a => S.tab[a] = Object.assign({}, pend[a]));
    }
    Object.keys(r.linhas || {}).forEach(aba => r.linhas[aba].forEach(l => aplicarDoServidor(aba, l)));
    // participação criada só no aparelho (nova viagem) some quando a do servidor chega
    Object.values(S.tab.Participantes || {}).forEach(p => { if (p._local && !S.fila.some(x => x.op.id === p.ViagemID)) delete S.tab.Participantes[p.ID]; });
    S.seq = r.seq;
    S.part = r.participacoes || {};
    S.conhecidas = Object.keys(S.part);
    escolherViagemPadrao();
    S.ultimaSinc = Date.now();
    mudou();
    if (recusas.length) toast('Não foi salvo: ' + recusas[0], { ms: 9000 });
    if (S.conflitos.length) mostrarConflito();
    atualizarCotacoes();
    guardarAnexosDoDia();
  } catch (e) {
    lote.forEach(x => S.enviando.delete(x.op.opId));
    S.erroSinc = e.message;
    if (e.codigo === 'REDE') S.online = false;
  } finally {
    S.sincronizando = false;
    atualizarStatus();
    if (S.sincDeNovo || (S.fila.length && S.online && !S.erroSinc && lote.length === 80)) { S.sincDeNovo = false; setTimeout(sincronizar, 300); }
    else if (S.sincDeNovo) S.sincDeNovo = false;
  }
}

function aplicarDoServidor(aba, l) {
  if (!l || !l.ID) return;
  (S.tab[aba] = S.tab[aba] || {})[l.ID] = Object.assign({}, l);
  reaplicarPendentes(aba, l.ID);
}

function reverter(x) {
  const { aba, id } = x.op;
  if (!S.tab[aba]) return;
  if (x.antes) S.tab[aba][id] = x.antes; else delete S.tab[aba][id];
  reaplicarPendentes(aba, id);
}

function escolherViagemPadrao() {
  const atual = ach('Viagens', S.viagemId);
  if (S.viagemId && S.part[S.viagemId] && atual && atual.Excluido !== 'sim') return;
  const vs = minhasViagens();
  const h = hoje();
  const esc_ = vs.find(v => v.DataInicio <= h && v.DataFim >= h) || vs.find(v => v.DataFim >= h) || vs[vs.length - 1];
  S.viagemId = esc_ ? esc_.ID : null;
}

function mostrarConflito() {
  const c = S.conflitos[0];
  if (!c || S.ui.conflitoAberto) return;
  S.ui.conflitoAberto = true;
  const esq = ESQUEMA[c.op.aba];
  const campos = Object.keys(c.op.campos || {}).filter(k => esq.porNome[k]);
  const fmtv = (k, v) => { const f = esq.porNome[k]; if (f.tipo === 'ref') return esc(nomeDe(f.aba, v) || v || '—'); return esc(v === '' || v === undefined ? '—' : v); };
  abrirPainel({
    titulo: 'Duas pessoas mudaram o mesmo item',
    html: `<p class="peq">Alguém alterou <b>${esc(c.servidor && (c.servidor.Titulo || c.servidor.Nome || c.servidor.Descricao) || esq.aba)}</b> antes da sua alteração chegar. Escolha o que fica.</p>
      <div class="lista">${campos.map(k => `<div class="item" style="cursor:default"><div class="corpo"><span class="s">${esc(esq.porNome[k].rotulo)}</span>
      <span class="t">Sua: ${fmtv(k, c.op.campos[k])}</span><span class="s">Atual: ${fmtv(k, c.servidor ? c.servidor[k] : '')} ${c.servidor && c.servidor.AtualizadoPor ? '· por ' + esc(pessoaNome(c.servidor.AtualizadoPor)) : ''}</span></div></div>`).join('')}</div>`,
    rodape: `<div class="botoes"><button class="btn" data-a="conflito-servidor">Manter a atual</button><button class="btn prim" data-a="conflito-minha">Usar a minha</button></div>`,
    aoFechar: () => { S.ui.conflitoAberto = false; }
  });
}
const AC = {};
AC['conflito-minha'] = () => {
  const c = S.conflitos.shift();
  S.ui.conflitoAberto = false; fecharPainel();
  if (c.op.acao === 'editar' && c.servidor) {
    S.fila.push({ op: Object.assign({}, c.op, { opId: novoOpId(), baseVersao: c.servidor.Versao }), antes: Object.assign({}, c.servidor) });
    reaplicarPendentes(c.op.aba, c.op.id);
  } else if (c.servidor) S.fila.push({ op: Object.assign({}, c.op, { opId: novoOpId(), baseVersao: c.servidor.Versao }), antes: Object.assign({}, c.servidor) });
  mudou(); agendarEnvio();
  setTimeout(mostrarConflito, 300);
};
AC['conflito-servidor'] = () => { S.conflitos.shift(); S.ui.conflitoAberto = false; fecharPainel(); setTimeout(mostrarConflito, 300); };

/* ============================== anexos no aparelho ============================== */
async function carregarOffline() { try { (await idb.chaves('arquivos')).forEach(k => S.offline.add(k)); } catch (e) { /* ok */ } }
async function baixarAnexo(id) {
  const a = await api('baixarAnexo', { anexoId: id }, { timeout: 60000 });
  await idb.set('arquivos', id, a);
  S.offline.add(id);
  return a;
}
async function obterAnexo(id) {
  const local = await idb.get('arquivos', id);
  if (local) return local;
  if (!navigator.onLine) throw erroApp('Este documento não foi guardado no aparelho e você está sem internet.');
  return baixarAnexo(id);
}
let _guardando = false;
async function guardarAnexosDoDia() {
  if (_guardando || !navigator.onLine || !S.viagemId) return;
  _guardando = true;
  try {
    const h = hoje(), lim = somaDias(h, 3);
    const reservas = daV('Reservas').filter(r => { const i = String(r.Inicio || r.Fim || '').slice(0, 10); return i >= h && i <= lim; }).map(r => r.ID);
    const ativs = daV('Atividades').filter(a => a.Data >= h && a.Data <= lim);
    const ativIds = ativs.map(a => a.ID), lugIds = ativs.map(a => a.LugarID).filter(Boolean);
    const alvo = daV('Anexos').filter(a => a.TemArquivo === 'sim' && !S.offline.has(a.ID) &&
      ((a.VinculoTipo === 'reserva' && reservas.includes(a.VinculoID)) || (a.VinculoTipo === 'atividade' && ativIds.includes(a.VinculoID)) || (a.VinculoTipo === 'lugar' && lugIds.includes(a.VinculoID))));
    for (const a of alvo.slice(0, 10)) { try { await baixarAnexo(a.ID); } catch (e) { break; } }
  } finally { _guardando = false; }
}
function b64ParaBlob(b64, mime) { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
function arquivoParaB64(arq) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(arq); }); }

/** Abre/compartilha um arquivo (base64). No celular usa o menu de compartilhar quando existe. */
async function abrirArquivo(a) {
  const blob = b64ParaBlob(a.base64, a.mime);
  const arq = new File([blob], a.nome || 'arquivo', { type: a.mime });
  if (navigator.canShare && navigator.canShare({ files: [arq] }) && (IOS || /Android/.test(navigator.userAgent))) {
    try { await navigator.share({ files: [arq], title: a.nome }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  if (/^image\//.test(a.mime)) {
    abrirPainel({ titulo: a.nome, html: `<img src="${url}" style="width:100%;border-radius:12px" alt="">` });
  } else {
    const l = document.createElement('a'); l.href = url; l.download = a.nome || 'arquivo'; l.target = '_blank'; document.body.appendChild(l); l.click(); l.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ============================== componentes de tela ============================== */
function toast(msg, opc) {
  opc = opc || {};
  $$('.torrada').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'torrada' + (_painel ? ' no-topo' : ''); t.setAttribute('role', 'status');
  t.innerHTML = `<span style="flex:1">${esc(msg)}</span>${opc.acao ? `<button>${esc(opc.acao)}</button>` : ''}`;
  if (opc.acao) t.querySelector('button').onclick = () => { t.remove(); opc.fn(); };
  document.body.appendChild(t);
  setTimeout(() => t.remove(), opc.ms || (opc.acao ? 7000 : 3500));
}
function oferecerDesfazer(msg, muds) { toast(msg, { acao: 'Desfazer', fn: () => desfazer(muds) }); }

let _painel = null;
function abrirPainel(o) {
  fecharPainel(true);
  const fundo = document.createElement('div'); fundo.className = 'fundo';
  const p = document.createElement('section'); p.className = 'painel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true');
  p.innerHTML = `<div class="alca"><i></i></div><div class="cab"><h2>${esc(o.titulo || '')}</h2><button class="icone-btn" data-a="fechar-painel" aria-label="Fechar">✕</button></div>
    <div class="conteudo"></div>${o.rodape !== undefined ? '<div class="rodape"></div>' : ''}`;
  document.body.append(fundo, p);
  _painel = { el: p, fundo, o };
  pintarPainel();
  fundo.onclick = () => fecharPainel();
  requestAnimationFrame(() => { fundo.classList.add('on'); p.classList.add('on'); });
  // arrastar para baixo para fechar
  const alca = p.querySelector('.alca'); let y0 = null;
  alca.addEventListener('pointerdown', e => { y0 = e.clientY; alca.setPointerCapture(e.pointerId); p.style.transition = 'none'; });
  alca.addEventListener('pointermove', e => { if (y0 !== null) p.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  alca.addEventListener('pointerup', e => { p.style.transition = ''; if (y0 !== null && e.clientY - y0 > 90) fecharPainel(); else p.style.transform = ''; y0 = null; });
  try { history.pushState({ painel: 1 }, ''); } catch (e) { /* ok */ }
  if (o.aoAbrir) o.aoAbrir(p);
  return p;
}
function pintarPainel() {
  if (!_painel) return;
  const { el, o } = _painel;
  const c = el.querySelector('.conteudo');
  c.innerHTML = o.render ? o.render() : (o.html || '');
  if (o.rodape !== undefined) el.querySelector('.rodape').innerHTML = typeof o.rodape === 'function' ? o.rodape() : o.rodape;
  if (o.depois) o.depois(el);
}
function fecharPainel(semHistorico) {
  if (!_painel) return;
  const { el, fundo, o } = _painel;
  _painel = null;
  el.classList.remove('on'); fundo.classList.remove('on');
  setTimeout(() => { el.remove(); fundo.remove(); }, 220);
  if (o.aoFechar) o.aoFechar();
  if (!semHistorico && history.state && history.state.painel) { S.ui.ignorarPop = true; history.back(); }
}
window.addEventListener('popstate', () => { if (S.ui.ignorarPop) { S.ui.ignorarPop = false; return; } if (_painel) fecharPainel(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _painel) fecharPainel(); });
AC['fechar-painel'] = () => fecharPainel();

function confirmar(msg, opc) {
  opc = opc || {};
  return new Promise(res => {
    let resp = false;
    abrirPainel({ titulo: opc.titulo || 'Confirmar', html: `<p>${esc(msg)}</p>`,
      rodape: `<div class="botoes"><button class="btn" data-a="conf-nao">Cancelar</button><button class="btn ${opc.perigo ? 'perigo' : 'prim'}" data-a="conf-sim">${esc(opc.ok || 'Confirmar')}</button></div>`,
      aoFechar: () => res(resp) });
    AC['conf-sim'] = () => { resp = true; fecharPainel(); };
    AC['conf-nao'] = () => fecharPainel();
  });
}

/* ---------- status de sincronização ---------- */
function textoStatus() {
  const n = S.fila.length;
  if (S.sincronizando) return { cls: '', txt: 'enviando…' };
  if (!navigator.onLine || !S.online) return { cls: 'off', txt: n ? `offline · ${n} na fila` : 'offline' };
  if (S.erroSinc) return { cls: 'erro', txt: (n ? n + ' na fila' : 'tentar') };
  if (n) return { cls: 'off', txt: n + ' na fila' };
  if (!S.ultimaSinc) return { cls: '', txt: '—' };
  const min = Math.round((Date.now() - S.ultimaSinc) / 60000);
  return { cls: '', txt: min < 1 ? 'sincronizado' : 'há ' + (min < 60 ? min + ' min' : Math.round(min / 60) + ' h') };
}
function atualizarStatus() {
  const el = $('#status-sinc');
  if (!el) return;
  const s = textoStatus();
  el.className = 'pilula ' + s.cls;
  el.textContent = s.txt;
}
setInterval(atualizarStatus, 30000);
AC['status'] = () => {
  const ult = S.ultimaSinc ? new Date(S.ultimaSinc).toLocaleString('pt-BR') : 'nunca';
  abrirPainel({ titulo: 'Sincronização', render: () => `
    <div class="lista">
      <div class="item"><div class="corpo"><span class="t">Conexão</span><span class="s">${navigator.onLine ? 'com internet' : 'sem internet'}</span></div></div>
      <div class="item"><div class="corpo"><span class="t">Última atualização</span><span class="s">${esc(ult)}</span></div></div>
      <div class="item"><div class="corpo"><span class="t">Alterações aguardando envio</span><span class="s">${S.fila.length ? S.fila.map(x => esc(x.op.aba + ' · ' + x.op.acao)).slice(0, 8).join('<br>') : 'nenhuma'}</span></div></div>
      ${S.erroSinc ? `<div class="item"><div class="corpo"><span class="t">Último erro</span><span class="s">${esc(S.erroSinc)}</span></div></div>` : ''}
    </div>
    <p class="peq">O que você lança sem internet fica guardado no aparelho e é enviado sozinho quando a conexão voltar. Não feche o app pelo gerenciador antes de ver "sincronizado" no topo.</p>`,
    rodape: `<div class="botoes"><button class="btn" data-a="sinc-completa">Recarregar tudo</button><button class="btn prim" data-a="sinc-agora">Atualizar agora</button></div>` });
};
AC['sinc-agora'] = () => { fecharPainel(); S.erroSinc = null; sincronizar(); };
AC['sinc-completa'] = () => { fecharPainel(); S.erroSinc = null; sincronizar({ completa: true }); };

/* ============================== rotas e desenho ============================== */
const TELAS = {};
let _renderPend = false;
function mudou() { S.versaoDados++; salvarLocal(); agendarRender(); }
function agendarRender() {
  if (_renderPend) return;
  _renderPend = true;
  requestAnimationFrame(() => {
    _renderPend = false;
    const foco = document.activeElement;
    const digitando = foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName);
    if (_painel && _painel.o.render && !(digitando && _painel.el.contains(foco))) pintarPainel();
    if (digitando && $('main') && $('main').contains(foco)) return;
    render(true);
  });
}
function rotaAtual() { const h = (location.hash || '#/hoje').slice(2).split('/'); return { nome: h[0] || 'hoje', args: h.slice(1).map(decodeURIComponent) }; }
function ir(h) { if (location.hash === h) render(); else location.hash = h; }
window.addEventListener('hashchange', () => { if (_painel) fecharPainel(true); render(); window.scrollTo(0, 0); });

function render(manterScroll) {
  const app = $('#app');
  if (!S.sessao) { telaLogin(app); return; }
  const r = rotaAtual();
  const tela = TELAS[r.nome] || TELAS.hoje;
  if (!S.viagemId && !['viagens', 'ajuda', 'perfil', 'nova-viagem'].includes(r.nome)) {
    app.innerHTML = casca('', `<div class="vazio"><h2>Nenhuma viagem ainda</h2><p>${S.ultimaSinc ? 'Crie uma viagem ou peça ao organizador para incluir você.' : 'Carregando…'}</p>
      ${S.ultimaSinc ? '<button class="btn prim" data-a="nova-viagem">Criar viagem</button>' : '<div class="esq"></div>'}</div>`, r.nome);
    return;
  }
  // Telas que se atualizam sem redesenhar (ex.: o mapa não deve "piscar" a cada sincronização)
  if (manterScroll && tela.atualizar && $('main') && tela.atualizar(r.args)) { atualizarStatus(); return; }
  let out;
  try { out = tela(r.args); } catch (e) { console.error(e); out = { html: telaErro(e) }; }
  if (typeof out === 'string') out = { html: out };
  const y = window.scrollY;
  app.innerHTML = casca(out.titulo, out.html, r.nome, out.largo);
  if (manterScroll) window.scrollTo(0, y);
  if (out.depois) out.depois(app);
  atualizarStatus();
}
function telaErro(e) {
  return `<div class="vazio"><h2>Algo deu errado nesta tela</h2><p class="peq">${esc(e.message)}</p><button class="btn prim" data-a="recarregar">Tentar de novo</button></div>`;
}
AC['recarregar'] = () => location.reload();

function casca(titulo, html, rota, largo) {
  const v = viagem();
  const nav = [['hoje', '☀️', 'Hoje'], ['plano', '🗓️', 'Plano'], null, ['mapa', '🗺️', 'Mapa'], ['contas', '💶', 'Contas']];
  const ativa = rota;
  // No computador o menu lateral mostra também as seções que no celular ficam em "Mais"
  const extra = [['reservas', '🎫', 'Reservas'], ['tarefas', '☑️', 'Tarefas'], ['docs', '📎', 'Documentos'], ['lugares', '📍', 'Lugares'], ['checklists', '🧳', 'Malas'], ['grupo', '👥', 'Grupo'], ['perfil', '⚙️', 'Ajustes']];
  return `<header class="topo">
      <button class="viagem-btn" data-a="mais" aria-label="Abrir menu da viagem">
        <span class="bola">${esc(v ? iniciais(v.Nome).slice(0, 1) : 'R')}</span>
        <span style="min-width:0"><b>${esc(v ? v.Nome : 'Rumo')}</b><small>${esc(titulo || (v ? fmtDiaCurto(v.DataInicio) + ' – ' + fmtDiaCurto(v.DataFim) : ''))}</small></span>
      </button>
      <button id="status-sinc" class="pilula" data-a="status" aria-live="polite"></button>
      <button class="icone-btn" data-a="ajuda" aria-label="Ajuda">?</button>
    </header>
    <main class="${largo ? 'largo' : ''}">${html}</main>
    <nav class="barra" aria-label="Navegação">${nav.map(n => n ? `<a href="#/${n[0]}" class="${ativa === n[0] ? 'ativo' : ''}"><span class="ic">${n[1]}</span>${n[2]}</a>`
      : `<div class="fab-casa"><button class="fab" data-a="mais-criar" aria-label="Adicionar"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="fab-txt">Adicionar</span></button></div>`).join('')}
      <span class="so-pc rotulo-lateral">Viagem</span>${extra.map(n => `<a href="#/${n[0]}" class="so-pc ${ativa === n[0] ? 'ativo' : ''}"><span class="ic">${n[1]}</span>${n[2]}</a>`).join('')}</nav>`;
}

/* ---------- cliques: um único ouvinte para tudo que tem data-a ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const fn = AC[el.dataset.a];
  if (!fn) return;
  e.preventDefault();
  try {
    const r = fn(el, e);
    if (r && r.catch) r.catch(err => toast(err.message, { ms: 7000 }));
  } catch (err) { console.error(err); toast(err.message, { ms: 7000 }); }
});

/* ============================== tema e preferências ============================== */
const PALETAS = [
  ['neutro', 'Linha (padrão)', '#f8f8f9', '#2445c4'], ['grafite', 'Grafite', '#f8f8f9', '#0e1116'], ['oceano', 'Oceano', '#f6f9fa', '#0f6e6e'],
  ['floresta', 'Floresta', '#f7f8f6', '#2f6b3f'], ['terracota', 'Terracota', '#faf8f6', '#b4532a'], ['ameixa', 'Ameixa', '#f9f8fa', '#6b3e8c'],
  ['rosa', 'Rosa', '#fbf8f9', '#a8326a'], ['caderno', 'Papel', '#f6f4ef', '#3e6b57']
];
const FONTES = [
  ['geist', 'Geist (padrão)', 'Limpa e precisa, com números bem alinhados', null],
  ['sistema', 'Sistema', 'A do próprio celular: San Francisco no iPhone, Roboto no Android', null],
  ['inter', 'Inter', 'Neutra e muito legível em telas', 'Inter:wght@400;500;600;700'],
  ['plex', 'IBM Plex Sans', 'Técnica e sóbria', 'IBM+Plex+Sans:wght@400;500;600;700'],
  ['source', 'Source Sans 3', 'Leve, boa para textos longos', 'Source+Sans+3:wght@400;500;600;700'],
  ['classica', 'Clássica', 'Títulos com serifa discreta', 'Source+Serif+4:opsz,wght@8..60,500;8..60,600'],
  ['editorial', 'Editorial', 'Títulos com serifa marcante', 'Fraunces:opsz,wght@9..144,500;9..144,600']
];
function carregarFonte(id) {
  const f = FONTES.find(x => x[0] === id);
  if (!f || !f[3] || document.querySelector(`link[data-fonte="${id}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.dataset.fonte = id;
  l.href = 'https://fonts.googleapis.com/css2?family=' + f[3] + '&display=swap';
  document.head.appendChild(l);
}
function aplicarTema() {
  const raiz = document.documentElement;
  const t = lsGet('tema') || 'auto';
  if (t === 'auto') delete raiz.dataset.tema; else raiz.dataset.tema = t;
  const p = lsGet('paleta') || 'neutro';
  if (p === 'neutro') delete raiz.dataset.paleta; else raiz.dataset.paleta = p;
  const f = lsGet('fonte') || 'geist';
  if (f === 'geist') delete raiz.dataset.fonte; else { raiz.dataset.fonte = f; carregarFonte(f); }
  raiz.dataset.letra = lsGet('letra') || '0';
  const meta = $('meta[name=theme-color]');
  if (meta) requestAnimationFrame(() => { meta.content = getComputedStyle(document.body || raiz).backgroundColor || '#ffffff'; });
}

/* ============================== sessão ============================== */
function sessaoExpirada() {
  S.sessao = null;
  idb.del('kv', 'sessao').catch(() => { });
  toast('Sua sessão expirou. Entre de novo com o PIN.', { ms: 8000 });
  render();
}

async function sair() {
  try { await api('sair', {}); } catch (e) { /* sai mesmo sem internet */ }
  S.sessao = null; S.tab = {}; S.fila = []; S.seq = 0; S.viagemId = null; S.offline.clear(); S.conhecidas = []; S.part = {};
  await idb.limpar().catch(() => { });
  await idb.set('kv', 'conexao', { api: S.api, codigo: S.codigo }).catch(() => { });
  location.hash = '#/hoje';
  render();
}

/* ============================== instalação e atualização ============================== */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.instalarEvt = e; });
function registrarSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('Nova versão do app disponível.', { acao: 'Atualizar', ms: 20000, fn: () => { nw.postMessage('ativar'); } });
        }
      });
    });
    setInterval(() => reg.update().catch(() => { }), 60 * 60 * 1000);
  }).catch(() => { });
  // Recarrega só quando uma versão NOVA assume (na primeira instalação não há o que recarregar)
  let tinhaControlador = !!navigator.serviceWorker.controller, recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaControlador) { tinhaControlador = true; return; }
    if (!recarregou) { recarregou = true; location.reload(); }
  });
}

/* ============================== início ============================== */
async function iniciar() {
  aplicarTema();
  const conexao = await idb.get('kv', 'conexao').catch(() => null) || {};
  S.api = URLP.get('api') || lsGet('api') || conexao.api || CFG.api || '';
  S.codigo = (URLP.get('g') || lsGet('codigo') || conexao.codigo || '').toUpperCase();
  if (URLP.get('api') || URLP.get('g')) { lsSet('api', S.api); lsSet('codigo', S.codigo); idb.set('kv', 'conexao', { api: S.api, codigo: S.codigo }).catch(() => { }); }
  try {
    const s = await idb.get('kv', 'sessao');
    if (s && s.token) S.sessao = s;
    const e = await idb.get('kv', 'estado');
    if (e) CHAVES_ESTADO.forEach(k => { if (e[k] !== undefined) S[k] = e[k]; });
  } catch (e) { /* começa vazio */ }
  await carregarOffline();
  if (typeof carregarRotas === 'function') await carregarRotas();
  escolherViagemPadrao();
  render();
  registrarSW();
  if (S.sessao) sincronizar();
  setInterval(() => { if (document.visibilityState === 'visible' && S.sessao) sincronizar(); }, (CFG.intervaloSincSeg || 30) * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.sessao) sincronizar(); });
  window.addEventListener('online', () => { S.online = true; atualizarStatus(); sincronizar(); });
  window.addEventListener('offline', () => { S.online = false; atualizarStatus(); });
}
document.addEventListener('DOMContentLoaded', () => { iniciar(); });
