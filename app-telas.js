/* app-telas.js — login, Hoje, Plano, Contas e os módulos do menu "Mais". */
'use strict';

/* ============================== auxiliares ============================== */
function mensagem(nome) { const x = vivos('Mensagens').find(r => r.Nome === nome); return x ? x.Texto : ''; }
function abrirWhats(texto) { window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank'); }
function linkRota(l) { if (!l || l.Lat === '' || l.Lat === undefined) return null; const k = N_linksMapa(l.Lat, l.Lng, l.Nome); return IOS ? k.appleRota : k.googleRota; }
function botoesMapa(l) {
  if (!l || l.Lat === '' || l.Lat === undefined) return l && l.Endereco ? `<a class="btn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.Endereco)}" target="_blank" rel="noopener">Abrir endereço no mapa</a>` : '';
  const k = N_linksMapa(l.Lat, l.Lng, l.Nome);
  return `<div class="botoes"><a class="btn" href="${k.appleRota}" target="_blank" rel="noopener"> Apple Maps</a><a class="btn" href="${k.googleRota}" target="_blank" rel="noopener">Google Maps</a><a class="btn" href="${k.waze}" target="_blank" rel="noopener">Waze</a></div>`;
}
function itemHtml(o) {
  return `<${o.a ? 'button type="button"' : 'div'} class="item ${o.pend ? 'pendente' : ''}" ${o.a ? `data-a="${o.a}"` : ''} ${o.id ? `data-id="${esc(o.id)}"` : ''} ${o.extra || ''}>
    ${o.ic !== undefined ? `<span class="emoji" ${o.cor ? `style="background:${o.cor};color:#fff"` : ''}>${o.ic}</span>` : ''}
    <span class="corpo"><span class="t">${o.t}</span>${o.s ? `<span class="s">${o.s}</span>` : ''}</span>${o.v !== undefined ? `<span class="v">${o.v}</span>` : ''}</${o.a ? 'button' : 'div'}>`;
}
function vazio(txt, botao) { return `<div class="vazio"><p>${txt}</p>${botao || ''}</div>`; }
function avisosCalc() {
  const r = calc();
  return r.avisos.slice(0, 3).map(a => `<div class="aviso alerta">⚠️ ${esc(a.msg)}</div>`).join('');
}
function hospedagemDoDia(dia) {
  const r = daV('Reservas').find(x => x.Tipo === 'hospedagem' && String(x.Inicio || '').slice(0, 10) <= dia && String(x.Fim || '9999').slice(0, 10) > dia);
  if (r) return { reserva: r, lugar: ach('Lugares', r.LugarID) };
  const c = cidadeDoDia(dia);
  const l = c && daV('Lugares').find(x => x.Tipo === 'hospedagem' && x.CidadeID === c.ID && x.Status !== 'ideia');
  return l ? { reserva: null, lugar: l } : null;
}
function cidadesSemHospedagem() {
  return daV('Cidades').filter(c => !daV('Reservas').some(r => r.Tipo === 'hospedagem' && ((ach('Lugares', r.LugarID) || {}).CidadeID === c.ID ||
    (c.Chegada && String(r.Inicio || '').slice(0, 10) >= c.Chegada && String(r.Inicio || '').slice(0, 10) < (c.Saida || '9999')))));
}
function atividadesDoDia(dia) { return N_ordenarAtividades(daV('Atividades').filter(a => a.Data === dia)); }
function diaCarregado(dia) {
  const l = atividadesDoDia(dia).filter(a => a.Tipo !== 'pausa');
  const r = calc().atividades;
  const min = l.reduce((s, a) => s + (Number((r[a.ID] || {}).min) || 0), 0);
  return l.length > 4 || min > 120 ? `${l.length} atividades${min ? ' · ~' + min + ' min de deslocamento' : ''}` : '';
}

/* ============================== LOGIN ============================== */
function telaLogin(app) {
  const L = S.ui.login = S.ui.login || { etapa: null, pessoas: null, pessoa: null, pin: '', erro: '' };
  if (!S.api || !S.codigo) L.etapa = 'convite';
  else if (IOS && !INSTALADO && !lsGet('pularInstalar') && L.etapa !== 'pessoas' && L.etapa !== 'pin') L.etapa = 'instalar';
  else if (!L.etapa || L.etapa === 'convite' || L.etapa === 'instalar') L.etapa = 'pessoas';
  const marca = `<div class="marca"><div class="logo"><img src="icones/icone.svg" width="36" height="36" alt=""></div><div><h1>Rumo</h1><div class="peq">a viagem da família num lugar só</div></div></div>`;
  let corpo = '';
  if (L.etapa === 'convite') {
    corpo = `<div class="cartao"><h2>Abra pelo link de convite</h2><p class="peq">O organizador da viagem envia um link (pelo WhatsApp, por exemplo). Toque nele, ou cole aqui:</p>
      <label class="campo"><span>Link de convite</span><input id="convite" placeholder="https://…?g=…&api=…" autocomplete="off"></label>
      <button class="btn prim bloco" data-a="login-convite">Continuar</button></div>`;
  } else if (L.etapa === 'instalar') {
    corpo = `<div class="cartao"><h2>Instale na tela de início</h2><p class="peq">No iPhone, isso é necessário para o app funcionar sem internet e não perder os dados.</p>
      <ol class="passos-instalar"><li><span>No <b>Safari</b>, toque no botão <b>Compartilhar</b> (quadrado com seta para cima).</span></li>
      <li><span>Role e toque em <b>Adicionar à Tela de Início</b>.</span></li><li><span>Abra o <b>Rumo</b> pelo ícone novo e entre com seu PIN.</span></li></ol>
      <button class="btn bloco" data-a="login-pular">Continuar no navegador por enquanto</button></div>`;
  } else if (L.etapa === 'pessoas') {
    if (!L.pessoas) {
      corpo = '<div class="esq"></div><div class="esq"></div>';
      api('pessoasLogin', { codigo: S.codigo }).then(p => { L.pessoas = p; L.erro = ''; render(); })
        .catch(e => { L.pessoas = []; L.erro = e.message; if (e.codigo === 'CODIGO') { S.codigo = ''; lsSet('codigo', null); } render(); });
    } else {
      corpo = `<h2 style="margin-bottom:12px">Quem é você?</h2>${L.erro ? `<div class="aviso erro">${esc(L.erro)}</div><button class="btn" data-a="login-tentar">Tentar de novo</button>` : ''}
        <div class="pessoas">${L.pessoas.map(p => `<button class="pessoa-btn" data-a="login-pessoa" data-id="${p.ID}"><span class="avatar" style="background:${esc(p.Cor || corPessoa(p.ID))}">${esc(iniciais(p.Apelido || p.Nome))}</span>${esc(p.Apelido || p.Nome)}</button>`).join('')}</div>
        ${!IOS && S.instalarEvt ? '<button class="btn bloco" style="margin-top:16px" data-a="instalar">Instalar o app neste aparelho</button>' : ''}`;
    }
  } else if (L.etapa === 'pin') {
    const p = L.pessoa;
    corpo = `<button class="btn" data-a="login-voltar">← ${esc(p.Apelido || p.Nome)}</button>
      <h2 style="text-align:center;margin-top:18px">Digite seu PIN</h2>
      ${!p.temPin ? '<div class="aviso alerta" style="margin-top:12px">Seu PIN ainda não foi definido. Peça ao organizador um PIN provisório.</div>' : ''}
      <div class="pin-pontos">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < L.pin.length ? 'on' : ''}" ${i >= 4 && L.pin.length < 5 && i >= L.pin.length ? 'style="opacity:.3"' : ''}></i>`).join('')}</div>
      ${L.erro ? `<div class="aviso erro" style="text-align:center">${esc(L.erro)}</div>` : ''}
      <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-a="pin-tecla" data-n="${n}">${n}</button>`).join('')}
        <button data-a="pin-apagar" aria-label="Apagar">⌫</button><button data-a="pin-tecla" data-n="0">0</button><button data-a="pin-ok" style="background:var(--acao);color:var(--acao-txt)" ${L.pin.length < 4 ? 'disabled' : ''}>OK</button></div>`;
  }
  app.innerHTML = `<div class="login">${marca}${corpo}</div>`;
}
AC['login-convite'] = () => {
  const v = ($('#convite').value || '').trim();
  try {
    const u = new URL(v);
    const g = u.searchParams.get('g'), a = u.searchParams.get('api');
    if (!g || !a) throw new Error();
    S.codigo = g.toUpperCase(); S.api = a;
    lsSet('codigo', S.codigo); lsSet('api', S.api);
    idb.set('kv', 'conexao', { api: S.api, codigo: S.codigo }).catch(() => { });
    S.ui.login = null; render();
  } catch (e) { toast('Link inválido. Copie o link completo enviado pelo organizador.'); }
};
AC['login-pular'] = () => { lsSet('pularInstalar', '1'); S.ui.login.etapa = 'pessoas'; render(); };
AC['login-tentar'] = () => { S.ui.login.pessoas = null; render(); };
AC['login-pessoa'] = el => { const L = S.ui.login; L.pessoa = L.pessoas.find(p => p.ID === el.dataset.id); L.pin = ''; L.erro = ''; L.etapa = 'pin'; render(); };
AC['login-voltar'] = () => { S.ui.login.etapa = 'pessoas'; render(); };
AC['pin-tecla'] = el => { const L = S.ui.login; if (L.pin.length < 6) L.pin += el.dataset.n; L.erro = ''; render(); if (L.pin.length === 6) AC['pin-ok'](); };
AC['pin-apagar'] = () => { const L = S.ui.login; L.pin = L.pin.slice(0, -1); render(); };
AC['pin-ok'] = async () => {
  const L = S.ui.login;
  if (L.pin.length < 4 || L.enviando) return;
  L.enviando = true;
  try {
    const r = await api('login', { codigo: S.codigo, pessoaId: L.pessoa.ID, pin: L.pin, aparelho: navigator.userAgent.slice(0, 100) });
    S.sessao = { token: r.token, pessoa: r.pessoa };
    await idb.set('kv', 'sessao', S.sessao);
    S.ui.login = null;
    if (L.pin.length && L.pessoa) S.ui.trocarPinSugerido = true;
    render();
    await sincronizar({ completa: true });
    if (r.pessoa) toast('Olá, ' + (r.pessoa.Apelido || r.pessoa.Nome) + '!');
  } catch (e) { L.erro = e.message; L.pin = ''; render(); } finally { L.enviando = false; }
};
AC['instalar'] = async () => { if (S.instalarEvt) { S.instalarEvt.prompt(); S.instalarEvt = null; } };

/* ============================== HOJE ============================== */
TELAS.hoje = () => {
  const v = viagem();
  const fase = faseViagem();
  if (fase === 'antes') return hojeAntes(v);
  if (fase === 'depois') return hojeDepois(v);
  return hojeDurante(v);
};

function hojeAntes(v) {
  const h = hoje();
  const faltam = diasEntre(h, v.DataInicio);
  const cids = daV('Cidades').sort((a, b) => String(a.Chegada).localeCompare(String(b.Chegada)));
  const r = calc();
  const pend = [];
  cidadesSemHospedagem().forEach(c => pend.push(itemHtml({ a: 'nova-reserva', id: c.ID, ic: '🛏️', t: 'Hospedagem em ' + esc(c.Nome), s: 'ainda não registrada · ' + esc(fmtDiaCurto(c.Chegada)) + ' a ' + esc(fmtDiaCurto(c.Saida)) })));
  daV('Votacoes').filter(x => x.Status === 'aberta').forEach(x => {
    const votei = daV('Votos').some(vv => vv.VotacaoID === x.ID && vv.PessoaID === euId());
    pend.push(itemHtml({ a: 'abrir-votacao', id: x.ID, ic: '🗳️', t: esc(x.Pergunta), s: (votei ? 'você já votou' : '<b>falta o seu voto</b>') + (x.Prazo ? ' · até ' + fmtDiaCurto(x.Prazo) : '') }));
  });
  daV('Tarefas').filter(t => t.Status !== 'feito' && t.Prazo && t.Prazo <= somaDias(h, 14)).sort((a, b) => a.Prazo.localeCompare(b.Prazo)).slice(0, 6).forEach(t => {
    pend.push(itemHtml({ a: 'abrir-tarefa', id: t.ID, ic: t.Prazo < h ? '⏰' : '☑️', t: esc(t.Titulo), s: (t.Prazo < h ? '<b style="color:var(--erro)">atrasada</b> · ' : '') + fmtDia(t.Prazo) + ' · ' + esc(t.ResponsavelID ? pessoaNome(t.ResponsavelID) : 'sem responsável') }));
  });
  daV('Reservas').filter(x => (x.PrazoCancelamento && x.PrazoCancelamento >= h && x.PrazoCancelamento <= somaDias(h, 30)) || (x.Pagamento !== 'pago' && x.PrazoPagamento && x.PrazoPagamento <= somaDias(h, 30))).forEach(x => {
    pend.push(itemHtml({ a: 'abrir-reserva', id: x.ID, ic: '⏳', t: esc(x.Titulo), s: (x.PrazoCancelamento ? 'cancelamento grátis até ' + fmtDiaCurto(x.PrazoCancelamento) : '') + (x.Pagamento !== 'pago' && x.PrazoPagamento ? ' · pagar até ' + fmtDiaCurto(x.PrazoPagamento) : '') }));
  });
  const orc = r.orcamento.categoria.reduce((a, o) => ({ o: a.o + o.orcado, g: a.g + o.gasto }), { o: 0, g: 0 });
  const ideias = daV('Lugares').filter(l => l.Status === 'ideia').length;
  return {
    html: `${S.ui.trocarPinSugerido ? '<div class="aviso info">Se você entrou com um PIN provisório, troque por um seu em <a href="#/perfil">Ajustes</a>.</div>' : ''}
      <div class="cartao" style="text-align:center;padding:22px 14px">
        <div class="peq">${faltam === 1 ? 'falta' : 'faltam'}</div><div class="grande">${faltam}</div><div class="peq">${faltam === 1 ? 'dia' : 'dias'} · ${esc(fmtDia(v.DataInicio, true))}</div>
        ${cids.length ? `<div class="chips" style="justify-content:center;margin-top:12px;flex-wrap:wrap">${cids.map((c, i) => `<span class="chip" style="cursor:default">${esc(c.Nome)} <span class="mpeq">${c.Chegada && c.Saida ? diasEntre(c.Chegada, c.Saida) + ' noites' : ''}</span></span>${i < cids.length - 1 ? '<span style="align-self:center">→</span>' : ''}`).join('')}</div>`
        : `<p class="peq" style="margin-top:10px">Comece pelas cidades da viagem.</p><a class="btn prim" href="#/viagem">Adicionar cidades</a>`}
      </div>
      ${avisosCalc()}
      <div class="secao-topo"><div class="rotulo">O que falta decidir ou reservar</div><span class="etiqueta ${pend.length ? 'alerta' : 'ok'}">${pend.length || 'nada'}</span></div>
      ${pend.length ? `<div class="lista">${pend.join('')}</div>` : '<div class="cartao peq">Tudo em dia por aqui. 🎉</div>'}
      <div class="rotulo">Atalhos</div>
      <div class="grade">
        <button data-a="nova-despesa"><span class="ic">💶</span>Lançar despesa</button>
        <button data-a="novo-lugar"><span class="ic">📍</span>Ideia de lugar<span class="mpeq">${ideias} salvas</span></button>
        <a href="#/plano"><span class="ic">🗓️</span>Roteiro</a>
        <a href="#/reservas"><span class="ic">🎫</span>Reservas</a>
        <a href="#/checklists"><span class="ic">🧳</span>Malas</a>
        <a href="#/contas/orcamento"><span class="ic">📊</span>Orçamento${orc.o ? `<span class="mpeq">${Math.round(orc.g * 100 / orc.o)}% usado</span>` : ''}</a>
      </div>`
  };
}

