/* app-formularios.js — formulários genéricos (a partir do esquema) e os especiais: despesa rápida, lugar, documento, pessoa, viagem. */
'use strict';

const MOEDAS_COMUNS = ['EUR', 'BRL', 'USD', 'GBP', 'CHF'];

function rotuloRef(aba, r) {
  if (!r) return '';
  switch (aba) {
    case 'Pessoas': return r.Apelido || r.Nome;
    case 'Categorias': return (r.Icone ? r.Icone + ' ' : '') + r.Nome;
    case 'Reservas': return (ICONE_RESERVA[r.Tipo] || '') + ' ' + r.Titulo;
    case 'Despesas': return (r.Descricao || nomeDe('Categorias', r.CategoriaID)) + ' · ' + mv(r.Valor, r.Moeda);
    case 'Votacoes': return r.Pergunta;
    case 'Atividades': return fmtDiaCurto(r.Data) + ' · ' + r.Titulo;
    default: return r.Nome || r.Titulo || r.ID;
  }
}

function opcoesRef(aba) {
  const esq = ESQUEMA[aba];
  let l = esq.global ? vivos(aba) : (aba === 'Viagens' ? minhasViagens() : daV(aba));
  if (aba === 'Pessoas') l = pessoasDaViagem();
  if (aba === 'Categorias') l = categorias();
  if (aba === 'Familias') l = familiasDaViagem().length ? familiasDaViagem() : vivos('Familias');
  return l.map(r => ({ v: r.ID, t: rotuloRef(aba, r) })).sort((a, b) => aba === 'Categorias' ? 0 : String(a.t).localeCompare(String(b.t)));
}