function hojeDurante(v) {
  const h = hoje(), agora = agoraHM();
  const cid = cidadeDoDia(h);
  const n = diasEntre(v.DataInicio, h) + 1, total = diasEntre(v.DataInicio, v.DataFim) + 1;
  const ats = atividadesDoDia(h);
  // Próximo compromisso: o primeiro que começa a partir de 30 min atrás (assim o que está acontecendo agora continua aparecendo)
  const minutos = hm => { const p = String(hm).split(':'); return Number(p[0]) * 60 + Number(p[1]); };
  const agoraMin = h === isoLocal(new Date()) ? minutos(agora) : 0;
  const prox = ats.find(a => a.HoraInicio && minutos(a.HoraInicio) >= agoraMin - 30) || (agoraMin === 0 ? ats[0] : null) || null;
  const amanha = somaDias(h, 1);
  const primeiroAmanha = !prox && h < v.DataFim ? atividadesDoDia(amanha)[0] : null;
  const hosp = hospedagemDoDia(h);
  const bilhetes = daV('Reservas').filter(r => String(r.Inicio || '').slice(0, 10) === h && r.Tipo !== 'hospedagem');
  const r = calc();
  const fam = minhaFamilia();
  const saldo = fam && r.familia[fam] ? r.familia[fam].saldo : 0;
  const lugarProx = prox && ach('Lugares', prox.LugarID);
  const carregado = diaCarregado(h);
  return {
    titulo: `dia ${n} de ${total}${cid ? ' · ' + cid.Nome : ''}`,
    html: `${avisosCalc()}
      <div class="cartao" style="border-left:6px solid ${corDia(h)}">
        <div class="peq">${prox ? 'Próximo' : 'Hoje'} · ${esc(fmtDia(h))}</div>
        ${prox ? `<h2 style="margin:4px 0">${esc(prox.HoraInicio || '')} ${esc(prox.Titulo)}</h2><div class="peq">${lugarProx ? esc(lugarProx.Nome) + (lugarProx.Endereco ? ' · ' + esc(lugarProx.Endereco) : '') : ''}</div>
          <div class="botoes" style="margin-top:12px">${linkRota(lugarProx) ? `<a class="btn prim" href="${linkRota(lugarProx)}" target="_blank" rel="noopener">Ir ➜</a>` : ''}<button class="btn" data-a="abrir-atividade" data-id="${prox.ID}">Detalhes</button></div>`
        : ats.length ? `<h2 style="margin:4px 0">Roteiro de hoje concluído</h2><p class="peq">${primeiroAmanha ? 'Amanhã: ' + esc(primeiroAmanha.HoraInicio || '') + ' ' + esc(primeiroAmanha.Titulo) : 'Bom descanso!'}</p><a class="btn" href="#/plano/${primeiroAmanha ? amanha : h}">Ver roteiro</a>`
        : `<h2 style="margin:4px 0">Dia livre</h2><p class="peq">Nada marcado no roteiro de hoje.</p><a class="btn" href="#/plano/${h}">Ver roteiro</a>`}
      </div>
      ${carregado ? `<div class="aviso alerta">Dia puxado: ${esc(carregado)}. Vale prever uma pausa para as crianças e os mais velhos.</div>` : ''}
      ${hosp ? `<div class="cartao toque" data-a="${hosp.reserva ? 'abrir-reserva' : 'abrir-lugar'}" data-id="${hosp.reserva ? hosp.reserva.ID : hosp.lugar.ID}">
        <div class="cartao-topo"><span class="emoji">🛏️</span><div><div class="peq">Hospedagem de hoje</div><h3>${esc(hosp.reserva ? hosp.reserva.Titulo : hosp.lugar.Nome)}</h3>
        <div class="peq">${esc(hosp.lugar ? hosp.lugar.Endereco || '' : '')}</div>${hosp.lugar && hosp.lugar.Telefone ? `<a href="tel:${esc(hosp.lugar.Telefone)}" class="peq">☎ ${esc(hosp.lugar.Telefone)}</a>` : ''}
        ${hosp.reserva && hosp.reserva.Codigo ? `<div class="codigo" style="margin-top:6px">${esc(hosp.reserva.Codigo)}</div>` : ''}</div></div></div>` : ''}
      ${bilhetes.length ? `<div class="rotulo">Bilhetes de hoje</div>${bilhetes.map(bilheteHtml).join('')}` : ''}
      <div class="cartao toque" data-a="ir" data-h="#/contas">
        <div class="cartao-topo"><span class="emoji">💶</span><div><div class="peq">Saldo da sua família</div>
        <div class="grande ${saldo >= 0 ? 'valor-pos' : 'valor-neg'}" style="font-size:2rem">${m(Math.abs(saldo))}</div><div class="peq">${saldo > 0 ? 'a receber' : saldo < 0 ? 'a pagar' : 'tudo acertado'}</div></div></div></div>
      <div class="secao-topo"><div class="rotulo">Roteiro de hoje</div><a href="#/plano/${h}" class="peq">abrir</a></div>
      ${ats.length ? `<div class="lista">${ats.map(a => itemHtml({ a: 'abrir-atividade', id: a.ID, ic: a.HoraInicio ? `<b style="font-size:.8rem">${esc(a.HoraInicio)}</b>` : '•', t: esc(a.Titulo), s: esc(nomeDe('Lugares', a.LugarID)), pend: a._pendente })).join('')}</div>` : '<div class="cartao peq">Nada marcado.</div>'}
      <div class="botoes" style="margin-top:12px"><button class="btn perigo" data-a="emergencia">🆘 Emergência</button><button class="btn prim" data-a="nova-despesa">+ Despesa</button></div>`
  };
}

function hojeDepois(v) {
  const r = calc();
  const fam = minhaFamilia();
  const saldo = fam && r.familia[fam] ? r.familia[fam].saldo : 0;
  const visitados = daV('Lugares').filter(l => l.Status !== 'ideia' && l.Tipo !== 'transporte');
  const avaliar = visitados.filter(l => !daV('Avaliacoes').some(a => a.LugarID === l.ID && a.PessoaID === euId()));
  return {
    html: `<div class="cartao" style="text-align:center;padding:22px"><div class="peq">Viagem encerrada em ${esc(fmtDia(v.DataFim, true))}</div><h1 style="margin:6px 0">Bem-vindos de volta!</h1></div>
      <div class="cartao toque" data-a="ir" data-h="#/contas"><div class="peq">Saldo da sua família</div><div class="grande ${saldo >= 0 ? 'valor-pos' : 'valor-neg'}" style="font-size:2rem">${m(Math.abs(saldo))}</div>
        <div class="peq">${saldo > 0 ? 'a receber' : saldo < 0 ? 'a pagar' : 'tudo acertado'} · ${plural(r.transferencias.length, 'transferência')} para fechar as contas</div></div>
      ${avaliar.length ? `<div class="secao-topo"><div class="rotulo">Avalie para as próximas viagens</div><span class="etiqueta">${avaliar.length}</span></div><div class="lista">${avaliar.slice(0, 8).map(l => itemHtml({ a: 'avaliar', id: l.ID, ic: ICONE_TIPO[l.Tipo] || '📍', t: esc(l.Nome), s: esc(nomeDe('Cidades', l.CidadeID)) })).join('')}</div>` : ''}
      <div class="grade"><a href="#/contas"><span class="ic">💶</span>Fechar contas</a><a href="#/diario"><span class="ic">📓</span>Diário</a><button data-a="pdf-contas"><span class="ic">📄</span>PDF das contas</button></div>`
  };
}

AC['ir'] = el => ir(el.dataset.h);
AC['emergencia'] = () => {
  const h = hoje();
  const cid = cidadeDoDia(h);
  const hosp = hospedagemDoDia(h);
  const infos = daV('Infos').filter(i => ['emergência', 'seguro', 'saúde', 'embaixada'].includes(i.Categoria) && (!i.CidadeID || !cid || i.CidadeID === cid.ID));
  abrirPainel({
    titulo: 'Emergência',
    html: `<a class="btn prim bloco" href="tel:${esc((cid && cid.Emergencia) || '112')}" style="font-size:1.3rem;min-height:64px;background:var(--erro);border-color:var(--erro)">Ligar ${esc((cid && cid.Emergencia) || '112')}</a>
      <p class="peq" style="text-align:center">112 funciona em toda a União Europeia, inclusive sem chip local.</p>
      ${hosp && hosp.lugar ? `<div class="cartao"><div class="peq">Endereço da hospedagem</div><h3>${esc(hosp.lugar.Nome)}</h3><p style="font-size:1.2rem;font-weight:700">${esc(hosp.lugar.Endereco || '')}</p>
        ${hosp.lugar.Telefone ? `<a class="btn bloco" href="tel:${esc(hosp.lugar.Telefone)}">☎ ${esc(hosp.lugar.Telefone)}</a>` : ''}<button class="btn bloco" style="margin-top:8px" data-a="endereco-grande">Mostrar em tela cheia (para táxi)</button></div>` : ''}
      ${infos.length ? `<div class="lista">${infos.map(i => itemHtml({ ic: i.Categoria === 'seguro' ? '🛡️' : i.Categoria === 'embaixada' ? '🇧🇷' : '➕', t: esc(i.Titulo), s: esc(i.Conteudo || ''), v: i.Telefone ? `<a href="tel:${esc(i.Telefone)}">☎</a>` : '' })).join('')}</div>` : '<p class="peq">Cadastre seguro, consulado e contatos em Mais → Informações.</p>'}`
  });
};
AC['endereco-grande'] = () => {
  const hosp = hospedagemDoDia(hoje());
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:99;background:#fff;color:#000;display:flex;flex-direction:column;justify-content:center;padding:24px;font-size:2rem;font-weight:800;line-height:1.25';
  d.innerHTML = `<div>${esc(hosp.lugar.Nome)}</div><div style="margin-top:16px">${esc(hosp.lugar.Endereco || '')}</div><div style="font-size:1rem;margin-top:30px;font-weight:500">Toque para fechar</div>`;
  d.onclick = () => d.remove();
  document.body.appendChild(d);
};

/* ============================== PLANO (roteiro) ============================== */
TELAS.plano = args => {
  const dias = diasDaViagem();
  const h = hoje();
  let sel = args[0] || S.ui.diaPlano || (dias.includes(h) ? h : dias[0]);
  if (sel !== 'ideias' && !dias.includes(sel)) sel = dias[0];
  S.ui.diaPlano = sel;
  const nIdeias = daV('Lugares').filter(l => l.Status === 'ideia').length;
  const faixa = `<div class="dias" id="faixa-dias">${dias.map(d => { const o = dataObj(d); return `<a class="dia ${d === sel ? 'on' : ''} ${d === h ? 'hoje' : ''}" href="#/plano/${d}" data-dia="${d}"><small>${DIAS_SEM[o.getDay()]}</small><b>${o.getDate()}</b><i style="background:${corDia(d)}"></i></a>`; }).join('')}
    <a class="dia ${sel === 'ideias' ? 'on' : ''}" href="#/plano/ideias" style="width:76px"><small>lugares</small><b>💡${nIdeias}</b></a></div>`;
  if (sel === 'ideias') return { titulo: 'ideias de lugares', html: faixa + telaIdeias(), depois: rolarFaixa };
  const ats = atividadesDoDia(sel);
  const cid = cidadeDoDia(sel);
  const desl = calc().atividades;
  const carregado = diaCarregado(sel);
  const diarios = daV('Diario').filter(x => x.Data === sel);
  return {
    titulo: fmtDia(sel) + (cid ? ' · ' + cid.Nome : ''),
    html: `${faixa}
      <div class="secao-topo" style="margin-top:6px"><div><h2>${esc(fmtDia(sel))}</h2><div class="peq">${cid ? esc(cid.Nome) : 'sem cidade definida'}${hospedagemDoDia(sel) ? ' · 🛏️ ' + esc((hospedagemDoDia(sel).lugar || {}).Nome || hospedagemDoDia(sel).reserva.Titulo) : ''}</div></div>
        <a class="btn" href="#/mapa" data-dia-mapa="${sel}">🗺️ Mapa</a></div>
      ${carregado ? `<div class="aviso alerta">Dia puxado: ${esc(carregado)}.</div>` : ''}
      ${ats.length ? `<div class="linha-tempo" id="lista-ativ">${ats.map((a, i) => {
        const l = ach('Lugares', a.LugarID);
        const dd = desl[a.ID] || {};
        const quem = N_lista(a.Quem);
        return `<div class="ativ" data-id="${a.ID}" style="--cor:${corDia(sel)}">
          <div class="cartao ${a._pendente ? 'pendente' : ''}" style="padding:10px 6px 10px 12px;margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <button type="button" class="corpo" data-a="abrir-atividade" data-id="${a.ID}" style="flex:1;min-width:0;background:none;border:0;text-align:left;padding:0;cursor:pointer">
              <span class="peq"><b>${esc(a.HoraInicio || '—')}</b>${a.HoraFim ? '–' + esc(a.HoraFim) : ''} · ${esc(a.Tipo)}</span>
              <span class="t" style="display:block;font-weight:700">${a.Tipo === 'pausa' ? '☕ ' : ''}${esc(a.Titulo)}</span>
              ${l ? `<span class="s" style="display:block;font-size:.84rem;color:var(--tinta2)">${ICONE_TIPO[l.Tipo] || '📍'} ${esc(l.Nome)}</span>` : ''}
              ${quem.length ? `<span class="mpeq">só: ${quem.map(pessoaNome).map(esc).join(', ')}</span>` : ''}
            </button>
            ${podeEditar() ? '<span class="alca-arr" aria-label="Arrastar para reordenar">⠿</span>' : ''}
          </div>
          ${dd.min && i < ats.length - 1 ? `<div class="deslocamento">${dd.modo === 'a pé' ? '🚶' : '🚐'} ~${dd.min} min · ${String(dd.km).replace('.', ',')} km (estimativa)</div>` : ''}
        </div>`;
      }).join('')}</div>` : vazio('Nada marcado neste dia.')}
      ${podeEditar() ? `<div class="botoes"><button class="btn prim" data-a="nova-atividade" data-dia="${sel}">+ Atividade</button><button class="btn" data-a="nova-pausa" data-dia="${sel}">+ Pausa</button></div>` : ''}
      <div class="secao-topo"><div class="rotulo">Diário do dia</div><button class="btn" data-a="novo-diario" data-dia="${sel}" style="min-height:40px">Escrever</button></div>
      ${diarios.length ? diarios.map(dd => `<div class="cartao toque" data-a="editar-diario" data-id="${dd.ID}"><div class="cartao-topo">${avatar(dd.PessoaID, 32)}<div><div class="peq">${esc(pessoaNome(dd.PessoaID))}</div><div style="white-space:pre-wrap">${esc(dd.Texto)}</div></div></div></div>`).join('') : '<p class="peq">Um registro curto por dia vira memória da viagem.</p>'}`,
    depois: el => { rolarFaixa(el); ativarArrastar(sel); const bm = $('[data-dia-mapa]', el); if (bm) bm.onclick = () => { S.ui.mapaFiltroDia = sel; }; }
  };
};
function rolarFaixa() { const on = $('#faixa-dias .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' }); }

function telaIdeias() {
  const porCid = {};
  daV('Lugares').filter(l => l.Status === 'ideia').forEach(l => (porCid[l.CidadeID || ''] = porCid[l.CidadeID || ''] || []).push(l));
  const ks = Object.keys(porCid);
  return `<p class="peq">Lugares salvos como "ideia". Toque em "Pôr no roteiro" para escolher o dia.</p>
    ${ks.length ? ks.map(k => `<div class="rotulo">${esc(nomeDe('Cidades', k) || 'Sem cidade')}</div><div class="lista">${porCid[k].map(l => `<div class="item"><span class="emoji">${ICONE_TIPO[l.Tipo] || '📍'}</span>
      <button type="button" class="corpo" data-a="abrir-lugar" data-id="${l.ID}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer"><span class="t">${esc(l.Nome)}</span><span class="s">${esc(l.Endereco || l.Notas || '')}</span></button>
      ${podeEditar() ? `<button class="btn" style="min-height:40px;padding:0 12px" data-a="por-no-roteiro" data-id="${l.ID}">Pôr no roteiro</button>` : ''}</div>`).join('')}</div>`).join('')
      : vazio('Nenhuma ideia salva.', '')}
    ${podeEditar() ? '<button class="btn prim bloco" data-a="novo-lugar">+ Lugar</button>' : ''}`;
}

function ativarArrastar(dia) {
  const lista = $('#lista-ativ');
  if (!lista || !podeEditar()) return;
  carregarScript(CFG.sortableJs, 'Sortable').then(Sortable => {
    if (!Sortable || !document.body.contains(lista)) return;
    Sortable.create(lista, { handle: '.alca-arr', animation: 150, delay: 0, onEnd: () => {
      const ids = $$('.ativ', lista).map(e => e.dataset.id);
      emLote('Ordem do dia alterada', () => {
        ids.forEach((id, i) => { const a = ach('Atividades', id); if (a && Number(a.Ordem) !== (i + 1) * 10) salvar('Atividades', id, { Ordem: (i + 1) * 10 }); });
      });
    } });
  }).catch(() => { /* sem arrastar offline na 1ª vez: dá para mudar a ordem editando */ });
}