function campoHtml(c, valor, opc) {
  opc = opc || {};
  const rot = (opc.rotulos && opc.rotulos[c.nome]) || c.rotulo;
  const ajuda = opc.ajuda && opc.ajuda[c.nome] ? `<small class="mpeq" style="display:block;margin-top:4px">${esc(opc.ajuda[c.nome])}</small>` : '';
  const v = valor === undefined || valor === null ? '' : valor;
  const nm = `name="${c.nome}" data-campo="${c.nome}"`;
  let inp;
  switch (c.tipo) {
    case 'longtxt': inp = `<textarea ${nm}>${esc(v)}</textarea>`; break;
    case 'num': inp = `<input ${nm} inputmode="decimal" value="${esc(String(v).replace('.', ','))}" autocomplete="off">`; break;
    case 'int': inp = `<input ${nm} inputmode="numeric" pattern="[0-9]*" value="${esc(v)}" autocomplete="off">`; break;
    case 'data': inp = `<input ${nm} type="date" value="${esc(v)}">`; break;
    case 'hora': inp = `<input ${nm} type="time" value="${esc(v)}">`; break;
    case 'dh': inp = `<input ${nm} type="datetime-local" value="${esc(v)}">`; break;
    case 'bool': return `<label class="check campo"><input type="checkbox" ${nm} ${v === 'sim' ? 'checked' : ''}><span>${esc(rot)}</span></label>${ajuda}`;
    case 'enum': inp = `<select ${nm}>${c.obrig ? '' : '<option value="">—</option>'}${c.valores.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`; break;
    case 'moeda': {
      const l = [...new Set(MOEDAS_COMUNS.concat(daV('Cidades').map(c => c.Moeda)).concat(v ? [v] : []))].filter(Boolean);
      inp = `<select ${nm}>${c.obrig ? '' : '<option value="">—</option>'}${l.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`; break;
    }
    case 'ref': {
      const ops = opcoesRef(c.aba);
      inp = `<select ${nm}><option value="">${c.obrig ? 'Escolha…' : '—'}</option>${ops.map(o => `<option value="${esc(o.v)}" ${o.v === v ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>`; break;
    }
    case 'refs': {
      const sel = N_lista(v);
      return `<fieldset class="campo" style="border:0;padding:0" data-refs="${c.nome}"><span>${esc(rot)}</span><div class="lista" style="margin:0">${opcoesRef(c.aba).map(o =>
        `<label class="item"><input type="checkbox" value="${esc(o.v)}" ${sel.includes(o.v) ? 'checked' : ''} style="width:22px;height:22px;accent-color:var(--acao)"><span class="corpo">${esc(o.t)}</span></label>`).join('')}</div>${ajuda}</fieldset>`;
    }
    default: inp = `<input ${nm} value="${esc(v)}" autocomplete="off">`;
  }
  return `<label class="campo"><span>${esc(rot)}${c.obrig ? ' <b class="obr">*</b>' : ''}</span>${inp}${ajuda}</label>`;
}

function lerCampos(raiz, nomes) {
  const out = {};
  nomes.forEach(n => {
    const box = raiz.querySelector(`[data-refs="${n}"]`);
    if (box) { out[n] = $$('input:checked', box).map(i => i.value).join(','); return; }
    const el = raiz.querySelector(`[data-campo="${n}"]`);
    if (!el) return;
    out[n] = el.type === 'checkbox' ? (el.checked ? 'sim' : 'não') : el.value;
  });
  return out;
}

/**
 * Formulário genérico: abre no painel inferior, valida ao digitar e mostra o que falta.
 * opc: { titulo, campos:[...], fixos:{}, padroes:{}, rotulos:{}, ajuda:{}, depois(linha), antesSalvar(campos), extra, topo (html), podeExcluir }
 */
function formulario(aba, id, opc) {
  opc = opc || {};
  const esq = ESQUEMA[aba];
  const atual = id ? ach(aba, id) : null;
  const nomes = (opc.campos || esq.campos.filter(c => !c.calc && !c.servidor).map(c => c.nome)).filter(n => !(opc.fixos && n in opc.fixos));
  const val = n => atual ? atual[n] : (opc.padroes && n in opc.padroes ? opc.padroes[n] : esq.porNome[n].padrao);
  const editavel = podeEditar() || (esq.global && aba !== 'Pessoas');
  abrirPainel({
    titulo: opc.titulo || (atual ? 'Editar' : 'Novo'),
    html: `${opc.topo || ''}<form id="form-generico" autocomplete="off">${nomes.map(n => campoHtml(esq.porNome[n], val(n), opc)).join('')}</form>`,
    rodape: `<div class="falta" id="falta"></div><div class="botoes">${atual && opc.podeExcluir !== false && editavel ? '<button class="btn perigo" data-a="form-excluir">Excluir</button>' : ''}
      <button class="btn prim" data-a="form-salvar" ${editavel ? '' : 'disabled'}>${atual ? 'Salvar' : 'Adicionar'}</button></div>`,
    depois: el => {
      const f = $('#form-generico', el);
      const conferir = () => {
        const v = N_validar(aba, Object.assign({}, lerCampos(f, nomes), opc.fixos || {}), !!atual);
        $('#falta', el).textContent = v.ok ? '' : v.erros[0] + (v.erros.length > 1 ? ` (+${v.erros.length - 1})` : '');
        return v;
      };
      f.addEventListener('input', conferir);
      f.addEventListener('change', conferir);
      f.addEventListener('submit', e => { e.preventDefault(); AC['form-salvar'](); });
      conferir();
      if (opc.aoAbrir) opc.aoAbrir(el, f);
      const prim = f.querySelector('input:not([type=checkbox]),textarea');
      if (!atual && prim && !opc.semFoco) setTimeout(() => prim.focus(), 250);
    }
  });
  AC['form-salvar'] = () => {
    const f = $('#form-generico');
    let campos = Object.assign(lerCampos(f, nomes), opc.fixos || {});
    if (opc.antesSalvar) campos = opc.antesSalvar(campos, f) || campos;
    const linha = salvar(aba, id, campos, { extra: opc.extra, msg: opc.msg });
    fecharPainel();
    if (opc.depois) opc.depois(linha);
  };
  AC['form-excluir'] = async () => {
    if (!(await confirmar('Excluir este item? Você pode desfazer logo em seguida.', { ok: 'Excluir', perigo: true }))) return;
    excluir(aba, id);
    if (opc.aoExcluir) opc.aoExcluir();
  };
}

/* ============================== despesa rápida ============================== */

function categoriasRecentes() {
  let r = [];
  try { r = JSON.parse(lsGet('catsRecentes') || '[]'); } catch (e) { /* ok */ }
  const todas = categorias();
  return r.map(id => todas.find(c => c.ID === id)).filter(Boolean).concat(todas.filter(c => !r.includes(c.ID)));
}

function formDespesa(id, pre) {
  if (!podeEditar()) { toast('Seu acesso a esta viagem é só de leitura.'); return; }
  pre = pre || {};
  const atual = id ? ach('Despesas', id) : null;
  const cid = cidadeDoDia();
  const partesAtuais = id ? daV('DespesaPartes').filter(p => p.DespesaID === id) : [];
  const D = {
    valor: atual ? String(atual.Valor).replace('.', ',') : (pre.Valor ? String(pre.Valor).replace('.', ',') : ''),
    moeda: atual ? atual.Moeda : (pre.Moeda || (cid && cid.Moeda) || moedaAcerto()),
    cat: atual ? atual.CategoriaID : (pre.CategoriaID || ''),
    pagoPor: atual ? atual.PagoPor : euId(),
    data: atual ? atual.Data : (pre.Data || (faseViagem() === 'durante' ? hoje() : hoje())),
    cidade: atual ? atual.CidadeID : (pre.CidadeID || (cid ? cid.ID : '')),
    tipo: atual ? atual.TipoDivisao : (pre.TipoDivisao || lsGet('ultimaDivisao') || 'família'),
    fora: atual ? atual.ForaDivisao === 'sim' : !!pre.ForaDivisao,
    paraFam: atual ? atual.ParaFamiliaID : (pre.ParaFamiliaID || minhaFamilia() || ''),
    desc: atual ? atual.Descricao : (pre.Descricao || ''),
    fonte: atual ? (atual.FonteCotacao === 'provisória' ? 'bce' : atual.FonteCotacao) : 'bce',
    cot: atual && (atual.FonteCotacao === 'manual' || atual.FonteCotacao === 'cartão') ? String(atual.Cotacao).replace('.', ',') : '',
    reserva: atual ? atual.ReservaID : (pre.ReservaID || ''),
    notas: atual ? atual.Notas : '',
    mexeu: partesAtuais.length > 0,
    sel: {}, pesos: {}, fixos: {},
    aberto: !!atual, todasCats: false, arquivo: null
  };
  partesAtuais.forEach(p => { D.sel[p.RefID] = true; D.pesos[p.RefID] = p.Peso; D.fixos[p.RefID] = p.ValorFixo; });
  S.ui.despesa = D;

  const corpo = () => {
    const ac = moedaAcerto();
    const tx = taxa(D.moeda, ac);
    const val = numBR(D.valor);
    const cats = categoriasRecentes();
    const mostrar = D.todasCats ? cats : cats.slice(0, 8);
    const pres = participantes().filter(p => N_presente(p, D.data));
    const conv = D.moeda !== ac && val ? (D.fonte !== 'bce' && numBR(D.cot) ? val * numBR(D.cot) : (tx ? val * tx : null)) : null;
    return `
      ${D.moeda !== ac ? `<p class="peq" style="text-align:center;margin:-8px 0 10px">${conv !== null ? '≈ ' + mv(conv, ac) + (D.fonte === 'bce' ? ' · cotação do BCE (confirmada ao enviar)' : ' · cotação ' + esc(D.fonte)) : '<b style="color:var(--erro)">Sem cotação no aparelho: abra os detalhes e digite a cotação.</b>'}</p>` : ''}
      <div class="cats">${mostrar.map(c => `<button type="button" class="${D.cat === c.ID ? 'on' : ''}" data-a="desp-cat" data-id="${c.ID}"><span>${esc(c.Icone || '•')}</span>${esc(c.Nome)}</button>`).join('')}
        ${cats.length > 8 && !D.todasCats ? '<button type="button" data-a="desp-mais-cats"><span>…</span>Mais</button>' : ''}</div>
      <div class="resumo-linha" data-a="desp-abrir">
        <span>Pago por <b>${esc(D.pagoPor === euId() ? 'você' : pessoaNome(D.pagoPor))}</b></span>·
        <span>${D.fora ? '<b>fora da divisão</b>' : 'divisão: <b>' + esc(D.tipo) + '</b>'}</span>·
        <span><b>${D.data === hoje() ? 'hoje' : esc(fmtDiaCurto(D.data))}</b></span>${D.cidade ? '· <span>' + esc(nomeDe('Cidades', D.cidade)) + '</span>' : ''}
        <span style="margin-left:auto;color:var(--acao);font-weight:700">${D.aberto ? 'menos ▲' : 'mudar ▼'}</span>
      </div>
      ${D.aberto ? detalhes(pres, ac) : ''}`;
  };

  const detalhes = (pres, ac) => {
    const adultos = pres.filter(p => (ach('Pessoas', p.PessoaID) || {}).Tipo !== 'criança');
    const fams = [...new Set(pres.map(p => p.FamiliaID))];
    let partes = '';
    if (!D.fora) {
      if (D.tipo === 'família') {
        partes = fams.map(f => `<label class="parte"><input type="checkbox" data-sel="${f}" ${D.mexeu ? (D.sel[f] ? 'checked' : '') : 'checked'}><span>${esc(nomeDe('Familias', f))}</span><span></span></label>`).join('');
      } else {
        partes = pres.map(p => {
          const pe = ach('Pessoas', p.PessoaID) || {};
          const marcado = D.mexeu ? !!D.sel[p.PessoaID] : (Number(p.CotaPadrao) > 0 || D.tipo === 'valores');
          const extra = D.tipo === 'cotas' ? `<input type="number" step="0.1" min="0" data-peso="${p.PessoaID}" value="${esc(D.pesos[p.PessoaID] !== undefined ? D.pesos[p.PessoaID] : p.CotaPadrao)}" aria-label="Cota">`
            : D.tipo === 'valores' ? `<input type="number" step="0.01" min="0" inputmode="decimal" data-fixo="${p.PessoaID}" value="${esc(D.fixos[p.PessoaID] || '')}" placeholder="0,00" aria-label="Valor">` : '<span></span>';
          return `<label class="parte"><input type="checkbox" data-sel="${p.PessoaID}" ${marcado ? 'checked' : ''}><span>${esc(pe.Apelido || pe.Nome)}${pe.Tipo === 'criança' ? ' <span class="mpeq">criança</span>' : ''}</span>${extra}</label>`;
        }).join('');
      }
    }
    const somaFixos = Object.keys(D.fixos).filter(k => D.sel[k]).reduce((a, k) => a + (numBR(D.fixos[k]) || 0), 0);
    return `
      <label class="campo"><span>Descrição</span><input id="d-desc" value="${esc(D.desc)}" placeholder="Ex.: jantar no centro" autocomplete="off"></label>
      <div class="campo"><span>Quem pagou</span><div class="chips">${adultos.concat(pres.filter(p => !adultos.includes(p))).map(p => `<button type="button" class="chip ${D.pagoPor === p.PessoaID ? 'on' : ''}" data-a="desp-pagou" data-id="${p.PessoaID}">${esc(pessoaNome(p.PessoaID))}</button>`).join('')}</div></div>
      <div class="dupla"><label class="campo"><span>Data</span><input type="date" id="d-data" value="${esc(D.data)}"></label>
        <label class="campo"><span>Cidade</span><select id="d-cidade"><option value="">—</option>${daV('Cidades').map(c => `<option value="${c.ID}" ${c.ID === D.cidade ? 'selected' : ''}>${esc(c.Nome)}</option>`).join('')}</select></label></div>
      <label class="check"><input type="checkbox" id="d-fora" ${D.fora ? 'checked' : ''}><span>Fora da divisão <span class="mpeq">(ex.: passagens que cada família paga)</span></span></label>
      ${D.fora ? `<label class="campo"><span>Custo de qual família</span><select id="d-parafam">${familiasDaViagem().map(f => `<option value="${f.ID}" ${f.ID === D.paraFam ? 'selected' : ''}>${esc(f.Nome)}</option>`).join('')}</select></label>` : `
      <div class="campo"><span>Como dividir</span><div class="seg">${['família', 'igual', 'cotas', 'valores'].map(t => `<button type="button" class="${D.tipo === t ? 'on' : ''}" data-a="desp-tipo" data-t="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div>
        <div class="mpeq" style="margin:-4px 0 6px">${{ família: 'Partes iguais entre as famílias marcadas.', igual: 'Partes iguais entre as pessoas marcadas.', cotas: 'Proporcional à cota (ex.: criança 0,5).', valores: 'Digite quanto cabe a cada pessoa.' }[D.tipo]}</div>
        <div id="d-partes">${partes}</div>
        ${D.tipo === 'valores' ? `<p class="peq">Distribuído: <b>${mv(somaFixos, D.moeda)}</b> de ${mv(numBR(D.valor) || 0, D.moeda)}</p>` : ''}</div>`}
      <div class="dupla"><label class="campo"><span>Cotação usada</span><select id="d-fonte" ${D.moeda === ac ? 'disabled' : ''}><option value="bce" ${D.fonte === 'bce' ? 'selected' : ''}>BCE (automática)</option><option value="cartão" ${D.fonte === 'cartão' ? 'selected' : ''}>do cartão</option><option value="manual" ${D.fonte === 'manual' ? 'selected' : ''}>manual</option></select></label>
        <label class="campo"><span>1 ${esc(D.moeda)} = ? ${esc(ac)}</span><input id="d-cot" inputmode="decimal" value="${esc(D.fonte === 'bce' ? (taxa(D.moeda, ac) ? String(+taxa(D.moeda, ac).toFixed(6)).replace('.', ',') : '') : D.cot)}" ${D.fonte === 'bce' || D.moeda === ac ? 'readonly' : ''}></label></div>
      <label class="campo"><span>Reserva relacionada</span><select id="d-reserva"><option value="">—</option>${daV('Reservas').map(r => `<option value="${r.ID}" ${r.ID === D.reserva ? 'selected' : ''}>${esc(rotuloRef('Reservas', r))}</option>`).join('')}</select></label>
      <label class="campo"><span>Comprovante (foto ou PDF)</span><input type="file" id="d-arquivo" accept="image/*,application/pdf"></label>
      <label class="campo"><span>Notas</span><textarea id="d-notas">${esc(D.notas)}</textarea></label>`;
  };

  const montarCampos = () => {
    const ac = moedaAcerto();
    const tx = taxa(D.moeda, ac);
    const manual = D.fonte !== 'bce';
    return {
      Data: D.data, Descricao: D.desc, CategoriaID: D.cat, CidadeID: D.cidade, Valor: D.valor, Moeda: D.moeda,
      Cotacao: D.moeda === ac ? 1 : (manual ? D.cot : (tx ? +tx.toFixed(8) : '')),
      CotacaoBRL: D.moeda === 'BRL' ? 1 : (taxa(D.moeda, 'BRL') ? +taxa(D.moeda, 'BRL').toFixed(8) : ''),
      FonteCotacao: D.moeda === ac ? 'bce' : (manual ? D.fonte : 'provisória'), DataCotacao: D.data,
      PagoPor: D.pagoPor, TipoDivisao: D.tipo, ForaDivisao: D.fora ? 'sim' : 'não', ParaFamiliaID: D.fora ? D.paraFam : '',
      ReservaID: D.reserva, Notas: D.notas
    };
  };

  const partesParaSalvar = () => {
    if (D.fora || !D.mexeu) return [];
    if (D.tipo === 'família') return Object.keys(D.sel).filter(k => D.sel[k]).map(f => ({ Base: 'família', RefID: f, Peso: 1 }));
    return Object.keys(D.sel).filter(k => D.sel[k]).map(p => ({ Base: 'pessoa', RefID: p, Peso: D.tipo === 'cotas' ? (numBR(D.pesos[p]) === null ? 1 : numBR(D.pesos[p])) : 1, ValorFixo: D.tipo === 'valores' ? (numBR(D.fixos[p]) || 0) : '' }));
  };

  const previa = () => {
    const val = numBR(D.valor);
    if (!val || !D.cat) return '';
    const tmp = Object.assign({ ID: 'DSP-previa000-0000', ViagemID: S.viagemId, Excluido: 'não' }, montarCampos(), { Valor: val, Cotacao: numBR(String(montarCampos().Cotacao)) });
    const ps = partesParaSalvar().map((p, i) => Object.assign({ ID: 'DPT-previa000-' + i, ViagemID: S.viagemId, DespesaID: tmp.ID }, p));
    const d = {}; ABAS_CALC.forEach(a => d[a] = linhas(a));
    d.Despesas = [tmp]; d.DespesaPartes = ps; d.Acertos = []; d.Orcamento = []; d.Atividades = [];
    const r = N_calcular(d, S.viagemId, {}).despesas[tmp.ID];
    if (!r || r.valorAcerto === null) return '';
    if (D.fora) return `Custo de ${esc(nomeDe('Familias', D.paraFam))}: ${m(r.valorAcerto)}`;
    const porFam = {};
    r.partes.forEach(p => { const f = p.base === 'família' ? p.ref : familiaDe(p.ref); porFam[f] = (porFam[f] || 0) + p.valor; });
    return Object.keys(porFam).map(f => `${esc(nomeDe('Familias', f))} ${m(porFam[f])}`).join(' · ') + (r.aviso ? ` · <span style="color:var(--erro)">${esc(r.aviso)}</span>` : '');
  };

  const atualizar = () => {
    const resto = $('#desp-resto');
    if (!resto) return;
    resto.innerHTML = corpo();
    pintarRodape();
  };
  const pintarRodape = () => {
    const val = numBR(D.valor);
    const falta = [];
    if (!val || val <= 0) falta.push('valor');
    if (!D.cat) falta.push('categoria');
    if (D.moeda !== moedaAcerto() && !montarCampos().Cotacao) falta.push('cotação');
    const r = _painel && _painel.el.querySelector('.rodape');
    if (!r) return;
    // O botão é criado uma vez só: recriá-lo durante o toque (ex.: ao sair de um campo) faria o clique se perder
    if (!r.dataset.pronto) {
      r.innerHTML = `<div id="desp-info"></div><div class="botoes">${atual ? '<button class="btn perigo" data-a="desp-excluir">Excluir</button>' : ''}<button class="btn prim" data-a="desp-salvar">${atual ? 'Salvar' : 'Salvar despesa'}</button></div>`;
      r.dataset.pronto = '1';
    }
    $('#desp-info', r).innerHTML = falta.length ? `<div class="falta">Falta: ${falta.join(', ')}</div>` : `<div class="peq">${previa()}</div>`;
    $('[data-a="desp-salvar"]', r).disabled = falta.length > 0;
  };

  abrirPainel({
    titulo: atual ? 'Editar despesa' : 'Nova despesa',
    html: `<div class="valor-grande"><button type="button" class="moeda" data-a="desp-moeda">${esc(D.moeda)}</button>
      <input id="desp-valor" inputmode="decimal" placeholder="0,00" value="${esc(D.valor)}" autocomplete="off" aria-label="Valor"></div><div id="desp-resto"></div>`,
    rodape: '',
    aoFechar: () => { S.ui.despesa = null; },
    depois: el => {
      atualizar();
      const v = $('#desp-valor', el);
      v.addEventListener('input', () => { D.valor = v.value; const extra = $('#desp-resto p.peq'); pintarRodape(); if (D.moeda !== moedaAcerto() && extra) atualizar(); });
      if (!atual) setTimeout(() => v.focus(), 280);
      const resto = $('#desp-resto', el);
      resto.addEventListener('input', e => lerDetalhe(e.target, false));
      resto.addEventListener('change', e => lerDetalhe(e.target, true));
    }
  });

  const lerDetalhe = (t, redesenhar) => {
    if (t.id === 'd-desc') D.desc = t.value;
    else if (t.id === 'd-data') { D.data = t.value; const c = cidadeDoDia(t.value); if (c) D.cidade = c.ID; }
    else if (t.id === 'd-cidade') D.cidade = t.value;
    else if (t.id === 'd-fora') D.fora = t.checked;
    else if (t.id === 'd-parafam') D.paraFam = t.value;
    else if (t.id === 'd-fonte') { D.fonte = t.value; if (t.value !== 'bce' && !D.cot && taxa(D.moeda, moedaAcerto())) D.cot = String(+taxa(D.moeda, moedaAcerto()).toFixed(6)).replace('.', ','); }
    else if (t.id === 'd-cot') D.cot = t.value;
    else if (t.id === 'd-reserva') D.reserva = t.value;
    else if (t.id === 'd-notas') D.notas = t.value;
    else if (t.id === 'd-arquivo') D.arquivo = t.files && t.files[0];
    else if (t.dataset.sel) { capturarPadrao(); D.sel[t.dataset.sel] = t.checked; }
    else if (t.dataset.peso) { capturarPadrao(); D.pesos[t.dataset.peso] = t.value; }
    else if (t.dataset.fixo) { capturarPadrao(); D.fixos[t.dataset.fixo] = t.value; D.sel[t.dataset.fixo] = true; }
    else return;
    if (redesenhar && ['d-data', 'd-fora', 'd-fonte'].includes(t.id)) atualizar();
    else if (t.dataset.fixo && redesenhar) atualizar();
    else pintarRodape();
  };
  // Na primeira mudança das partes, guarda a seleção padrão que estava na tela
  const capturarPadrao = () => {
    if (D.mexeu) return;
    D.mexeu = true;
    $$('#d-partes [data-sel]').forEach(i => D.sel[i.dataset.sel] = i.checked);
  };

  AC['desp-cat'] = el => { D.cat = el.dataset.id; atualizar(); if (!numBR(D.valor)) $('#desp-valor').focus(); };
  AC['desp-mais-cats'] = () => { D.todasCats = true; atualizar(); };
  AC['desp-abrir'] = () => { D.aberto = !D.aberto; atualizar(); };
  AC['desp-pagou'] = el => { D.pagoPor = el.dataset.id; atualizar(); };
  AC['desp-tipo'] = el => { D.tipo = el.dataset.t; D.mexeu = false; D.sel = {}; atualizar(); };
  AC['desp-moeda'] = el => {
    const l = [...new Set([D.moeda, moedaAcerto()].concat(daV('Cidades').map(c => c.Moeda)).concat(MOEDAS_COMUNS))];
    const i = l.indexOf(D.moeda);
    let nova = l[(i + 1) % l.length];
    if (el && el.dataset && el.dataset.outra) nova = (prompt('Código da moeda (3 letras, ex.: CHF):', '') || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(nova)) return;
    D.moeda = nova; D.cot = '';
    $('.valor-grande .moeda').textContent = nova;
    atualizar();
  };
  AC['desp-excluir'] = async () => {
    if (!(await confirmar('Excluir esta despesa?', { ok: 'Excluir', perigo: true }))) return;
    emLote('Despesa excluída', () => {
      daV('DespesaPartes').filter(p => p.DespesaID === id).forEach(p => excluir('DespesaPartes', p.ID));
      excluir('Despesas', id);
    });
    fecharPainel();
  };
  AC['desp-salvar'] = async () => {
    const campos = montarCampos();
    const partes = partesParaSalvar();
    if (D.tipo === 'valores' && !D.fora) {
      const soma = partes.reduce((a, p) => a + Math.round((p.ValorFixo || 0) * 100), 0);
      if (Math.abs(soma - Math.round(numBR(D.valor) * 100)) > 1) { toast('Os valores por pessoa precisam somar o total.'); return; }
      if (!partes.length) { toast('Digite quanto cabe a cada pessoa.'); return; }
    }
    let anexo = null;
    if (D.arquivo) {
      if (!navigator.onLine) toast('Sem internet: a despesa foi salva; envie o comprovante depois em Documentos.', { ms: 6000 });
      else {
        try { anexo = await enviarArquivo(D.arquivo); } catch (e) { toast('Comprovante não enviado: ' + e.message, { ms: 6000 }); }
      }
    }
    const linha = emLote(atual ? 'Despesa alterada' : 'Despesa salva', () => {
      const l = salvar('Despesas', id, campos, { semDesfazer: true });
      if (D.mexeu || partesAtuais.length) {
        partesAtuais.forEach(p => excluir('DespesaPartes', p.ID));
        partes.forEach(p => salvar('DespesaPartes', null, Object.assign({ DespesaID: l.ID }, p)));
      }
      if (anexo) {
        const a = salvar('Anexos', null, { Titulo: 'Comprovante · ' + (D.desc || nomeDe('Categorias', D.cat)), Tipo: 'outro', Visibilidade: 'grupo', NomeArquivo: anexo.nome, Mime: anexo.mime, Tamanho: anexo.tamanho, VinculoTipo: 'despesa', VinculoID: l.ID }, { extra: { arquivoId: anexo.arquivoId } });
        salvar('Despesas', l.ID, { AnexoID: a.ID });
      }
      return l;
    });
    lsSet('ultimaDivisao', D.tipo);
    let rec = []; try { rec = JSON.parse(lsGet('catsRecentes') || '[]'); } catch (e) { /* ok */ }
    lsSet('catsRecentes', JSON.stringify([D.cat].concat(rec.filter(x => x !== D.cat)).slice(0, 12)));
    fecharPainel();
    return linha;
  };
}

async function enviarArquivo(arquivo) {
  if (arquivo.size > 10 * 1024 * 1024) throw erroApp('Arquivo maior que 10 MB.');
  const base64 = await arquivoParaB64(arquivo);
  return api('upload', { viagemId: S.viagemId, nome: arquivo.name, mime: arquivo.type || 'application/octet-stream', base64 }, { timeout: 90000 });
}

/* ============================== lugar (com busca de endereço) ============================== */
function formLugar(id, pre) {
  pre = pre || {};
  const cid = pre.CidadeID ? ach('Cidades', pre.CidadeID) : cidadeDoDia();
  formulario('Lugares', id, {
    titulo: id ? 'Editar lugar' : 'Novo lugar',
    padroes: Object.assign({ CidadeID: cid ? cid.ID : '', Status: 'ideia', Tipo: 'interesse' }, pre),
    campos: ['Nome', 'Tipo', 'Status', 'CidadeID', 'Endereco', 'Lat', 'Lng', 'Link', 'Telefone', 'Acessibilidade', 'Notas'],
    ajuda: { Acessibilidade: 'Ex.: escadas, elevador, dá para ir com carrinho de bebê?', Lat: 'Preenchida pela busca, pelo link ou tocando no mapa.' },
    topo: `<div class="cartao" style="padding:12px">
      <label class="campo" style="margin-bottom:8px"><span>Buscar por nome ou endereço</span>
        <div style="display:flex;gap:8px"><input id="busca-end" placeholder="Ex.: Atomium, Bruxelas" autocomplete="off"><button type="button" class="btn" data-a="lugar-buscar">Buscar</button></div></label>
      <div id="busca-res"></div>
      <label class="campo" style="margin-bottom:8px"><span>…ou cole um link do Google Maps</span>
        <div style="display:flex;gap:8px"><input id="link-mapa" placeholder="https://maps.app.goo.gl/…" autocomplete="off"><button type="button" class="btn" data-a="lugar-link">Ler</button></div></label>
      <div class="botoes"><button type="button" class="btn" data-a="lugar-aqui">📍 Onde estou</button><button type="button" class="btn" data-a="lugar-no-mapa">🗺️ Tocar no mapa</button></div>
    </div>`,
    antesSalvar: c => { if (c.Lat !== '' && !c.FonteCoord && !(id && ach('Lugares', id).FonteCoord)) c.FonteCoord = S.ui.fonteCoord || 'manual'; else if (S.ui.fonteCoord) c.FonteCoord = S.ui.fonteCoord; return c; },
    depois: l => { S.ui.fonteCoord = null; toast('Lugar salvo', { acao: 'Ver no mapa', fn: () => { S.ui.focoLugar = l.ID; ir('#/mapa'); } }); },
    msg: 'Lugar salvo'
  });
  S.ui.fonteCoord = null;
  const preencher = (r, fonte) => {
    const f = $('#form-generico');
    const set = (n, v) => { const el = f.querySelector(`[data-campo="${n}"]`); if (el && v !== undefined && v !== null && v !== '') { el.value = n === 'Lat' || n === 'Lng' ? String(v).replace('.', ',') : v; } };
    if (!f.querySelector('[data-campo="Nome"]').value && r.nome) set('Nome', r.nome);
    set('Endereco', r.endereco); set('Lat', r.lat); set('Lng', r.lng); if (r.url) set('Link', r.url);
    S.ui.fonteCoord = fonte;
    f.dispatchEvent(new Event('input'));
    toast('Coordenadas preenchidas. Confira o pino no mapa depois de salvar.');
  };
  AC['lugar-buscar'] = async () => {
    const q = $('#busca-end').value.trim();
    const box = $('#busca-res');
    if (!navigator.onLine) { box.innerHTML = '<p class="peq">A busca precisa de internet. Sem sinal, use "Tocar no mapa" ou digite as coordenadas.</p>'; return; }
    box.innerHTML = '<div class="esq" style="height:48px"></div>';
    const c = cidadeDoDia() || daV('Cidades')[0];
    try {
      const r = await api('buscarEndereco', { q, perto: c && c.Lat !== '' ? { lat: Number(c.Lat), lng: Number(c.Lng) } : null });
      S.ui.resultados = r;
      box.innerHTML = r.length ? `<div class="lista">${r.map((x, i) => `<button type="button" class="item" data-a="lugar-escolher" data-i="${i}"><span class="corpo"><span class="t">${esc(x.nome)}</span><span class="s">${esc(x.endereco)}</span></span></button>`).join('')}</div>`
        : '<p class="peq">Nada encontrado. Tente outro nome ou cole um link do Google Maps.</p>';
    } catch (e) { box.innerHTML = `<p class="peq" style="color:var(--erro)">${esc(e.message)}</p>`; }
  };
  AC['lugar-escolher'] = el => { preencher(S.ui.resultados[Number(el.dataset.i)], 'busca'); $('#busca-res').innerHTML = ''; };
  AC['lugar-link'] = async () => {
    const u = $('#link-mapa').value.trim();
    const local = N_coordsDeLink(u);
    if (local) { preencher({ lat: local.lat, lng: local.lng, url: /^https?:/.test(u) ? u : '' }, 'link'); return; }
    if (!navigator.onLine) { toast('Links curtos precisam de internet para serem lidos.'); return; }
    try { const r = await api('resolverLink', { url: u }); preencher({ nome: r.nome, lat: r.lat, lng: r.lng, url: u }, 'link'); } catch (e) { toast(e.message, { ms: 7000 }); }
  };
  AC['lugar-aqui'] = () => {
    if (!navigator.geolocation) { toast('Localização indisponível neste aparelho.'); return; }
    navigator.geolocation.getCurrentPosition(p => preencher({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }, 'toque'),
      () => toast('Permita o acesso à localização nas configurações do aparelho.'), { enableHighAccuracy: true, timeout: 15000 });
  };
  AC['lugar-no-mapa'] = () => {
    const f = $('#form-generico');
    S.ui.rascunhoLugar = { id, campos: lerCampos(f, ['Nome', 'Tipo', 'Status', 'CidadeID', 'Endereco', 'Link', 'Telefone', 'Acessibilidade', 'Notas']) };
    fecharPainel(true);
    S.ui.escolherNoMapa = true;
    ir('#/mapa');
    toast('Toque e segure (ou clique com o botão direito) no ponto do mapa.', { ms: 6000 });
  };
}

/* ============================== documento ============================== */
/**
 * Documento ou link. vinculo: { vinculoTipo, vinculoId, titulo, tipo, vis, modo: 'arquivo'|'link' }
 * Arquivo precisa de internet (vai para o Drive). Link pode ser salvo sem internet (entra na fila).
 */
function formAnexo(vinculo) {
  vinculo = vinculo || {};
  let modo = vinculo.modo || 'arquivo';
  const corpo = () => `<div class="seg" id="anx-modo">${[['arquivo', '📎 Arquivo'], ['link', '🔗 Link']].map(x => `<button type="button" data-m="${x[0]}" class="${modo === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>
      ${modo === 'arquivo' ? `<label class="campo"><span>Arquivo (foto, print ou PDF, até 10 MB) <b class="obr">*</b></span><input type="file" id="anx-arq" accept="image/*,application/pdf"></label>
        ${!navigator.onLine ? '<div class="aviso alerta">Enviar arquivo precisa de internet. Sem sinal, salve o link ou tente mais tarde.</div>' : ''}`
      : `<label class="campo"><span>Link <b class="obr">*</b></span><input id="anx-url" type="url" inputmode="url" placeholder="https://…" autocomplete="off"></label>
        <div class="mpeq" style="margin:-8px 0 12px">Ex.: ingresso no site da atração, voucher da GetYourGuide, página de reserva. Abrir o link precisa de internet; para usar sem sinal, anexe também o PDF ou um print.</div>`}
      ${campoHtml(ESQUEMA.Anexos.porNome.Titulo, vinculo.titulo || '')}
      ${campoHtml(ESQUEMA.Anexos.porNome.Tipo, vinculo.tipo || (modo === 'link' ? 'link' : 'voucher'))}
      <div class="campo"><span>Quem pode ver</span><div class="seg" id="anx-vis">${['grupo', 'família', 'pessoal'].map(v => `<button type="button" data-v="${v}" class="${v === (vinculo.vis || 'grupo') ? 'on' : ''}">${v === 'grupo' ? 'Todos' : v === 'família' ? 'Minha família' : 'Só eu'}</button>`).join('')}</div>
        <div class="mpeq">Passaporte e documentos pessoais: use "Minha família" ou "Só eu". Atenção: o dono da planilha no Google Drive consegue abrir todos os arquivos.</div></div>
      ${campoHtml(ESQUEMA.Anexos.porNome.Validade, '')}
      ${modo === 'arquivo' ? '<label class="check"><input type="checkbox" id="anx-off" checked><span>Guardar neste aparelho (abre sem internet)</span></label>' : ''}`;
  abrirPainel({
    titulo: vinculo.tituloPainel || 'Novo documento ou link',
    render: corpo,
    rodape: '<div class="falta" id="anx-falta"></div><button class="btn prim bloco" data-a="anx-enviar">Salvar</button>',
    depois: el => {
      $$('#anx-modo button', el).forEach(b => b.onclick = () => {
        const t = el.querySelector('[data-campo="Titulo"]').value;
        modo = b.dataset.m; vinculo.titulo = t; vinculo.tipo = modo === 'link' ? 'link' : (vinculo.tipo === 'link' ? 'voucher' : vinculo.tipo);
        pintarPainel();
      });
      $$('#anx-vis button', el).forEach(b => b.onclick = () => { $$('#anx-vis button', el).forEach(x => x.classList.toggle('on', x === b)); });
      const a = $('#anx-arq', el);
      if (a) a.onchange = e => { const f = e.target.files[0]; const t = el.querySelector('[data-campo="Titulo"]'); if (f && !t.value) t.value = f.name.replace(/\.[^.]+$/, ''); };
    }
  });
  AC['anx-enviar'] = async el => {
    const titulo = $('[data-campo="Titulo"]').value.trim();
    const vis = $('#anx-vis .on').dataset.v;
    const base = { Titulo: titulo, Tipo: $('[data-campo="Tipo"]').value, Visibilidade: vis, FamiliaID: minhaFamilia(),
      VinculoTipo: vinculo.vinculoTipo || '', VinculoID: vinculo.vinculoId || '', Validade: $('[data-campo="Validade"]').value };
    if (modo === 'link') {
      let url = ($('#anx-url').value || '').trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!url || !titulo) { $('#anx-falta').textContent = 'Informe o link e um título.'; return; }
      if (!/^https?:\/\/\S+\.\S+/i.test(url)) { $('#anx-falta').textContent = 'Link inválido.'; return; }
      salvar('Anexos', null, Object.assign(base, { Url: url }), { msg: 'Link salvo' });
      fecharPainel();
      return;
    }
    const arq = $('#anx-arq').files[0];
    if (!arq || !titulo) { $('#anx-falta').textContent = 'Escolha o arquivo e dê um título.'; return; }
    if (!navigator.onLine) { $('#anx-falta').textContent = 'Sem internet: não dá para enviar o arquivo agora.'; return; }
    el.disabled = true; el.textContent = 'Enviando…';
    try {
      const up = await enviarArquivo(arq);
      const l = salvar('Anexos', null, Object.assign(base, { NomeArquivo: up.nome, Mime: up.mime, Tamanho: up.tamanho }), { extra: { arquivoId: up.arquivoId }, msg: 'Documento enviado' });
      if ($('#anx-off').checked) { await idb.set('arquivos', l.ID, { nome: up.nome, mime: up.mime, base64: await arquivoParaB64(arq) }); S.offline.add(l.ID); }
      fecharPainel();
      mudou();
    } catch (e) { el.disabled = false; el.textContent = 'Salvar'; $('#anx-falta').textContent = e.message; }
  };
}

/** Lista de anexos e links de um item (atividade, lugar, reserva) para o painel de detalhe. */
function anexosDe(tipo, id, extra) {
  const l = daV('Anexos').filter(a => a.Oculto !== 'sim' && ((a.VinculoTipo === tipo && a.VinculoID === id) || (extra && a.VinculoTipo === extra.tipo && a.VinculoID === extra.id)));
  return `<div class="secao-topo"><div class="rotulo">Vouchers, ingressos e links</div>${podeEditar() ? `<div class="botoes" style="flex:none"><button class="btn" style="min-height:40px;padding:0 12px" data-a="anexar-a" data-t="${tipo}" data-id="${id}" data-m="arquivo">+ Arquivo</button><button class="btn" style="min-height:40px;padding:0 12px" data-a="anexar-a" data-t="${tipo}" data-id="${id}" data-m="link">+ Link</button></div>` : ''}</div>
    ${l.length ? `<div class="lista">${l.map(docItem).join('')}</div>` : '<p class="peq">Guarde aqui o ingresso, o voucher ou o link da reserva. Os arquivos das atividades dos próximos 3 dias ficam no aparelho automaticamente.</p>'}`;
}
AC['anexar-a'] = el => {
  const t = el.dataset.t, id = el.dataset.id;
  const item = t === 'atividade' ? ach('Atividades', id) : t === 'lugar' ? ach('Lugares', id) : ach('Reservas', id);
  formAnexo({ vinculoTipo: t, vinculoId: id, modo: el.dataset.m, titulo: item ? (item.Titulo || item.Nome) : '', tipo: el.dataset.m === 'link' ? 'link' : (t === 'reserva' && item && item.Tipo === 'voo' ? 'passagem' : 'ingresso') });
};

/* ============================== pessoa + participante ============================== */
function formPessoa(partId) {
  const part = partId ? ach('Participantes', partId) : null;
  const pes = part ? ach('Pessoas', part.PessoaID) : null;
  const jaNaViagem = participantes().map(p => p.PessoaID);
  const outras = vivos('Pessoas').filter(p => !jaNaViagem.includes(p.ID));
  abrirPainel({
    titulo: part ? (pes ? pes.Nome : 'Participante') : 'Adicionar pessoa',
    html: `${!part && outras.length ? `<label class="campo"><span>Pessoa já cadastrada (de outra viagem)</span><select id="pp-exist"><option value="">— nova pessoa —</option>${outras.map(p => `<option value="${p.ID}">${esc(p.Nome)}</option>`).join('')}</select></label>` : ''}
      <div id="pp-nova">${campoHtml(ESQUEMA.Pessoas.porNome.Nome, pes ? pes.Nome : '')}${campoHtml(ESQUEMA.Pessoas.porNome.Apelido, pes ? pes.Apelido : '')}
      ${campoHtml(ESQUEMA.Pessoas.porNome.Tipo, pes ? pes.Tipo : 'adulto')}${campoHtml(ESQUEMA.Pessoas.porNome.Email, pes ? pes.Email : '', { ajuda: { Email: 'Para resumos e lembretes por e-mail.' } })}
      ${campoHtml(ESQUEMA.Pessoas.porNome.Pix, pes ? pes.Pix : '')}</div>
      ${campoHtml(ESQUEMA.Participantes.porNome.FamiliaID, part ? part.FamiliaID : '')}
      <button type="button" class="btn" data-a="pp-nova-fam" style="margin:-6px 0 12px">+ Nova família</button>
      ${campoHtml(ESQUEMA.Participantes.porNome.Papel, part ? part.Papel : 'participante')}
      ${campoHtml(ESQUEMA.Participantes.porNome.CotaPadrao, part ? part.CotaPadrao : 1, { ajuda: { CotaPadrao: 'Usada na divisão por cotas. Ex.: adulto 1, criança 0,5, bebê 0 (não entra na divisão "igual").' } })}
      <div class="dupla">${campoHtml(ESQUEMA.Participantes.porNome.DataEntrada, part ? part.DataEntrada : '')}${campoHtml(ESQUEMA.Participantes.porNome.DataSaida, part ? part.DataSaida : '')}</div>
      ${!part ? '<label class="campo"><span>PIN provisório (adultos, 4 a 6 números)</span><input id="pp-pin" inputmode="numeric" maxlength="6" autocomplete="off"></label>' : ''}`,
    rodape: `<div class="falta" id="pp-falta"></div><div class="botoes">${part ? '<button class="btn perigo" data-a="pp-remover">Remover da viagem</button>' : ''}<button class="btn prim" data-a="pp-salvar">Salvar</button></div>`,
    depois: el => { const s = $('#pp-exist', el); if (s) s.onchange = () => $('#pp-nova', el).classList.toggle('oculto', !!s.value); }
  });
  AC['pp-nova-fam'] = () => {
    const nome = prompt('Nome da família (ex.: Renata e Caio):');
    if (!nome) return;
    const f = salvar('Familias', null, { Nome: nome }, { semDesfazer: true });
    const sel = $('[data-campo="FamiliaID"]');
    sel.insertAdjacentHTML('beforeend', `<option value="${f.ID}" selected>${esc(nome)}</option>`);
  };
  AC['pp-salvar'] = () => {
    const raiz = _painel.el;
    const exist = $('#pp-exist', raiz) && $('#pp-exist', raiz).value;
    const dp = lerCampos(raiz, ['Nome', 'Apelido', 'Tipo', 'Email', 'Pix']);
    const dpart = lerCampos(raiz, ['FamiliaID', 'Papel', 'CotaPadrao', 'DataEntrada', 'DataSaida']);
    const pin = $('#pp-pin', raiz) ? $('#pp-pin', raiz).value.trim() : '';
    if (pin && !/^\d{4,6}$/.test(pin)) { $('#pp-falta').textContent = 'O PIN deve ter de 4 a 6 números.'; return; }
    try {
      emLote(part ? 'Participante alterado' : 'Pessoa adicionada', () => {
        let pid = exist || (pes && pes.ID);
        if (!exist) {
          if (pes) salvar('Pessoas', pes.ID, dp);
          else pid = salvar('Pessoas', null, Object.assign({ Ativo: 'sim' }, dp), { extra: pin ? { pinInicial: pin } : undefined }).ID;
        }
        if (part) salvar('Participantes', part.ID, dpart);
        else salvar('Participantes', null, Object.assign({ PessoaID: pid }, dpart));
      });
      fecharPainel();
      if (pin && !part) toast('Envie o convite com o PIN em particular (Grupo → Convidar).', { ms: 6000 });
    } catch (e) { $('#pp-falta').textContent = e.message; }
  };
  AC['pp-remover'] = async () => {
    if (!(await confirmar('Remover ' + (pes ? pes.Nome : 'esta pessoa') + ' da viagem? As despesas já lançadas continuam.', { ok: 'Remover', perigo: true }))) return;
    excluir('Participantes', part.ID);
    fecharPainel();
  };
}

/* ============================== viagem ============================== */
function formViagem(id) {
  const v = id ? ach('Viagens', id) : null;
  const fams = vivos('Familias');
  const minha = minhaFamilia() || (vivos('Participantes').find(p => p.PessoaID === euId()) || {}).FamiliaID;
  formulario('Viagens', id, {
    titulo: v ? 'Dados da viagem' : 'Nova viagem',
    campos: ['Nome', 'DataInicio', 'DataFim', 'MoedaAcerto', 'Status', 'Notas'],
    ajuda: { MoedaAcerto: 'Todos os saldos e o acerto ficam nesta moeda (uma só, para evitar várias transferências).' },
    topo: !v ? `<label class="campo"><span>Sua família nesta viagem</span><select id="via-fam">${fams.map(f => `<option value="${f.ID}" ${f.ID === minha ? 'selected' : ''}>${esc(f.Nome)}</option>`).join('')}<option value="">Nova família</option></select></label>` : '',
    podeExcluir: false,
    antesSalvar: c => c,
    extra: undefined,
    depois: l => { if (!v) { S.viagemId = l.ID; S.part[l.ID] = { papel: 'organizador', familiaId: minha }; mudou(); ir('#/hoje'); toast('Viagem criada. Agora adicione cidades e pessoas.'); } }
  });
  if (!v) {
    AC['form-salvar'] = () => {
      const fam = $('#via-fam') ? $('#via-fam').value : '';
      const f = $('#form-generico');
      const campos = lerCampos(f, ['Nome', 'DataInicio', 'DataFim', 'MoedaAcerto', 'Status', 'Notas']);
      const l = salvar('Viagens', null, campos, { extra: { familiaId: fam }, msg: 'Viagem criada' });
      // o servidor cria a participação como organizador; aqui já mostramos localmente
      salvarParticipacaoLocal(l.ID, fam);
      fecharPainel();
      S.viagemId = l.ID; mudou(); ir('#/hoje');
    };
  }
}
function salvarParticipacaoLocal(viagemId, fam) {
  S.part[viagemId] = { papel: 'organizador', familiaId: fam };
  const pid = 'PAR-local000-' + Math.random().toString(36).slice(2, 8);
  (S.tab.Participantes = S.tab.Participantes || {})[pid] = { ID: pid, ViagemID: viagemId, PessoaID: euId(), FamiliaID: fam, Papel: 'organizador', CotaPadrao: 1, Excluido: 'não', _pendente: true, _local: true };
}