const _scripts = {};
function carregarScript(src, global) {
  if (window[global]) return Promise.resolve(window[global]);
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => res(window[global]); s.onerror = () => { delete _scripts[src]; rej(new Error('Não carregou ' + src)); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}

AC['nova-atividade'] = el => formAtividade(null, { Data: el.dataset.dia || S.ui.diaPlano || hoje() });
AC['nova-pausa'] = el => formAtividade(null, { Data: el.dataset.dia, Tipo: 'pausa', Titulo: 'Pausa / descanso das crianças' });
function formAtividade(id, pre) {
  const dia = (pre && pre.Data) || (id && ach('Atividades', id).Data);
  const ultimo = atividadesDoDia(dia).slice(-1)[0];
  formulario('Atividades', id, {
    titulo: id ? 'Editar atividade' : 'Nova atividade',
    padroes: Object.assign({ Ordem: ultimo ? Number(ultimo.Ordem || 0) + 10 : 10 }, pre || {}),
    campos: ['Titulo', 'Data', 'HoraInicio', 'HoraFim', 'Tipo', 'LugarID', 'ResponsavelID', 'Quem', 'Notas'],
    msg: id ? 'Atividade alterada' : 'Atividade adicionada'
  });
}
AC['abrir-atividade'] = el => {
  const a = ach('Atividades', el.dataset.id);
  if (!a) return;
  const l = ach('Lugares', a.LugarID);
  const dd = calc().atividades[a.ID] || {};
  abrirPainel({
    titulo: a.Titulo,
    render: () => `<p class="peq">${esc(fmtDia(a.Data))} · ${esc(a.HoraInicio || 'sem horário')}${a.HoraFim ? '–' + esc(a.HoraFim) : ''} · ${esc(a.Tipo)}</p>
      ${l ? `<div class="cartao"><h3>${ICONE_TIPO[l.Tipo] || '📍'} ${esc(l.Nome)}</h3><p class="peq">${esc(l.Endereco || '')}</p>${l.Acessibilidade ? `<p class="peq">♿ ${esc(l.Acessibilidade)}</p>` : ''}${botoesMapa(l)}</div>` : ''}
      ${a.Notas ? `<div class="cartao" style="white-space:pre-wrap">${esc(a.Notas)}</div>` : ''}
      ${N_lista(a.Quem).length ? `<p class="peq">Só vão: ${N_lista(a.Quem).map(pessoaNome).map(esc).join(', ')}</p>` : ''}
      ${a.ResponsavelID ? `<p class="peq">Responsável: ${esc(pessoaNome(a.ResponsavelID))}</p>` : ''}
      ${dd.min ? `<p class="peq">Até a próxima parada: ~${dd.min} min ${esc(dd.modo)} (${String(dd.km).replace('.', ',')} km, estimativa em linha reta × 1,3)</p>` : ''}
      <p class="mpeq">Atualizado ${a.AtualizadoPor ? 'por ' + esc(pessoaNome(a.AtualizadoPor)) : ''} ${a.AtualizadoEm ? 'em ' + esc(new Date(a.AtualizadoEm).toLocaleString('pt-BR')) : ''}${a._pendente ? ' · aguardando envio' : ''}</p>`,
    rodape: `<div class="botoes">${l && l.Lat !== '' ? `<button class="btn" data-a="ver-no-mapa" data-id="${l.ID}">Ver no mapa</button>` : ''}${podeEditar() ? `<button class="btn prim" data-a="editar-atividade" data-id="${a.ID}">Editar</button>` : ''}</div>`
  });
};
AC['editar-atividade'] = el => formAtividade(el.dataset.id);
AC['ver-no-mapa'] = el => { fecharPainel(true); S.ui.focoLugar = el.dataset.id; ir('#/mapa'); };
AC['novo-diario'] = el => formulario('Diario', null, { titulo: 'Diário', padroes: { Data: el.dataset.dia || hoje(), PessoaID: euId() }, campos: ['Data', 'Texto'], fixos: { PessoaID: euId() }, msg: 'Diário salvo' });
AC['editar-diario'] = el => { const d = ach('Diario', el.dataset.id); if (d.PessoaID !== euId()) { toast('Cada pessoa edita só o próprio diário.'); return; } formulario('Diario', d.ID, { titulo: 'Diário', campos: ['Data', 'Texto'] }); };
AC['por-no-roteiro'] = el => {
  const l = ach('Lugares', el.dataset.id);
  const dias = diasDaViagem();
  const sug = l.CidadeID ? dias.filter(d => { const c = cidadeDoDia(d); return c && c.ID === l.CidadeID; }) : dias;
  abrirPainel({
    titulo: 'Em que dia?',
    html: `<p class="peq">${esc(l.Nome)}</p><div class="lista">${(sug.length ? sug : dias).map(d => itemHtml({ a: 'por-no-dia', id: d, ic: `<b>${dataObj(d).getDate()}</b>`, cor: corDia(d), t: esc(fmtDia(d)), s: plural(atividadesDoDia(d).length, 'atividade') + (cidadeDoDia(d) ? ' · ' + esc(cidadeDoDia(d).Nome) : '') })).join('')}</div>`
  });
  AC['por-no-dia'] = b => {
    const d = b.dataset.id;
    const ult = atividadesDoDia(d).slice(-1)[0];
    emLote('Adicionado ao roteiro de ' + fmtDiaCurto(d), () => {
      salvar('Atividades', null, { Data: d, Titulo: l.Nome, LugarID: l.ID, Tipo: l.Tipo === 'restaurante' ? 'refeição' : 'atividade', Ordem: ult ? Number(ult.Ordem || 0) + 10 : 10 });
      if (l.Status === 'ideia') salvar('Lugares', l.ID, { Status: 'agendado' });
    });
    fecharPainel();
  };
};

/* ============================== CONTAS ============================== */
TELAS.contas = args => {
  const aba = args[0] || S.ui.abaContas || 'saldos';
  S.ui.abaContas = aba;
  const seg = `<div class="seg">${[['saldos', 'Saldos'], ['despesas', 'Despesas'], ['orcamento', 'Orçamento'], ['total', 'Total']].map(x => `<button class="${aba === x[0] ? 'on' : ''}" data-a="ir" data-h="#/contas/${x[0]}">${x[1]}</button>`).join('')}</div>`;
  const corpo = { saldos: contasSaldos, despesas: contasDespesas, orcamento: contasOrcamento, total: contasTotal }[aba] || contasSaldos;
  return { titulo: 'contas em ' + moedaAcerto(), html: seg + avisosCalc() + corpo() };
};

function contasSaldos() {
  const r = calc();
  const fam = minhaFamilia();
  const meu = fam && r.familia[fam] ? r.familia[fam].saldo : 0;
  const fams = Object.keys(r.familia);
  const acertos = daV('Acertos').sort((a, b) => b.Data.localeCompare(a.Data));
  return `<div class="cartao" style="text-align:center"><div class="peq">Sua família (${esc(nomeDe('Familias', fam))})</div>
      <div class="grande ${meu >= 0 ? 'valor-pos' : 'valor-neg'}">${m(Math.abs(meu))}</div><div class="peq">${meu > 0 ? 'a receber' : meu < 0 ? 'a pagar' : 'tudo acertado'}</div></div>
    <div class="secao-topo"><div class="rotulo">Acerto sugerido (menor número de transferências)</div></div>
    ${r.transferencias.length ? `<div class="lista">${r.transferencias.map((t, i) => `<div class="item" style="flex-wrap:wrap">
        <span class="corpo"><span class="t">${esc(nomeDe('Familias', t.deFamilia))} → ${esc(nomeDe('Familias', t.paraFamilia))}</span>
        <span class="s">${esc(pessoaNome(t.dePessoa))} paga ${esc(pessoaNome(t.paraPessoa))}${(ach('Pessoas', t.paraPessoa) || {}).Pix ? ' · Pix: ' + esc(ach('Pessoas', t.paraPessoa).Pix) : ''}</span></span>
        <span class="v">${m(t.valor)}</span>
        <div class="botoes" style="width:100%;margin-top:8px"><button class="btn" data-a="acerto-whats" data-i="${i}">WhatsApp</button>${podeEditar() ? `<button class="btn prim" data-a="acerto-registrar" data-i="${i}">Registrar pagamento</button>` : ''}</div></div>`).join('')}</div>`
      : '<div class="cartao peq">Ninguém deve nada a ninguém. ✅</div>'}
    <div class="rotulo">Por família</div>
    <div class="lista">${fams.map(f => { const s = r.familia[f]; return `<details class="item" style="display:block;cursor:default"><summary style="display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none">
      <span class="corpo"><span class="t">${esc(nomeDe('Familias', f))}</span><span class="s">pagou ${m(s.pagou)} · consumiu ${m(s.consumiu)}${s.repassou || s.recebeu ? ` · acertos ${m(s.repassou - s.recebeu)}` : ''}</span></span>
      <span class="v ${s.saldo >= 0 ? 'valor-pos' : 'valor-neg'}">${s.saldo >= 0 ? '+' : ''}${m(s.saldo)}</span></summary>
      <div style="padding:8px 0 0">${participantes().filter(p => p.FamiliaID === f).map(p => { const sp = r.pessoa[p.PessoaID] || { pagou: 0, consumiu: 0, saldo: 0 }; return `<div class="peq" style="display:flex;justify-content:space-between;padding:3px 0"><span>${esc(pessoaNome(p.PessoaID))}</span><span>pagou ${m(sp.pagou)} · consumiu ${m(sp.consumiu)}</span></div>`; }).join('')}</div></details>`; }).join('')}</div>
    <div class="secao-topo"><div class="rotulo">Pagamentos registrados</div>${podeEditar() ? '<button class="btn" style="min-height:40px" data-a="novo-acerto">+ Registrar</button>' : ''}</div>
    ${acertos.length ? `<div class="lista">${acertos.map(a => itemHtml({ a: 'editar-acerto', id: a.ID, ic: '🤝', t: esc(pessoaNome(a.DePessoaID)) + ' → ' + esc(pessoaNome(a.ParaPessoaID)), s: esc(fmtDia(a.Data)) + ' · ' + esc(a.Meio || ''), v: mv(a.Valor, a.Moeda), pend: a._pendente })).join('')}</div>` : '<p class="peq">Nenhum pagamento entre famílias registrado ainda.</p>'}
    <button class="btn bloco" data-a="pdf-contas">📄 Fechamento de contas (PDF)</button>`;
}
AC['acerto-whats'] = el => {
  const t = calc().transferencias[Number(el.dataset.i)];
  const para = ach('Pessoas', t.paraPessoa) || {};
  abrirWhats(N_preencher(mensagem('Acerto de contas') || 'Acerto da viagem {viagem}: {de} paga {valor} para {para}.{pix}', {
    nome: pessoaNome(t.dePessoa), viagem: viagem().Nome, de: nomeDe('Familias', t.deFamilia), para: nomeDe('Familias', t.paraFamilia) + ' (' + pessoaNome(t.paraPessoa) + ')',
    valor: m(t.valor), pix: para.Pix ? ' Pix: ' + para.Pix + '.' : '' }));
};
AC['acerto-registrar'] = el => {
  const t = calc().transferencias[Number(el.dataset.i)];
  formulario('Acertos', null, { titulo: 'Registrar pagamento', padroes: { Data: hoje(), DePessoaID: t.dePessoa, ParaPessoaID: t.paraPessoa, Valor: t.valor / 100, Moeda: moedaAcerto(), Meio: 'pix' },
    campos: ['Data', 'DePessoaID', 'ParaPessoaID', 'Valor', 'Moeda', 'Cotacao', 'Meio', 'Notas'], ajuda: { Cotacao: 'Só se pagou em outra moeda: quanto vale 1 unidade na moeda do acerto.' }, msg: 'Pagamento registrado', semFoco: true });
};
AC['novo-acerto'] = () => formulario('Acertos', null, { titulo: 'Registrar pagamento', padroes: { Data: hoje(), DePessoaID: euId(), Moeda: moedaAcerto(), Meio: 'pix' }, campos: ['Data', 'DePessoaID', 'ParaPessoaID', 'Valor', 'Moeda', 'Cotacao', 'Meio', 'Notas'], msg: 'Pagamento registrado' });
AC['editar-acerto'] = el => formulario('Acertos', el.dataset.id, { titulo: 'Pagamento', campos: ['Data', 'DePessoaID', 'ParaPessoaID', 'Valor', 'Moeda', 'Cotacao', 'Meio', 'Notas'] });

function contasDespesas() {
  const f = S.ui.filtroDesp || 'todas';
  const r = calc();
  let l = daV('Despesas');
  if (f === 'minhas') l = l.filter(d => d.PagoPor === euId());
  if (f === 'familia') l = l.filter(d => familiaDe(d.PagoPor) === minhaFamilia());
  if (f === 'fora') l = l.filter(d => d.ForaDivisao === 'sim');
  if (f.startsWith('CID')) l = l.filter(d => d.CidadeID === f);
  l.sort((a, b) => b.Data.localeCompare(a.Data) || String(b.RegistradoEm).localeCompare(String(a.RegistradoEm)));
  const porDia = {};
  l.forEach(d => (porDia[d.Data] = porDia[d.Data] || []).push(d));
  const chips = [['todas', 'Todas'], ['minhas', 'Paguei'], ['familia', 'Minha família'], ['fora', 'Fora da divisão']].concat(daV('Cidades').map(c => [c.ID, c.Nome]));
  const totalF = l.reduce((a, d) => a + ((r.despesas[d.ID] || {}).valorAcerto || 0), 0);
  return `<div class="chips">${chips.map(c => `<button class="chip ${f === c[0] ? 'on' : ''}" data-a="filtro-desp" data-f="${c[0]}">${esc(c[1])}</button>`).join('')}</div>
    <div class="secao-topo" style="margin-top:4px"><span class="peq">${plural(l.length, 'despesa')} · ${m(totalF)}</span>${podeEditar() ? '<button class="btn prim" style="min-height:40px" data-a="nova-despesa">+ Despesa</button>' : ''}</div>
    ${Object.keys(porDia).length ? Object.keys(porDia).map(dia => `<div class="rotulo">${esc(fmtDia(dia))}</div><div class="lista">${porDia[dia].map(d => {
      const c = ach('Categorias', d.CategoriaID) || {};
      const x = r.despesas[d.ID] || {};
      return itemHtml({ a: 'editar-despesa', id: d.ID, ic: esc(c.Icone || '•'), t: esc(d.Descricao || c.Nome || 'Despesa'),
        s: esc(pessoaNome(d.PagoPor)) + ' pagou · ' + (d.ForaDivisao === 'sim' ? 'fora da divisão' : esc(d.TipoDivisao)) + (x.aviso ? ` · <b style="color:var(--erro)">${esc(x.aviso)}</b>` : '') + (d.FonteCotacao === 'provisória' ? ' · cotação provisória' : ''),
        v: mv(d.Valor, d.Moeda) + (d.Moeda !== moedaAcerto() && x.valorAcerto !== null && x.valorAcerto !== undefined ? `<div class="mpeq">${m(x.valorAcerto)}</div>` : ''), pend: d._pendente });
    }).join('')}</div>`).join('') : vazio('Nenhuma despesa aqui.', podeEditar() ? '<button class="btn prim" data-a="nova-despesa">Lançar a primeira</button>' : '')}`;
}
AC['filtro-desp'] = el => { S.ui.filtroDesp = el.dataset.f; render(); };
AC['editar-despesa'] = el => formDespesa(el.dataset.id);
AC['nova-despesa'] = () => { fecharPainel(true); formDespesa(null); };

function contasOrcamento() {
  const dim = S.ui.dimOrc || 'categoria';
  const r = calc();
  const lim = 80;
  const nome = (k) => dim === 'dia' ? fmtDia(k) : dim === 'cidade' ? nomeDe('Cidades', k) : ((ach('Categorias', k) || {}).Icone || '') + ' ' + nomeDe('Categorias', k);
  const linhasDim = r.orcamento[dim];
  const tot = linhasDim.reduce((a, o) => ({ o: a.o + o.orcado, g: a.g + o.gasto }), { o: 0, g: 0 });
  return `<div class="chips">${[['categoria', 'Por categoria'], ['cidade', 'Por cidade'], ['dia', 'Por dia']].map(x => `<button class="chip ${dim === x[0] ? 'on' : ''}" data-a="dim-orc" data-d="${x[0]}">${x[1]}</button>`).join('')}</div>
    ${tot.o ? `<div class="cartao"><div class="peq">Total ${dim === 'categoria' ? 'orçado' : 'orçado nesta visão'}</div><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:1.4rem">${m(tot.g)}</b><span class="peq">de ${m(tot.o)}</span></div>
      <div class="barra-orc"><i class="${tot.g >= tot.o ? 'erro' : tot.g * 100 / tot.o >= lim ? 'alerta' : ''}" style="width:${Math.min(100, Math.round(tot.g * 100 / tot.o))}%"></i></div></div>` : ''}
    ${linhasDim.length ? `<div class="lista">${linhasDim.map(o => {
      const pct = o.orcado ? Math.round(o.gasto * 100 / o.orcado) : null;
      const cls = pct === null ? '' : pct >= 100 ? 'erro' : pct >= lim ? 'alerta' : '';
      return `<div class="item" style="display:block;cursor:default"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(nome(o.chave))}</b><span>${m(o.gasto)}${o.orcado ? ' <span class="peq">/ ' + m(o.orcado) + '</span>' : ' <span class="etiqueta">sem orçamento</span>'}</span></div>
        ${o.orcado ? `<div class="barra-orc"><i class="${cls}" style="width:${Math.min(100, pct)}%"></i></div><div class="mpeq">${pct}% ${pct >= 100 ? '· estourou ' + m(o.gasto - o.orcado) : pct >= lim ? '· atenção' : ''}</div>` : ''}</div>`;
    }).join('')}</div>` : vazio('Sem orçamento nem gastos nesta visão.')}
    <div class="secao-topo"><div class="rotulo">Linhas de orçamento</div>${podeEditar() ? '<button class="btn" style="min-height:40px" data-a="nova-orc">+ Linha</button>' : ''}</div>
    <p class="peq">Uma linha só com categoria vale para a viagem toda. Com cidade ou dia, conta só ali.</p>
    ${daV('Orcamento').length ? `<div class="lista">${daV('Orcamento').map(o => itemHtml({ a: 'editar-orc', id: o.ID, ic: esc((ach('Categorias', o.CategoriaID) || {}).Icone || '•'), t: esc(nomeDe('Categorias', o.CategoriaID)), s: [o.CidadeID && nomeDe('Cidades', o.CidadeID), o.Data && fmtDia(o.Data)].filter(Boolean).map(esc).join(' · ') || 'viagem toda', v: mv(o.Valor, o.Moeda), pend: o._pendente })).join('')}</div>` : ''}`;
}
AC['dim-orc'] = el => { S.ui.dimOrc = el.dataset.d; render(); };
AC['nova-orc'] = () => formulario('Orcamento', null, { titulo: 'Linha de orçamento', padroes: { Moeda: moedaAcerto() }, campos: ['CategoriaID', 'Valor', 'Moeda', 'CidadeID', 'Data', 'Cotacao'], ajuda: { Cotacao: 'Só se o valor estiver em outra moeda (vazio = BCE de hoje).' } });
AC['editar-orc'] = el => formulario('Orcamento', el.dataset.id, { titulo: 'Linha de orçamento', campos: ['CategoriaID', 'Valor', 'Moeda', 'CidadeID', 'Data', 'Cotacao'] });

function contasTotal() {
  const r = calc();
  const c = r.custo;
  const porCat = {};
  daV('Despesas').forEach(d => { const x = r.despesas[d.ID]; if (x && x.valorAcerto !== null) porCat[d.CategoriaID] = (porCat[d.CategoriaID] || 0) + x.valorAcerto; });
  const cats = Object.keys(porCat).sort((a, b) => porCat[b] - porCat[a]);
  const maior = cats.length ? porCat[cats[0]] : 1;
  return `<div class="cartao"><div class="peq">Custo total da viagem</div><div class="grande" style="font-size:2.2rem">${m(c.totalAcerto)}</div><div class="peq">${N_formatarMoeda(c.totalBRL, 'BRL')} · inclui ${m(c.foraAcerto)} fora da divisão (ex.: passagens)</div></div>
    <div class="rotulo">Por família (dividido + fora da divisão)</div>
    <div class="lista">${Object.keys(c.porFamiliaAcerto).map(f => itemHtml({ ic: '👪', t: esc(nomeDe('Familias', f) || 'sem família'), s: N_formatarMoeda(c.porFamiliaBRL[f] || 0, 'BRL'), v: m(c.porFamiliaAcerto[f]) })).join('') || '<div class="item">—</div>'}</div>
    <div class="rotulo">Por categoria</div>
    <div class="lista">${cats.map(k => `<div class="item" style="display:block;cursor:default"><div style="display:flex;justify-content:space-between"><span>${esc((ach('Categorias', k) || {}).Icone || '')} ${esc(nomeDe('Categorias', k))}</span><b>${m(porCat[k])}</b></div><div class="barra-orc"><i style="width:${Math.round(porCat[k] * 100 / maior)}%;background:var(--info)"></i></div></div>`).join('') || '<div class="item">—</div>'}</div>
    <p class="mpeq">Valores convertidos pela cotação gravada em cada despesa (BCE do dia, ou a do cartão quando informada).</p>`;
}
AC['pdf-contas'] = () => gerarPdf('contas');
async function gerarPdf(tipo, cidadeId) {
  if (!navigator.onLine) { toast('Gerar PDF precisa de internet.'); return; }
  toast('Gerando PDF…', { ms: 15000 });
  try { const r = await api('gerarPdf', { viagemId: S.viagemId, tipo, cidadeId }, { timeout: 90000 }); $$('.torrada').forEach(t => t.remove()); await abrirArquivo(r); }
  catch (e) { toast(e.message, { ms: 7000 }); }
}

/* ============================== MENU "MAIS" e "+" ============================== */
AC['mais'] = () => {
  const v = viagem();
  abrirPainel({
    titulo: v ? v.Nome : 'Menu',
    html: `<div class="grade">
      <a href="#/viagem"><span class="ic">🧭</span>Viagem e cidades</a><a href="#/reservas"><span class="ic">🎫</span>Reservas</a><a href="#/tarefas"><span class="ic">☑️</span>Tarefas</a>
      <a href="#/decisoes"><span class="ic">🗳️</span>Decisões</a><a href="#/checklists"><span class="ic">🧳</span>Malas e listas</a><a href="#/docs"><span class="ic">📎</span>Documentos</a>
      <a href="#/lugares"><span class="ic">📍</span>Lugares</a><a href="#/infos"><span class="ic">ℹ️</span>Informações</a><a href="#/diario"><span class="ic">📓</span>Diário</a>
      <a href="#/grupo"><span class="ic">👪</span>Grupo</a><a href="#/viagens"><span class="ic">🌍</span>Viagens</a><a href="#/perfil"><span class="ic">⚙️</span>Ajustes</a></div>
      <a href="#/ajuda" class="btn bloco" style="margin-top:12px">? Ajuda</a>`
  });
};
AC['mais-criar'] = () => {
  if (!S.viagemId) { formViagem(null); return; }
  abrirPainel({
    titulo: 'Adicionar',
    html: `<button class="btn prim bloco" style="min-height:64px;font-size:1.15rem;margin-bottom:12px" data-a="nova-despesa">💶 Despesa</button>
      <div class="grade">
        <button data-a="nova-atividade"><span class="ic">🗓️</span>Atividade</button><button data-a="novo-lugar"><span class="ic">📍</span>Lugar</button><button data-a="nova-reserva"><span class="ic">🎫</span>Reserva</button>
        <button data-a="nova-tarefa"><span class="ic">☑️</span>Tarefa</button><button data-a="novo-doc"><span class="ic">📎</span>Documento</button><button data-a="nova-votacao"><span class="ic">🗳️</span>Votação</button>
        <button data-a="novo-diario"><span class="ic">📓</span>Diário</button><button data-a="nova-lista"><span class="ic">🧳</span>Lista</button><button data-a="nova-info"><span class="ic">ℹ️</span>Informação</button></div>`
  });
};
AC['novo-lugar'] = () => formLugar(null);
AC['nova-tarefa'] = () => formulario('Tarefas', null, { titulo: 'Nova tarefa', padroes: { ResponsavelID: euId() }, campos: ['Titulo', 'Tipo', 'ResponsavelID', 'Prazo', 'AvisarDiasAntes', 'ReservaID', 'Notas'], msg: 'Tarefa criada' });
AC['novo-doc'] = () => formAnexo();
AC['nova-info'] = () => formulario('Infos', null, { titulo: 'Nova informação', campos: ['Categoria', 'Titulo', 'Conteudo', 'Telefone', 'CidadeID'] });

/* ============================== VIAGEM E CIDADES ============================== */
TELAS.viagem = () => {
  const v = viagem();
  const cids = daV('Cidades').sort((a, b) => String(a.Chegada).localeCompare(String(b.Chegada)));
  return {
    titulo: 'viagem e cidades',
    html: `<div class="cartao"><h2>${esc(v.Nome)}</h2><p class="peq">${esc(fmtDia(v.DataInicio, true))} a ${esc(fmtDia(v.DataFim, true))} · ${diasEntre(v.DataInicio, v.DataFim) + 1} dias · acerto em ${esc(v.MoedaAcerto)} · ${esc(v.Status)}</p>
      ${v.Notas ? `<p style="white-space:pre-wrap">${esc(v.Notas)}</p>` : ''}${souOrg() ? '<button class="btn" data-a="editar-viagem">Editar dados</button>' : ''}</div>
      <div class="secao-topo"><div class="rotulo">Cidades-base</div>${souOrg() ? '<button class="btn" style="min-height:40px" data-a="nova-cidade">+ Cidade</button>' : ''}</div>
      ${cids.length ? `<div class="lista">${cids.map((c, i) => `<div class="item"><span class="emoji" style="background:${CORES_DIA[i % 8]};color:#fff">${i + 1}</span>
        <button type="button" class="corpo" data-a="editar-cidade" data-id="${c.ID}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer"><span class="t">${esc(c.Nome)}${c.Pais ? ' <span class="peq">· ' + esc(c.Pais) + '</span>' : ''}</span>
        <span class="s">${c.Chegada ? esc(fmtDiaCurto(c.Chegada)) + ' → ' + esc(fmtDiaCurto(c.Saida)) + ' · ' + plural(diasEntre(c.Chegada, c.Saida), 'noite') : 'sem datas'} · ${esc(c.Moeda || '')}${cidadesSemHospedagem().includes(c) ? ' · <b style="color:var(--alerta)">sem hospedagem</b>' : ''}</span></button>
        <button class="btn" style="min-height:40px;padding:0 10px" data-a="pdf-kit" data-id="${c.ID}">PDF</button></div>`).join('')}</div>`
        : vazio('Nenhuma cidade ainda. Cada cidade-base ganha automaticamente a tarefa "Baixar mapas offline".')}
      <p class="peq">O "PDF" é o kit offline da cidade: hospedagem, reservas com códigos, roteiro com endereços e coordenadas e informações úteis. Bom para guardar no celular antes de cada trecho.</p>`
  };
};
AC['editar-viagem'] = () => formViagem(S.viagemId);
AC['nova-cidade'] = () => formulario('Cidades', null, { titulo: 'Nova cidade', campos: ['Nome', 'Pais', 'Chegada', 'Saida', 'Moeda', 'Fuso', 'Lat', 'Lng', 'Idioma', 'Tomada', 'Emergencia'],
  ajuda: { Fuso: 'Ex.: Europe/Brussels, Europe/Berlin, Europe/Lisbon (usado no resumo da manhã).', Lat: 'Centro da cidade (para o mapa). Pode copiar do Google Maps.' }, msg: 'Cidade adicionada' });
AC['editar-cidade'] = el => { formulario('Cidades', el.dataset.id, { titulo: 'Cidade', campos: ['Nome', 'Pais', 'Chegada', 'Saida', 'Moeda', 'Fuso', 'Lat', 'Lng', 'Idioma', 'Tomada', 'Emergencia'] }); };
AC['pdf-kit'] = el => gerarPdf('kit', el.dataset.id);

/* ============================== RESERVAS ============================== */
function bilheteHtml(r) {
  const l = ach('Lugares', r.LugarID);
  const h = hoje();
  const badges = [];
  if (r.Pagamento !== 'pago') badges.push(`<span class="etiqueta ${r.PrazoPagamento && r.PrazoPagamento <= somaDias(h, 7) ? 'erro' : 'alerta'}">${esc(r.Pagamento)}${r.PrazoPagamento ? ' até ' + fmtDiaCurto(r.PrazoPagamento) : ''}</span>`);
  if (r.PrazoCancelamento && r.PrazoCancelamento >= h) badges.push(`<span class="etiqueta ${r.PrazoCancelamento <= somaDias(h, 7) ? 'alerta' : 'info'}">cancela grátis até ${fmtDiaCurto(r.PrazoCancelamento)}</span>`);
  const anexos = daV('Anexos').filter(a => a.VinculoTipo === 'reserva' && a.VinculoID === r.ID && a.TemArquivo === 'sim');
  return `<div class="bilhete ${r._pendente ? 'pendente' : ''}" data-a="abrir-reserva" data-id="${r.ID}">
    <div class="b1"><span class="emoji">${ICONE_RESERVA[r.Tipo] || '📄'}</span><div style="flex:1;min-width:0"><b>${esc(r.Titulo)}</b><div class="peq">${esc(fmtDH(r.Inicio))}${r.Fim ? ' → ' + esc(fmtDH(r.Fim)) : ''}${l ? ' · ' + esc(l.Nome) : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${badges.join('')}${anexos.length ? `<span class="etiqueta">📎 ${anexos.length}${anexos.every(a => S.offline.has(a.ID)) ? ' offline' : ''}</span>` : ''}</div></div></div>
    <div class="b2"><span class="peq">${esc(r.Fornecedor || r.Tipo)}</span><span class="codigo">${esc(r.Codigo || '—')}</span></div></div>`;
}
TELAS.reservas = () => {
  const f = S.ui.filtroRes || 'todas';
  let l = daV('Reservas');
  if (f !== 'todas') l = l.filter(r => r.Tipo === f);
  l.sort((a, b) => String(a.Inicio || a.Fim || '9').localeCompare(String(b.Inicio || b.Fim || '9')));
  const tipos = [...new Set(daV('Reservas').map(r => r.Tipo))];
  return {
    titulo: 'reservas',
    html: `<div class="chips">${['todas'].concat(tipos).map(t => `<button class="chip ${f === t ? 'on' : ''}" data-a="filtro-res" data-f="${t}">${t === 'todas' ? 'Todas' : (ICONE_RESERVA[t] || '') + ' ' + esc(t)}</button>`).join('')}</div>
      ${l.length ? l.map(bilheteHtml).join('') : vazio('Nenhuma reserva registrada.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="nova-reserva">+ Reserva</button>' : ''}`
  };
};
AC['filtro-res'] = el => { S.ui.filtroRes = el.dataset.f; render(); };
AC['nova-reserva'] = el => {
  const cid = el && el.dataset && el.dataset.id && ach('Cidades', el.dataset.id);
  formReserva(null, cid ? { Tipo: 'hospedagem', Titulo: 'Hospedagem em ' + cid.Nome, Inicio: cid.Chegada ? cid.Chegada + 'T15:00' : '', Fim: cid.Saida ? cid.Saida + 'T11:00' : '' } : {});
};
function formReserva(id, pre) {
  formulario('Reservas', id, { titulo: id ? 'Editar reserva' : 'Nova reserva', padroes: Object.assign({ ResponsavelID: euId() }, pre || {}),
    campos: ['Tipo', 'Titulo', 'Codigo', 'Fornecedor', 'Inicio', 'Fim', 'LugarID', 'LugarDestinoID', 'Pessoas', 'Valor', 'Moeda', 'Pagamento', 'PrazoPagamento', 'PrazoCancelamento', 'PoliticaCancelamento', 'ResponsavelID', 'Notas'],
    ajuda: { LugarID: 'Para hospedagem: cadastre antes o lugar (com endereço) em Lugares.', PrazoCancelamento: 'O app avisa por e-mail 7 e 2 dias antes.' }, msg: id ? 'Reserva alterada' : 'Reserva salva' });
}
AC['abrir-reserva'] = el => {
  const r = ach('Reservas', el.dataset.id);
  if (!r) return;
  abrirPainel({
    titulo: r.Titulo,
    render: () => {
      const l = ach('Lugares', r.LugarID), d = ach('Lugares', r.LugarDestinoID);
      const anexos = daV('Anexos').filter(a => a.VinculoTipo === 'reserva' && a.VinculoID === r.ID);
      return `${r.Codigo ? `<div class="codigo-gigante" data-a="copiar" data-t="${esc(r.Codigo)}">${esc(r.Codigo)}</div><p class="mpeq" style="text-align:center;margin-top:-4px">toque para copiar · mostre no balcão</p>` : ''}
        <div class="lista">
          ${itemHtml({ ic: ICONE_RESERVA[r.Tipo] || '📄', t: esc(r.Tipo) + (r.Fornecedor ? ' · ' + esc(r.Fornecedor) : ''), s: esc(fmtDH(r.Inicio)) + (r.Fim ? ' → ' + esc(fmtDH(r.Fim)) : '') })}
          ${r.Valor !== '' && r.Valor !== undefined ? itemHtml({ ic: '💶', t: mv(r.Valor, r.Moeda), s: esc(r.Pagamento) + (r.PrazoPagamento ? ' · pagar até ' + fmtDia(r.PrazoPagamento) : '') }) : ''}
          ${r.PrazoCancelamento ? itemHtml({ ic: '↩️', t: 'Cancelamento grátis até ' + esc(fmtDia(r.PrazoCancelamento)), s: esc(r.PoliticaCancelamento || '') }) : ''}
          ${N_lista(r.Pessoas).length ? itemHtml({ ic: '👪', t: N_lista(r.Pessoas).map(pessoaNome).map(esc).join(', ') }) : ''}
          ${r.ResponsavelID ? itemHtml({ ic: '🙋', t: 'Responsável: ' + esc(pessoaNome(r.ResponsavelID)) }) : ''}
        </div>
        ${l ? `<div class="cartao"><h3>${esc(l.Nome)}</h3><p class="peq">${esc(l.Endereco || '')}</p>${l.Telefone ? `<a href="tel:${esc(l.Telefone)}">☎ ${esc(l.Telefone)}</a>` : ''}${botoesMapa(l)}</div>` : ''}
        ${d ? `<div class="cartao"><div class="peq">Destino</div><h3>${esc(d.Nome)}</h3>${botoesMapa(d)}</div>` : ''}
        ${r.Notas ? `<div class="cartao" style="white-space:pre-wrap">${esc(r.Notas)}</div>` : ''}
        <div class="secao-topo"><div class="rotulo">Documentos</div>${podeEditar() ? `<button class="btn" style="min-height:40px" data-a="doc-reserva" data-id="${r.ID}">+ Anexar</button>` : ''}</div>
        ${anexos.length ? `<div class="lista">${anexos.map(docItem).join('')}</div>` : '<p class="peq">Anexe o voucher ou a passagem: os das reservas dos próximos 3 dias ficam guardados no aparelho automaticamente.</p>'}`;
    },
    rodape: podeEditar() ? `<div class="botoes"><button class="btn" data-a="despesa-da-reserva" data-id="${r.ID}">Lançar despesa</button><button class="btn prim" data-a="editar-reserva" data-id="${r.ID}">Editar</button></div>` : undefined
  });
};
AC['editar-reserva'] = el => formReserva(el.dataset.id);
AC['doc-reserva'] = el => { const r = ach('Reservas', el.dataset.id); formAnexo({ vinculoTipo: 'reserva', vinculoId: r.ID, titulo: r.Titulo, tipo: r.Tipo === 'voo' ? 'passagem' : 'voucher' }); };
AC['despesa-da-reserva'] = el => {
  const r = ach('Reservas', el.dataset.id);
  const mapa = { voo: 'Passagens aéreas', hospedagem: 'Hospedagem', carro: 'Carro, combustível e pedágio', trem: 'Transporte', ingresso: 'Passeios e ingressos', restaurante: 'Alimentação' };
  const cat = categorias().find(c => c.Nome === mapa[r.Tipo]);
  fecharPainel(true);
  formDespesa(null, { Valor: r.Valor, Moeda: r.Moeda || undefined, CategoriaID: cat ? cat.ID : '', Descricao: r.Titulo, ReservaID: r.ID, Data: String(r.Inicio || '').slice(0, 10) || hoje(), ForaDivisao: r.Tipo === 'voo' });
};
AC['copiar'] = async el => { try { await navigator.clipboard.writeText(el.dataset.t); toast('Copiado'); } catch (e) { toast('Não foi possível copiar'); } };

/* ============================== TAREFAS ============================== */
TELAS.tarefas = () => {
  const h = hoje();
  const so = S.ui.minhasTarefas;
  let l = daV('Tarefas');
  if (so) l = l.filter(t => t.ResponsavelID === euId());
  const grupos = [
    ['Atrasadas', l.filter(t => t.Status !== 'feito' && t.Prazo && t.Prazo < h)],
    ['Próximas 2 semanas', l.filter(t => t.Status !== 'feito' && t.Prazo && t.Prazo >= h && t.Prazo <= somaDias(h, 14))],
    ['Depois', l.filter(t => t.Status !== 'feito' && t.Prazo && t.Prazo > somaDias(h, 14))],
    ['Sem prazo', l.filter(t => t.Status !== 'feito' && !t.Prazo)],
    ['Feitas', l.filter(t => t.Status === 'feito')]
  ];
  const item = t => `<div class="item ${t._pendente ? 'pendente' : ''}"><input type="checkbox" data-a="tarefa-check" data-id="${t.ID}" ${t.Status === 'feito' ? 'checked' : ''} ${podeEditar() ? '' : 'disabled'} style="width:26px;height:26px;accent-color:var(--acao)" aria-label="Feito">
    <button type="button" class="corpo" data-a="abrir-tarefa" data-id="${t.ID}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer"><span class="t" ${t.Status === 'feito' ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${t.Tipo === 'mapas' ? '🗺️ ' : ''}${esc(t.Titulo)}</span>
    <span class="s">${t.Prazo ? esc(fmtDia(t.Prazo)) : 'sem prazo'} · ${esc(t.ResponsavelID ? pessoaNome(t.ResponsavelID) : 'sem responsável')}</span></button></div>`;
  return {
    titulo: 'tarefas',
    html: `<div class="chips"><button class="chip ${!so ? 'on' : ''}" data-a="tarefas-filtro" data-v="">Todas</button><button class="chip ${so ? 'on' : ''}" data-a="tarefas-filtro" data-v="1">Minhas</button></div>
      ${grupos.filter(g => g[1].length).map(g => g[0] === 'Feitas' ? `<details><summary class="rotulo" style="cursor:pointer">Feitas (${g[1].length})</summary><div class="lista">${g[1].map(item).join('')}</div></details>`
        : `<div class="rotulo" ${g[0] === 'Atrasadas' ? 'style="color:var(--erro)"' : ''}>${g[0]} (${g[1].length})</div><div class="lista">${g[1].sort((a, b) => String(a.Prazo).localeCompare(String(b.Prazo))).map(item).join('')}</div>`).join('') || vazio('Nenhuma tarefa.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="nova-tarefa">+ Tarefa</button>' : ''}`
  };
};
AC['tarefas-filtro'] = el => { S.ui.minhasTarefas = !!el.dataset.v; render(); };
AC['tarefa-check'] = el => { const t = ach('Tarefas', el.dataset.id); salvar('Tarefas', t.ID, { Status: t.Status === 'feito' ? 'a fazer' : 'feito' }, { msg: t.Status === 'feito' ? 'Reaberta' : 'Feito ✓' }); };
AC['abrir-tarefa'] = el => {
  const t = ach('Tarefas', el.dataset.id);
  formulario('Tarefas', t.ID, { titulo: 'Tarefa', campos: ['Titulo', 'Tipo', 'ResponsavelID', 'Prazo', 'Status', 'AvisarDiasAntes', 'ReservaID', 'Notas'],
    topo: t.Notas && t.Tipo === 'mapas' ? `<div class="aviso info">${esc(t.Notas)}</div>` : '',
    aoAbrir: p => { if (t.ResponsavelID && t.ResponsavelID !== euId()) $('.rodape .botoes', p).insertAdjacentHTML('afterbegin', `<button class="btn" data-a="tarefa-whats" data-id="${t.ID}">Lembrar</button>`); } });
};
AC['tarefa-whats'] = el => { const t = ach('Tarefas', el.dataset.id); abrirWhats(N_preencher(mensagem('Lembrete de tarefa'), { nome: pessoaNome(t.ResponsavelID), viagem: viagem().Nome, tarefa: t.Titulo, prazo: t.Prazo ? fmtDia(t.Prazo) : 'sem prazo' })); };

/* ============================== DECISÕES ============================== */
TELAS.decisoes = () => {
  const l = daV('Votacoes').sort((a, b) => (a.Status === 'aberta' ? 0 : 1) - (b.Status === 'aberta' ? 0 : 1) || String(a.Prazo || '9').localeCompare(String(b.Prazo || '9')));
  return {
    titulo: 'decisões em grupo',
    html: `<p class="peq">Liste opções (hotel, passeio, restaurante), cada um vota e o organizador registra a decisão.</p>
      ${l.length ? `<div class="lista">${l.map(v => { const n = new Set(daV('Votos').filter(x => x.VotacaoID === v.ID).map(x => x.PessoaID)).size; const votei = daV('Votos').some(x => x.VotacaoID === v.ID && x.PessoaID === euId());
        return itemHtml({ a: 'abrir-votacao', id: v.ID, ic: v.Status === 'decidida' ? '✅' : v.Status === 'cancelada' ? '✖️' : '🗳️', t: esc(v.Pergunta),
          s: v.Status === 'decidida' ? 'decidido: ' + esc(nomeDe('Opcoes', v.OpcaoEscolhidaID)) : `${n} votaram${v.Status === 'aberta' && !votei ? ' · <b>falta o seu</b>' : ''}${v.Prazo ? ' · até ' + fmtDiaCurto(v.Prazo) : ''}`, pend: v._pendente }); }).join('')}</div>` : vazio('Nenhuma votação.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="nova-votacao">+ Votação</button>' : ''}`
  };
};
AC['nova-votacao'] = () => {
  abrirPainel({ titulo: 'Nova votação', html: `${campoHtml(ESQUEMA.Votacoes.porNome.Pergunta, '')}${campoHtml(ESQUEMA.Votacoes.porNome.Prazo, '')}
    <div class="campo"><span>Opções (uma por linha)</span><textarea id="vot-ops" placeholder="Hotel A&#10;Apartamento B"></textarea></div>`,
    rodape: '<button class="btn prim bloco" data-a="votacao-criar">Criar</button>' });
  AC['votacao-criar'] = () => {
    const p = _painel.el;
    const perg = $('[data-campo="Pergunta"]', p).value.trim(), prazo = $('[data-campo="Prazo"]', p).value;
    const ops = $('#vot-ops', p).value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!perg || ops.length < 2) { toast('Escreva a pergunta e pelo menos 2 opções.'); return; }
    emLote('Votação criada', () => { const v = salvar('Votacoes', null, { Pergunta: perg, Prazo: prazo }); ops.forEach(o => salvar('Opcoes', null, { VotacaoID: v.ID, Titulo: o, CriadaPor: euId() })); });
    fecharPainel();
    if (confirm('Avisar o grupo pelo WhatsApp?')) abrirWhats(N_preencher(mensagem('Votação aberta'), { pergunta: perg, viagem: viagem().Nome, prazo: prazo ? fmtDia(prazo) : 'sem prazo' }));
  };
};
AC['abrir-votacao'] = el => {
  const id = el.dataset.id;
  abrirPainel({
    titulo: 'Votação',
    render: () => {
      const v = ach('Votacoes', id);
      if (!v) return '';
      const ops = daV('Opcoes').filter(o => o.VotacaoID === id);
      const votos = daV('Votos').filter(x => x.VotacaoID === id);
      const max = Math.max(1, ...ops.map(o => votos.filter(x => x.OpcaoID === o.ID).length));
      return `<h2 style="margin-bottom:6px">${esc(v.Pergunta)}</h2><p class="peq">${v.Status === 'aberta' ? 'Toque numa opção para votar ou tirar o voto. Pode votar em mais de uma.' : v.Status === 'decidida' ? 'Decidida por ' + esc(pessoaNome(v.DecididaPor)) : 'Cancelada'}${v.Prazo ? ' · prazo ' + fmtDia(v.Prazo) : ''}</p>
        ${ops.map(o => { const vs = votos.filter(x => x.OpcaoID === o.ID); const meu = vs.find(x => x.PessoaID === euId());
          return `<div class="cartao ${v.Status === 'aberta' && podeEditar() ? 'toque' : ''}" ${v.Status === 'aberta' && podeEditar() ? `data-a="votar" data-id="${o.ID}"` : ''} style="${meu ? 'border-color:var(--acao);outline:2px solid var(--acao)' : ''}${v.OpcaoEscolhidaID === o.ID ? ';background:var(--ok-suave)' : ''}">
            <div style="display:flex;justify-content:space-between;gap:8px"><b>${v.OpcaoEscolhidaID === o.ID ? '✅ ' : ''}${esc(o.Titulo)}</b><span>${vs.length} ${meu ? '· seu voto' : ''}</span></div>
            ${o.Preco !== '' && o.Preco !== undefined ? `<div class="peq">${mv(o.Preco, o.Moeda || moedaAcerto())}</div>` : ''}${o.Link ? `<a href="${esc(o.Link)}" target="_blank" rel="noopener" class="peq" onclick="event.stopPropagation()">abrir link</a>` : ''}
            <div class="barra-orc"><i style="width:${Math.round(vs.length * 100 / max)}%;background:var(--info)"></i></div>
            <div style="display:flex;gap:4px;margin-top:6px">${vs.map(x => avatar(x.PessoaID, 26)).join('')}</div></div>`; }).join('')}`;
    },
    rodape: () => { const v = ach('Votacoes', id); return v && v.Status === 'aberta' && podeEditar() ? `<div class="botoes"><button class="btn" data-a="nova-opcao" data-id="${id}">+ Opção</button>${souOrg() ? `<button class="btn prim" data-a="decidir" data-id="${id}">Decidir</button>` : ''}</div>` : ''; }
  });
};
AC['votar'] = el => {
  const o = ach('Opcoes', el.dataset.id);
  const meu = daV('Votos').find(x => x.OpcaoID === o.ID && x.PessoaID === euId());
  if (meu) excluir('Votos', meu.ID, { msg: 'Voto retirado' });
  else salvar('Votos', null, { VotacaoID: o.VotacaoID, OpcaoID: o.ID, PessoaID: euId() }, { msg: 'Voto registrado' });
};
AC['nova-opcao'] = el => formulario('Opcoes', null, { titulo: 'Nova opção', fixos: { VotacaoID: el.dataset.id, CriadaPor: euId() }, padroes: { Moeda: moedaAcerto() }, campos: ['Titulo', 'Link', 'Preco', 'Moeda', 'LugarID', 'Notas'] });
AC['decidir'] = el => {
  const id = el.dataset.id;
  const ops = daV('Opcoes').filter(o => o.VotacaoID === id);
  abrirPainel({ titulo: 'Qual foi a decisão?', html: `<div class="lista">${ops.map(o => itemHtml({ a: 'decidir-opcao', id: o.ID, ic: '✅', t: esc(o.Titulo), s: plural(daV('Votos').filter(x => x.OpcaoID === o.ID).length, 'voto') })).join('')}</div>
    <button class="btn perigo bloco" data-a="cancelar-votacao" data-id="${id}">Cancelar votação</button>` });
  AC['decidir-opcao'] = b => { salvar('Votacoes', id, { Status: 'decidida', OpcaoEscolhidaID: b.dataset.id }, { msg: 'Decisão registrada' }); fecharPainel(); };
  AC['cancelar-votacao'] = () => { salvar('Votacoes', id, { Status: 'cancelada' }); fecharPainel(); };
};

/* ============================== CHECKLISTS ============================== */
TELAS.checklists = () => {
  const l = daV('Checklists');
  const prog = c => { const it = daV('ChecklistItens').filter(i => i.ChecklistID === c.ID); const f = it.filter(i => i.Feito === 'sim').length; return { f, n: it.length }; };
  return {
    titulo: 'malas e listas',
    html: `${l.length ? `<div class="lista">${l.map(c => { const p = prog(c); return itemHtml({ a: 'ir', id: c.ID, extra: `data-h="#/checklist/${c.ID}"`, ic: { mala: '🧳', documentos: '🛂', 'saída de casa': '🏠' }[c.Tipo] || '📋',
      t: esc(c.Nome), s: (c.DonoPessoaID ? esc(pessoaNome(c.DonoPessoaID)) + ' · ' : '') + `${p.f}/${p.n} feitos`, v: p.n && p.f === p.n ? '✅' : '' }); }).join('')}</div>` : vazio('Crie listas a partir dos modelos: mala de bebê, criança, adulto, idoso, documentos e "antes de sair de casa".')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="nova-lista">+ Lista</button>' : ''}`
  };
};
AC['nova-lista'] = () => {
  const mods = vivos('Modelos');
  abrirPainel({ titulo: 'Nova lista', html: `<label class="campo"><span>Modelo</span><select id="cl-mod"><option value="">Em branco</option>${mods.map(x => `<option value="${x.ID}">${esc(x.Nome)}</option>`).join('')}</select></label>
    <label class="campo"><span>De quem (para malas)</span><select id="cl-dono"><option value="">Do grupo</option>${pessoasDaViagem().map(p => `<option value="${p.ID}">${esc(p.Nome)}</option>`).join('')}</select></label>
    <label class="campo"><span>Nome da lista</span><input id="cl-nome" placeholder="Ex.: Mala do Arthur"></label>`,
    rodape: '<button class="btn prim bloco" data-a="lista-criar">Criar</button>',
    depois: el => { const up = () => { const md = ach('Modelos', $('#cl-mod', el).value), dn = $('#cl-dono', el).value; $('#cl-nome', el).value = (md ? md.Nome.replace(/ –.*/, '') : 'Lista') + (dn ? ' – ' + pessoaNome(dn) : ''); }; $('#cl-mod', el).onchange = up; $('#cl-dono', el).onchange = up; } });
  AC['lista-criar'] = () => {
    const p = _painel.el, mid = $('#cl-mod', p).value, md = ach('Modelos', mid);
    const nome = $('#cl-nome', p).value.trim() || (md ? md.Nome : 'Lista');
    const c = emLote('Lista criada', () => {
      const ch = salvar('Checklists', null, { Nome: nome, Tipo: md ? md.Tipo : 'outro', DonoPessoaID: $('#cl-dono', p).value, ModeloID: mid });
      vivos('ModeloItens').filter(i => i.ModeloID === mid).sort((a, b) => (a.Ordem || 0) - (b.Ordem || 0)).forEach((i, k) => salvar('ChecklistItens', null, { ChecklistID: ch.ID, Texto: i.Texto, Qtde: i.Qtde, Ordem: k + 1 }));
      return ch;
    });
    fecharPainel(true);
    ir('#/checklist/' + c.ID);
  };
};
TELAS.checklist = args => {
  const c = ach('Checklists', args[0]);
  if (!c) return vazio('Lista não encontrada.');
  const it = daV('ChecklistItens').filter(i => i.ChecklistID === c.ID).sort((a, b) => (a.Feito === 'sim') - (b.Feito === 'sim') || (a.Ordem || 0) - (b.Ordem || 0));
  const f = it.filter(i => i.Feito === 'sim').length;
  return {
    titulo: c.Nome,
    html: `<div class="secao-topo"><h2>${esc(c.Nome)}</h2><span class="etiqueta ${f === it.length && it.length ? 'ok' : ''}">${f}/${it.length}</span></div>
      <div class="lista">${it.map(i => `<div class="item ${i._pendente ? 'pendente' : ''}"><input type="checkbox" data-a="item-check" data-id="${i.ID}" ${i.Feito === 'sim' ? 'checked' : ''} style="width:28px;height:28px;accent-color:var(--acao)" aria-label="Feito">
        <span class="corpo" ${i.Feito === 'sim' ? 'style="text-decoration:line-through;opacity:.6"' : ''}><span class="t">${esc(i.Texto)}${i.Qtde ? ' <span class="peq">×' + i.Qtde + '</span>' : ''}</span>${i.Feito === 'sim' && i.FeitoPor ? `<span class="s">${esc(pessoaNome(i.FeitoPor))}</span>` : ''}</span>
        <button class="icone-btn" data-a="item-excluir" data-id="${i.ID}" aria-label="Remover" style="border:0;background:none">✕</button></div>`).join('') || '<div class="item">Lista vazia.</div>'}</div>
      ${podeEditar() ? `<form id="add-item" style="display:flex;gap:8px"><input id="novo-item" placeholder="Novo item" style="flex:1;min-height:48px;border-radius:12px;border:1px solid var(--linha);padding:0 12px;background:var(--cartao)"><button class="btn prim">Adicionar</button></form>` : ''}
      <div class="botoes" style="margin-top:14px"><button class="btn" data-a="ir" data-h="#/checklists">← Listas</button>${podeEditar() ? `<button class="btn perigo" data-a="lista-excluir" data-id="${c.ID}">Excluir lista</button>` : ''}</div>`,
    depois: el => { const fm = $('#add-item', el); if (fm) fm.onsubmit = e => { e.preventDefault(); const t = $('#novo-item').value.trim(); if (!t) return; salvar('ChecklistItens', null, { ChecklistID: c.ID, Texto: t, Ordem: it.length + 1 }, { semDesfazer: true }); setTimeout(() => { const i = $('#novo-item'); if (i) i.focus(); }, 50); }; }
  };
};
AC['item-check'] = el => { const i = ach('ChecklistItens', el.dataset.id); salvar('ChecklistItens', i.ID, { Feito: i.Feito === 'sim' ? 'não' : 'sim' }, { semDesfazer: true }); };
AC['item-excluir'] = el => excluir('ChecklistItens', el.dataset.id, { msg: 'Item removido' });
AC['lista-excluir'] = async el => { if (!(await confirmar('Excluir a lista inteira?', { ok: 'Excluir', perigo: true }))) return; emLote('Lista excluída', () => { daV('ChecklistItens').filter(i => i.ChecklistID === el.dataset.id).forEach(i => excluir('ChecklistItens', i.ID)); excluir('Checklists', el.dataset.id); }); ir('#/checklists'); };

/* ============================== DOCUMENTOS ============================== */
function docItem(a) {
  const h = hoje();
  const vis = { grupo: 'todos', família: 'família', pessoal: 'só eu' }[a.Visibilidade] || a.Visibilidade;
  const venc = a.Validade && a.Validade <= somaDias(h, 180) ? `<span class="etiqueta ${a.Validade < h ? 'erro' : 'alerta'}">vence ${fmtDiaCurto(a.Validade)}</span>` : '';
  return `<div class="item ${a._pendente ? 'pendente' : ''}"><button type="button" class="corpo" data-a="doc-abrir" data-id="${a.ID}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer;display:flex;gap:12px;align-items:center">
    <span class="emoji">${/pdf/.test(a.Mime) ? '📄' : /image/.test(a.Mime) ? '🖼️' : '📎'}</span><span style="min-width:0"><span class="t">${esc(a.Titulo)}</span><span class="s">${esc(a.Tipo)} · ${esc(vis)} ${venc}</span></span></button>
    <button class="icone-btn" data-a="doc-menu" data-id="${a.ID}" aria-label="Opções" title="${S.offline.has(a.ID) ? 'Guardado no aparelho' : 'Só online'}">${S.offline.has(a.ID) ? '✓' : '⋯'}</button></div>`;
}
TELAS.docs = () => {
  const l = daV('Anexos').filter(a => a.Oculto !== 'sim');
  const grupos = {};
  l.forEach(a => (grupos[a.Tipo] = grupos[a.Tipo] || []).push(a));
  return {
    titulo: 'documentos',
    html: `<p class="peq">✓ = guardado neste aparelho (abre sem internet). Documentos pessoais com "só eu" ou "família" não aparecem para os outros.</p>
      ${Object.keys(grupos).length ? Object.keys(grupos).map(g => `<div class="rotulo">${esc(g)}</div><div class="lista">${grupos[g].map(docItem).join('')}</div>`).join('') : vazio('Nenhum documento.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="novo-doc">+ Documento</button>' : ''}`
  };
};
AC['doc-abrir'] = async el => {
  const id = el.dataset.id;
  toast('Abrindo…', { ms: 20000 });
  try { const a = await obterAnexo(id); $$('.torrada').forEach(t => t.remove()); await abrirArquivo(a); render(true); }
  catch (e) { toast(e.message, { ms: 6000 }); }
};
AC['doc-menu'] = el => {
  const a = ach('Anexos', el.dataset.id);
  const dono = a.DonoPessoaID === euId();
  abrirPainel({ titulo: a.Titulo, html: `<p class="peq">Enviado por ${esc(pessoaNome(a.DonoPessoaID))} · ${esc(a.NomeArquivo || '')}${a.Tamanho ? ' · ' + Math.round(a.Tamanho / 1024) + ' KB' : ''}</p>
    <div class="lista">
      ${itemHtml({ a: 'doc-offline', id: a.ID, ic: S.offline.has(a.ID) ? '✓' : '⤓', t: S.offline.has(a.ID) ? 'Remover deste aparelho' : 'Guardar neste aparelho', s: 'para abrir sem internet' })}
      ${dono || souOrg() ? itemHtml({ a: 'doc-editar', id: a.ID, ic: '✏️', t: 'Editar título, tipo e quem pode ver' }) : ''}
      ${dono || souOrg() ? itemHtml({ a: 'doc-excluir', id: a.ID, ic: '🗑️', t: 'Excluir' }) : ''}
    </div>` });
};
AC['doc-offline'] = async el => {
  const id = el.dataset.id;
  if (S.offline.has(id)) { await idb.del('arquivos', id); S.offline.delete(id); toast('Removido do aparelho'); }
  else { try { await baixarAnexo(id); toast('Guardado no aparelho'); } catch (e) { toast(e.message); } }
  fecharPainel(); render(true);
};
AC['doc-editar'] = el => formulario('Anexos', el.dataset.id, { titulo: 'Documento', campos: ['Titulo', 'Tipo', 'Visibilidade', 'Validade'] });
AC['doc-excluir'] = async el => { if (!(await confirmar('Excluir este documento?', { ok: 'Excluir', perigo: true }))) return; excluir('Anexos', el.dataset.id); fecharPainel(); };

/* ============================== LUGARES ============================== */
TELAS.lugares = () => {
  const f = S.ui.filtroLug || 'todos';
  let l = daV('Lugares');
  if (f !== 'todos') l = l.filter(x => x.Status === f);
  const porCid = {};
  l.forEach(x => (porCid[x.CidadeID || ''] = porCid[x.CidadeID || ''] || []).push(x));
  return {
    titulo: 'lugares',
    html: `<div class="chips">${['todos', 'ideia', 'agendado', 'reservado'].map(s => `<button class="chip ${f === s ? 'on' : ''}" data-a="filtro-lug" data-f="${s}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
      ${Object.keys(porCid).map(k => `<div class="rotulo">${esc(nomeDe('Cidades', k) || 'Sem cidade')}</div><div class="lista">${porCid[k].sort((a, b) => a.Nome.localeCompare(b.Nome)).map(x => itemHtml({ a: 'abrir-lugar', id: x.ID, ic: ICONE_TIPO[x.Tipo] || '📍', t: esc(x.Nome), s: esc(x.Status) + (x.Lat === '' ? ' · <b style="color:var(--alerta)">sem coordenadas</b>' : '') + (x.Endereco ? ' · ' + esc(x.Endereco) : ''), pend: x._pendente })).join('')}</div>`).join('') || vazio('Nenhum lugar.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="novo-lugar">+ Lugar</button>' : ''}`
  };
};
AC['filtro-lug'] = el => { S.ui.filtroLug = el.dataset.f; render(); };
AC['abrir-lugar'] = el => {
  const l = ach('Lugares', el.dataset.id);
  if (!l) return;
  const avs = daV('Avaliacoes').filter(a => a.LugarID === l.ID);
  const media = avs.length ? (avs.reduce((s, a) => s + Number(a.Nota), 0) / avs.length).toFixed(1).replace('.', ',') : null;
  const ats = daV('Atividades').filter(a => a.LugarID === l.ID);
  abrirPainel({
    titulo: l.Nome,
    html: `<p class="peq">${ICONE_TIPO[l.Tipo] || '📍'} ${esc(l.Tipo)} · ${esc(l.Status)}${l.CidadeID ? ' · ' + esc(nomeDe('Cidades', l.CidadeID)) : ''}${media ? ' · ★ ' + media + ' (' + avs.length + ')' : ''}</p>
      ${l.Endereco ? `<p>${esc(l.Endereco)}</p>` : ''}${l.Telefone ? `<a class="btn" href="tel:${esc(l.Telefone)}">☎ ${esc(l.Telefone)}</a>` : ''}
      ${botoesMapa(l)}
      ${l.Acessibilidade ? `<div class="aviso info">♿ ${esc(l.Acessibilidade)}</div>` : ''}
      ${l.Notas ? `<div class="cartao" style="white-space:pre-wrap">${esc(l.Notas)}</div>` : ''}
      ${l.Link ? `<p><a href="${esc(l.Link)}" target="_blank" rel="noopener">Abrir link</a></p>` : ''}
      ${ats.length ? `<div class="rotulo">No roteiro</div><div class="lista">${ats.map(a => itemHtml({ a: 'abrir-atividade', id: a.ID, ic: '🗓️', t: esc(fmtDia(a.Data)), s: esc(a.HoraInicio || '') + ' ' + esc(a.Titulo) })).join('')}</div>` : ''}
      ${avs.length ? `<div class="rotulo">Avaliações</div>${avs.map(a => `<div class="cartao"><b>${'★'.repeat(Number(a.Nota))}${'☆'.repeat(5 - Number(a.Nota))}</b> · ${esc(pessoaNome(a.PessoaID))}${a.Voltaria === 'sim' ? ' · voltaria' : a.Voltaria === 'não' ? ' · não voltaria' : ''}${a.Comentario ? `<div class="peq">${esc(a.Comentario)}</div>` : ''}</div>`).join('')}` : ''}`,
    rodape: `<div class="botoes">${l.Lat !== '' ? `<button class="btn" data-a="ver-no-mapa" data-id="${l.ID}">Mapa</button>` : ''}${podeEditar() ? `<button class="btn" data-a="por-no-roteiro" data-id="${l.ID}">Pôr no roteiro</button><button class="btn" data-a="avaliar" data-id="${l.ID}">Avaliar</button><button class="btn prim" data-a="editar-lugar" data-id="${l.ID}">Editar</button>` : ''}</div>`
  });
};
AC['editar-lugar'] = el => formLugar(el.dataset.id);
AC['avaliar'] = el => {
  const meu = daV('Avaliacoes').find(a => a.LugarID === el.dataset.id && a.PessoaID === euId());
  formulario('Avaliacoes', meu ? meu.ID : null, { titulo: 'Avaliar ' + nomeDe('Lugares', el.dataset.id), fixos: { LugarID: el.dataset.id, PessoaID: euId() }, campos: ['Nota', 'Voltaria', 'Comentario'], msg: 'Avaliação salva' });
};

/* ============================== INFORMAÇÕES ============================== */
TELAS.infos = () => {
  const cats = {};
  daV('Infos').forEach(i => (cats[i.Categoria] = cats[i.Categoria] || []).push(i));
  return {
    titulo: 'informações úteis',
    html: `${daV('Cidades').map(c => `<div class="cartao"><h3>${esc(c.Nome)}</h3><p class="peq">Moeda ${esc(c.Moeda || '—')} · fuso ${esc(c.Fuso || '—')}${c.Idioma ? ' · ' + esc(c.Idioma) : ''}${c.Tomada ? ' · tomada ' + esc(c.Tomada) : ''}${c.Emergencia ? ` · emergência <a href="tel:${esc(c.Emergencia)}">${esc(c.Emergencia)}</a>` : ''}</p></div>`).join('')}
      ${Object.keys(cats).map(k => `<div class="rotulo">${esc(k)}</div><div class="lista">${cats[k].map(i => `<div class="item"><button type="button" class="corpo" data-a="editar-info" data-id="${i.ID}" style="background:none;border:0;text-align:left;padding:0;cursor:pointer"><span class="t">${esc(i.Titulo)}${i.CidadeID ? ' <span class="peq">· ' + esc(nomeDe('Cidades', i.CidadeID)) + '</span>' : ''}</span><span class="s" style="white-space:pre-wrap">${esc(i.Conteudo || '')}</span></button>${i.Telefone ? `<a class="btn" href="tel:${esc(i.Telefone)}" style="min-height:40px">☎</a>` : ''}</div>`).join('')}</div>`).join('')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="nova-info">+ Informação</button>' : ''}`
  };
};
AC['editar-info'] = el => formulario('Infos', el.dataset.id, { titulo: 'Informação', campos: ['Categoria', 'Titulo', 'Conteudo', 'Telefone', 'CidadeID'] });

/* ============================== DIÁRIO ============================== */
TELAS.diario = () => {
  const l = daV('Diario').sort((a, b) => b.Data.localeCompare(a.Data));
  const dias = [...new Set(l.map(d => d.Data))];
  return {
    titulo: 'diário',
    html: `${dias.map(d => `<div class="rotulo">${esc(fmtDia(d))}</div>${l.filter(x => x.Data === d).map(x => `<div class="cartao toque" data-a="editar-diario" data-id="${x.ID}"><div class="cartao-topo">${avatar(x.PessoaID, 32)}<div><div class="peq">${esc(pessoaNome(x.PessoaID))}</div><div style="white-space:pre-wrap">${esc(x.Texto)}</div></div></div></div>`).join('')}`).join('') || vazio('Ninguém escreveu ainda.')}
      ${podeEditar() ? '<button class="btn prim bloco" data-a="novo-diario">Escrever</button>' : ''}`
  };
};

/* ============================== GRUPO ============================== */
TELAS.grupo = () => {
  const porFam = {};
  participantes().forEach(p => (porFam[p.FamiliaID] = porFam[p.FamiliaID] || []).push(p));
  return {
    titulo: 'grupo',
    html: `${Object.keys(porFam).map(f => `<div class="rotulo">${esc(nomeDe('Familias', f) || 'Família')}</div><div class="lista">${porFam[f].map(p => {
      const pe = ach('Pessoas', p.PessoaID) || {};
      return `<button type="button" class="item ${p._pendente ? 'pendente' : ''}" ${souOrg() ? `data-a="editar-part" data-id="${p.ID}"` : ''}>${avatar(p.PessoaID)}<span class="corpo"><span class="t">${esc(pe.Nome || '?')}${pe.ID === euId() ? ' (você)' : ''}</span>
        <span class="s">${esc(pe.Tipo || '')} · cota ${String(p.CotaPadrao).replace('.', ',')}${p.DataEntrada ? ' · entra ' + fmtDiaCurto(p.DataEntrada) : ''}${p.DataSaida ? ' · sai ' + fmtDiaCurto(p.DataSaida) : ''}</span></span>
        <span class="etiqueta ${p.Papel === 'organizador' ? 'info' : ''}">${esc(p.Papel)}</span></button>`;
    }).join('')}</div>`).join('')}
      ${souOrg() ? `<div class="botoes"><button class="btn prim" data-a="nova-pessoa">+ Pessoa</button><button class="btn" data-a="convidar">Convidar</button></div>
        <p class="peq">Organizadores cadastram pessoas, definem PIN provisório e enviam o convite. Crianças não precisam de login.</p>` : ''}`
  };
};
AC['nova-pessoa'] = () => formPessoa(null);
AC['editar-part'] = el => {
  const p = ach('Participantes', el.dataset.id);
  const pe = ach('Pessoas', p.PessoaID) || {};
  if (pe.Tipo === 'adulto' && pe.ID !== euId()) {
    abrirPainel({ titulo: pe.Nome, html: `<div class="lista">${itemHtml({ a: 'editar-part-form', id: p.ID, ic: '✏️', t: 'Editar dados e participação' })}${itemHtml({ a: 'pin-provisorio', id: pe.ID, ic: '🔑', t: 'Definir PIN provisório', s: 'Encerra as sessões abertas dessa pessoa' })}${itemHtml({ a: 'encerrar-sessoes', id: pe.ID, ic: '📵', t: 'Encerrar sessões (celular perdido)' })}</div>` });
  } else formPessoa(p.ID);
};
AC['editar-part-form'] = el => formPessoa(el.dataset.id);
AC['pin-provisorio'] = async el => {
  const pin = prompt('PIN provisório (4 a 6 números):');
  if (!pin) return;
  try { await api('definirPinInicial', { pessoaId: el.dataset.id, pin }); fecharPainel(); toast('PIN definido. Envie em particular.'); } catch (e) { toast(e.message); }
};
AC['encerrar-sessoes'] = async el => { try { const r = await api('encerrarSessoes', { pessoaId: el.dataset.id }); fecharPainel(); toast(plural(r.encerradas, 'sessão encerrada', 'sessões encerradas')); } catch (e) { toast(e.message); } };
AC['convidar'] = async () => {
  try {
    const r = await api('convite', {});
    abrirPainel({ titulo: 'Convidar', html: `<p class="peq">Envie este link para cada adulto. O PIN provisório vai em mensagem separada.</p><div class="cartao mono" style="word-break:break-all;font-size:.8rem">${esc(r.link)}</div>`,
      rodape: `<div class="botoes"><button class="btn" data-a="copiar" data-t="${esc(r.link)}">Copiar</button><button class="btn prim" data-a="convite-whats">WhatsApp</button></div>` });
    AC['convite-whats'] = () => abrirWhats(N_preencher(mensagem('Convite'), { nome: '', viagem: viagem().Nome, link: r.link, pin: '(envio em seguida)' }));
  } catch (e) { toast(e.message); }
};

/* ============================== VIAGENS ============================== */
TELAS.viagens = () => {
  const vs = minhasViagens();
  const h = hoje();
  const grupo = (t, l) => l.length ? `<div class="rotulo">${t}</div><div class="lista">${l.map(v => itemHtml({ a: 'trocar-viagem', id: v.ID, ic: v.ID === S.viagemId ? '●' : '○', t: esc(v.Nome), s: esc(fmtDiaCurto(v.DataInicio)) + ' – ' + esc(fmtDia(v.DataFim, true)) + ' · ' + esc((S.part[v.ID] || {}).papel || '') })).join('')}</div>` : '';
  return {
    titulo: 'viagens',
    html: grupo('Agora', vs.filter(v => v.DataInicio <= h && v.DataFim >= h)) + grupo('Próximas', vs.filter(v => v.DataInicio > h)) + grupo('Passadas', vs.filter(v => v.DataFim < h).reverse()) +
      `<div class="botoes"><button class="btn prim" data-a="nova-viagem">+ Nova viagem</button>${souOrg() ? '<button class="btn" data-a="duplicar-viagem">Duplicar a atual</button>' : ''}</div>`
  };
};
AC['trocar-viagem'] = el => { S.viagemId = el.dataset.id; salvarLocal(); _calc.v = -1; ir('#/hoje'); };
AC['nova-viagem'] = () => formViagem(null);
AC['duplicar-viagem'] = async () => {
  const v = viagem();
  if (!(await confirmar('Criar uma cópia de "' + v.Nome + '" com as mesmas pessoas, cidades (sem datas), lugares e informações?', { ok: 'Duplicar' }))) return;
  const fam = minhaFamilia();
  const nova = emLote('Viagem duplicada', () => {
    const nv = salvar('Viagens', null, { Nome: v.Nome + ' (cópia)', DataInicio: v.DataInicio, DataFim: v.DataFim, MoedaAcerto: v.MoedaAcerto, Status: 'planejando' }, { extra: { familiaId: fam } });
    participantes().filter(p => p.PessoaID !== euId()).forEach(p => salvar('Participantes', null, { ViagemID: nv.ID, PessoaID: p.PessoaID, FamiliaID: p.FamiliaID, Papel: p.Papel, CotaPadrao: p.CotaPadrao }));
    const mapaCid = {};
    daV('Cidades').forEach(c => { const n = salvar('Cidades', null, { ViagemID: nv.ID, Nome: c.Nome, Pais: c.Pais, Moeda: c.Moeda, Fuso: c.Fuso, Lat: c.Lat, Lng: c.Lng, Idioma: c.Idioma, Tomada: c.Tomada, Emergencia: c.Emergencia }); mapaCid[c.ID] = n.ID; });
    daV('Lugares').forEach(l => salvar('Lugares', null, { ViagemID: nv.ID, Nome: l.Nome, Tipo: l.Tipo, Status: 'ideia', CidadeID: mapaCid[l.CidadeID] || '', Endereco: l.Endereco, Lat: l.Lat, Lng: l.Lng, FonteCoord: l.FonteCoord, Link: l.Link, Telefone: l.Telefone, Acessibilidade: l.Acessibilidade, Notas: l.Notas }));
    daV('Infos').forEach(i => salvar('Infos', null, { ViagemID: nv.ID, CidadeID: mapaCid[i.CidadeID] || '', Categoria: i.Categoria, Titulo: i.Titulo, Conteudo: i.Conteudo, Telefone: i.Telefone }));
    return nv;
  });
  salvarParticipacaoLocal(nova.ID, fam);
  S.viagemId = nova.ID; mudou(); ir('#/viagem');
};

/* ============================== AJUSTES ============================== */
TELAS.perfil = () => {
  const eu = ach('Pessoas', euId()) || (S.sessao && S.sessao.pessoa) || {};
  const tema = lsGet('tema') || 'auto', letra = lsGet('letra') || '0';
  return {
    titulo: 'ajustes',
    html: `<div class="cartao"><div class="cartao-topo">${avatar(eu.ID, 48)}<div><h2>${esc(eu.Nome)}</h2><div class="peq">${esc(eu.Email || 'sem e-mail')}${eu.Pix ? ' · Pix ' + esc(eu.Pix) : ''}</div></div></div>
        <button class="btn" data-a="editar-eu" style="margin-top:10px">Editar meus dados</button></div>
      <div class="rotulo">Aparência</div>
      <div class="seg">${[['auto', 'Auto'], ['claro', 'Claro'], ['escuro', 'Escuro'], ['sol', '☀️ Sol']].map(t => `<button class="${tema === t[0] ? 'on' : ''}" data-a="tema" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>
      <p class="peq" style="margin-top:-6px">"Sol" usa contraste máximo para ler na rua.</p>
      <div class="seg">${[['0', 'Aa'], ['1', 'Aa+'], ['2', 'Aa++']].map(t => `<button class="${letra === t[0] ? 'on' : ''}" data-a="letra" data-v="${t[0]}" style="font-size:${1 + Number(t[0]) * 0.12}rem">${t[1]}</button>`).join('')}</div>
      <div class="rotulo">Acesso</div>
      <div class="lista">${itemHtml({ a: 'trocar-pin', ic: '🔑', t: 'Trocar meu PIN' })}${itemHtml({ a: 'sair-todos', ic: '📵', t: 'Sair de todos os aparelhos' })}
        ${!INSTALADO ? itemHtml({ a: IOS ? 'como-instalar' : 'instalar', ic: '📲', t: 'Instalar o app na tela de início', s: 'necessário no iPhone para funcionar sem internet' }) : ''}
        ${itemHtml({ a: 'sair', ic: '🚪', t: 'Sair deste aparelho', s: 'apaga os dados guardados aqui' })}</div>
      <details><summary class="rotulo" style="cursor:pointer">Avançado</summary>
        <div class="cartao"><label class="campo"><span>Ver o app como se hoje fosse…</span><input type="date" id="dia-sim" value="${esc(S.diaSimulado || '')}"></label>
        <p class="peq">Útil para testar a tela "Hoje" durante a viagem. Deixe vazio para usar a data real.</p><button class="btn" data-a="dia-sim">Aplicar</button></div>
        <p class="mpeq">App ${esc(NUCLEO_VERSAO)} · ${S.fila.length} alterações na fila · ${S.offline.size} documentos no aparelho</p></details>`
  };
};
AC['editar-eu'] = () => formulario('Pessoas', euId(), { titulo: 'Meus dados', campos: ['Nome', 'Apelido', 'Email', 'Pix', 'Cor'], podeExcluir: false, ajuda: { Pix: 'Aparece na mensagem de acerto de contas.', Cor: 'Ex.: #1d4ed8' } });
AC['tema'] = el => { lsSet('tema', el.dataset.v); aplicarTema(); render(); };
AC['letra'] = el => { lsSet('letra', el.dataset.v); aplicarTema(); render(); };
AC['trocar-pin'] = () => {
  abrirPainel({ titulo: 'Trocar PIN', html: `<label class="campo"><span>PIN atual</span><input id="pin-atual" inputmode="numeric" type="password" autocomplete="off"></label><label class="campo"><span>Novo PIN (4 a 6 números)</span><input id="pin-novo" inputmode="numeric" type="password" autocomplete="off"></label>`,
    rodape: '<div class="falta" id="pin-falta"></div><button class="btn prim bloco" data-a="pin-trocar">Trocar</button>' });
  AC['pin-trocar'] = async () => {
    try { await api('trocarPin', { atual: $('#pin-atual').value, novo: $('#pin-novo').value }); S.ui.trocarPinSugerido = false; fecharPainel(); toast('PIN trocado'); }
    catch (e) { $('#pin-falta').textContent = e.message; }
  };
};
AC['sair-todos'] = async () => { if (!(await confirmar('Encerrar o acesso em todos os aparelhos (inclusive este)?', { ok: 'Encerrar', perigo: true }))) return; try { await api('encerrarSessoes', { pessoaId: euId() }); } catch (e) { /* ok */ } await sair(); };
AC['sair'] = async () => {
  if (S.fila.length && !(await confirmar(`Há ${S.fila.length} alteração(ões) ainda não enviadas. Se sair agora, elas se perdem.`, { ok: 'Sair mesmo assim', perigo: true }))) return;
  if (!S.fila.length && !(await confirmar('Sair e apagar os dados guardados neste aparelho?', { ok: 'Sair' }))) return;
  await sair();
};
AC['como-instalar'] = () => abrirPainel({ titulo: 'Instalar no iPhone', html: `<ol class="passos-instalar"><li><span>Abra este app no <b>Safari</b>.</span></li><li><span>Toque em <b>Compartilhar</b> (quadrado com seta).</span></li><li><span>Escolha <b>Adicionar à Tela de Início</b>.</span></li><li><span>Abra pelo ícone novo e entre de novo com o PIN.</span></li></ol>` });
AC['dia-sim'] = () => { S.diaSimulado = $('#dia-sim').value || null; _calc.v = -1; toast(S.diaSimulado ? 'Simulando ' + fmtDia(S.diaSimulado, true) : 'Data real'); ir('#/hoje'); };

/* ============================== AJUDA ============================== */
TELAS.ajuda = () => {
  const q = (S.ui.buscaAjuda || '').toLowerCase();
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const l = N_FAQ.filter(f => !q || norm(f[0] + ' ' + f[1]).includes(norm(q)));
  return {
    titulo: 'ajuda',
    html: `<label class="campo"><span>Buscar nas perguntas frequentes</span><input id="busca-ajuda" value="${esc(S.ui.buscaAjuda || '')}" placeholder="Ex.: offline, divisão, PIN" autocomplete="off"></label>
      <div class="lista">${l.map(f => `<details class="item" style="display:block"><summary style="font-weight:700;cursor:pointer">${esc(f[0])}</summary><p style="margin:8px 0 0">${esc(f[1])}</p></details>`).join('') || '<div class="item">Nada encontrado. Pergunte ao assistente abaixo.</div>'}</div>
      <div class="rotulo">Assistente (precisa de internet)</div>
      <div class="cartao"><label class="campo"><span>Sua pergunta</span><textarea id="pergunta-ia" placeholder="Ex.: como divido um jantar só entre duas famílias?"></textarea></label>
        <button class="btn prim" data-a="perguntar-ia">Perguntar</button><div id="resp-ia" style="margin-top:12px;white-space:pre-wrap"></div></div>`,
    depois: el => { const i = $('#busca-ajuda', el); i.oninput = () => { S.ui.buscaAjuda = i.value; clearTimeout(S.ui.tAjuda); S.ui.tAjuda = setTimeout(() => { render(true); const n = $('#busca-ajuda'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); }; }
  };
};
AC['ajuda'] = () => ir('#/ajuda');
AC['perguntar-ia'] = async el => {
  const p = $('#pergunta-ia').value.trim();
  if (!p) return;
  el.disabled = true;
  $('#resp-ia').textContent = 'Pensando…';
  try { const r = await api('perguntarIA', { pergunta: p, viagemId: S.viagemId }); $('#resp-ia').textContent = r.resposta + '\n\n(' + r.restantes + ' perguntas restantes hoje para o grupo)'; }
  catch (e) { $('#resp-ia').textContent = e.message; } finally { el.disabled = false; }
};
