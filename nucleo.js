/**
 * Nucleo.gs — código compartilhado entre o servidor (Apps Script) e o app (web/nucleo.js).
 * Os dois arquivos devem ser IDÊNTICOS. Não use serviços do Google aqui (SpreadsheetApp etc.).
 * Contém: esquema das abas, validação de campos, divisão de despesas, saldos,
 * sugestão de acerto com o menor número de transferências, orçamento, distâncias e links de mapa.
 */
var NUCLEO_VERSAO = '1.0.0';

/* ============================== ESQUEMA ============================== */

var COLUNAS_PADRAO = ['ID', 'ViagemID', 'RegistradoEm', 'AtualizadoEm', 'AtualizadoPor', 'Versao', 'Excluido'];

/*
 * Formato de cada campo:  Nome:tipo(arg)!#~=padrão@Rótulo
 *   tipos: txt, longtxt, num, int(min-max), data (aaaa-mm-dd), hora (hh:mm), dh (aaaa-mm-ddThh:mm),
 *          bool (sim/não), enum(a,b,c), ref(Aba), refs(Aba) (lista de IDs separada por vírgula), moeda (EUR)
 *   !  obrigatório   #  calculado pelo script (não aceita valor do app)   ~  só no servidor (nunca vai ao app)
 */
var ESQUEMA_TEXTO = {
  Viagens: { p: 'VIA', campos: [
    'Nome:txt!@Nome da viagem', 'DataInicio:data!@Início', 'DataFim:data!@Fim',
    'MoedaAcerto:moeda!=EUR@Moeda do acerto', 'Status:enum(planejando,em andamento,encerrada)!=planejando@Situação',
    'PastaDriveID:txt~@Pasta no Drive', 'Cor:txt@Cor', 'Notas:longtxt@Notas'] },
  Pessoas: { p: 'PES', global: true, campos: [
    'Nome:txt!@Nome', 'Apelido:txt@Apelido', 'Tipo:enum(adulto,criança)!=adulto@Tipo', 'Email:txt@E-mail',
    'Pix:txt@Chave Pix', 'PinHash:txt~@PIN (hash)', 'PinSal:txt~@PIN (sal)', 'PinInicial:txt~@PIN inicial',
    'Cor:txt@Cor', 'Ativo:bool=sim@Ativo'] },
  Familias: { p: 'FAM', global: true, campos: ['Nome:txt!@Nome da família', 'Cor:txt@Cor'] },
  Participantes: { p: 'PAR', campos: [
    'PessoaID:ref(Pessoas)!@Pessoa', 'FamiliaID:ref(Familias)!@Família',
    'Papel:enum(organizador,participante,leitor)!=participante@Papel', 'CotaPadrao:num=1@Cota padrão',
    'DataEntrada:data@Entra na viagem em', 'DataSaida:data@Sai da viagem em'] },
  Cidades: { p: 'CID', campos: [
    'Nome:txt!@Cidade', 'Pais:txt@País', 'Moeda:moeda=EUR@Moeda local', 'Fuso:txt=Europe/Brussels@Fuso horário',
    'Chegada:data@Chegada', 'Saida:data@Saída', 'Lat:num@Latitude', 'Lng:num@Longitude',
    'Idioma:txt@Idioma', 'Tomada:txt@Tomada', 'Emergencia:txt@Emergência'] },
  Categorias: { p: 'CAT', global: true, campos: [
    'Nome:txt!@Categoria', 'Icone:txt@Ícone', 'Cor:txt@Cor', 'Ordem:int@Ordem', 'Ativo:bool=sim@Ativa'] },
  Lugares: { p: 'LUG', campos: [
    'Nome:txt!@Nome', 'Tipo:enum(hospedagem,atividade,restaurante,transporte,interesse,outro)!=interesse@Tipo',
    'Status:enum(ideia,agendado,reservado)!=ideia@Situação', 'CidadeID:ref(Cidades)@Cidade', 'Endereco:txt@Endereço',
    'Lat:num@Latitude', 'Lng:num@Longitude', 'FonteCoord:enum(busca,toque,link,manual)@Origem das coordenadas',
    'Link:txt@Link', 'Telefone:txt@Telefone', 'Acessibilidade:txt@Acessibilidade', 'Notas:longtxt@Notas'] },
  Atividades: { p: 'ATV', campos: [
    'Data:data!@Dia', 'Ordem:int=0@Ordem', 'HoraInicio:hora@Início', 'HoraFim:hora@Fim', 'Titulo:txt!@O quê',
    'LugarID:ref(Lugares)@Lugar', 'ResponsavelID:ref(Pessoas)@Responsável', 'Quem:refs(Pessoas)@Quem vai (vazio = todos)',
    'Tipo:enum(atividade,deslocamento,refeição,pausa)!=atividade@Tipo', 'Notas:longtxt@Notas',
    'KmAteProximo:num#@Km até o próximo', 'MinAteProximo:num#@Min até o próximo'] },
  Reservas: { p: 'RES', campos: [
    'Tipo:enum(voo,hospedagem,carro,trem,ingresso,restaurante,outro)!=hospedagem@Tipo', 'Titulo:txt!@Título',
    'Fornecedor:txt@Fornecedor', 'Codigo:txt@Código de confirmação', 'Inicio:dh@Início', 'Fim:dh@Fim',
    'LugarID:ref(Lugares)@Lugar', 'LugarDestinoID:ref(Lugares)@Destino', 'Pessoas:refs(Pessoas)@Pessoas',
    'Valor:num@Valor', 'Moeda:moeda@Moeda', 'Pagamento:enum(pago,parcial,a pagar)=a pagar@Pagamento',
    'PrazoPagamento:data@Prazo de pagamento', 'PrazoCancelamento:data@Cancelamento grátis até',
    'PoliticaCancelamento:longtxt@Política de cancelamento', 'ResponsavelID:ref(Pessoas)@Responsável',
    'DespesaID:ref(Despesas)@Despesa', 'Notas:longtxt@Notas'] },
  Despesas: { p: 'DSP', campos: [
    'Data:data!@Data', 'Descricao:txt@Descrição', 'CategoriaID:ref(Categorias)!@Categoria', 'CidadeID:ref(Cidades)@Cidade',
    'Valor:num!@Valor', 'Moeda:moeda!@Moeda', 'Cotacao:num@Cotação (para a moeda do acerto)', 'CotacaoBRL:num@Cotação para BRL',
    'FonteCotacao:enum(bce,manual,cartão,provisória)=provisória@Fonte da cotação', 'DataCotacao:data@Data da cotação',
    'ValorAcerto:num#@Valor na moeda do acerto', 'ValorBRL:num#@Valor em BRL', 'PagoPor:ref(Pessoas)!@Quem pagou',
    'TipoDivisao:enum(igual,família,cotas,valores)!=família@Divisão', 'ForaDivisao:bool=não@Fora da divisão',
    'ParaFamiliaID:ref(Familias)@Custo da família', 'ReservaID:ref(Reservas)@Reserva', 'AnexoID:ref(Anexos)@Comprovante',
    'Notas:longtxt@Notas'] },
  DespesaPartes: { p: 'DPT', campos: [
    'DespesaID:ref(Despesas)!@Despesa', 'Base:enum(pessoa,família)!=pessoa@Base', 'RefID:txt!@Pessoa ou família',
    'Peso:num=1@Peso', 'ValorFixo:num@Valor fixo', 'ValorDevido:num#@Valor devido'] },
  Acertos: { p: 'ACE', campos: [
    'Data:data!@Data', 'DePessoaID:ref(Pessoas)!@Quem pagou', 'ParaPessoaID:ref(Pessoas)!@Quem recebeu',
    'Valor:num!@Valor', 'Moeda:moeda!@Moeda', 'Cotacao:num@Cotação', 'ValorAcerto:num#@Valor na moeda do acerto',
    'Meio:enum(pix,dinheiro,transferência,outro)=pix@Meio', 'Notas:txt@Notas'] },
  Orcamento: { p: 'ORC', campos: [
    'CategoriaID:ref(Categorias)!@Categoria', 'CidadeID:ref(Cidades)@Cidade (opcional)', 'Data:data@Dia (opcional)',
    'Valor:num!@Valor', 'Moeda:moeda!@Moeda', 'Cotacao:num@Cotação', 'ValorAcerto:num#@Valor na moeda do acerto'] },
  Tarefas: { p: 'TAR', campos: [
    'Titulo:txt!@Tarefa', 'Tipo:enum(documento,visto,vacina,seguro,reserva,compra,mapas,outro)=outro@Tipo',
    'ResponsavelID:ref(Pessoas)@Responsável', 'Prazo:data@Prazo', 'Status:enum(a fazer,feito)!=a fazer@Situação',
    'AvisarDiasAntes:int(0-60)=3@Avisar quantos dias antes', 'ReservaID:ref(Reservas)@Reserva', 'Notas:longtxt@Notas'] },
  Votacoes: { p: 'VOT', campos: [
    'Pergunta:txt!@Pergunta', 'Prazo:data@Prazo para votar', 'Status:enum(aberta,decidida,cancelada)!=aberta@Situação',
    'OpcaoEscolhidaID:ref(Opcoes)@Opção escolhida', 'DecididaPor:ref(Pessoas)@Decidida por', 'DecididaEm:dh@Decidida em'] },
  Opcoes: { p: 'OPC', campos: [
    'VotacaoID:ref(Votacoes)!@Votação', 'Titulo:txt!@Opção', 'Link:txt@Link', 'Preco:num@Preço', 'Moeda:moeda@Moeda',
    'LugarID:ref(Lugares)@Lugar', 'Notas:longtxt@Notas', 'CriadaPor:ref(Pessoas)@Sugerida por'] },
  Votos: { p: 'VTO', campos: ['VotacaoID:ref(Votacoes)!@Votação', 'OpcaoID:ref(Opcoes)!@Opção', 'PessoaID:ref(Pessoas)!@Pessoa'] },
  Checklists: { p: 'CHK', campos: [
    'Nome:txt!@Lista', 'Tipo:enum(mala,documentos,saída de casa,outro)=mala@Tipo',
    'DonoPessoaID:ref(Pessoas)@De quem', 'ModeloID:ref(Modelos)@Modelo usado'] },
  ChecklistItens: { p: 'CHI', campos: [
    'ChecklistID:ref(Checklists)!@Lista', 'Texto:txt!@Item', 'Qtde:int@Qtde', 'Feito:bool=não@Feito',
    'FeitoPor:ref(Pessoas)@Marcado por', 'Ordem:int@Ordem'] },
  Modelos: { p: 'MOD', global: true, campos: [
    'Nome:txt!@Modelo', 'Tipo:enum(mala,documentos,saída de casa,outro)=mala@Tipo',
    'FaixaEtaria:enum(bebê,criança,adulto,idoso,todos)=todos@Faixa etária'] },
  ModeloItens: { p: 'MOI', global: true, campos: ['ModeloID:ref(Modelos)!@Modelo', 'Texto:txt!@Item', 'Qtde:int@Qtde', 'Ordem:int@Ordem'] },
  Anexos: { p: 'ANX', campos: [
    'Titulo:txt!@Título', 'Tipo:enum(passagem,voucher,seguro,documento,outro)=outro@Tipo',
    'Visibilidade:enum(grupo,família,pessoal)!=grupo@Quem pode ver', 'DonoPessoaID:ref(Pessoas)@Dono',
    'FamiliaID:ref(Familias)@Família', 'ArquivoID:txt~@Arquivo no Drive', 'NomeArquivo:txt@Nome do arquivo',
    'Mime:txt@Tipo do arquivo', 'Tamanho:int@Tamanho (bytes)', 'VinculoTipo:enum(reserva,despesa,lugar,pessoa,viagem)@Vinculado a',
    'VinculoID:txt@Vínculo', 'Validade:data@Validade'] },
  Infos: { p: 'INF', campos: [
    'CidadeID:ref(Cidades)@Cidade', 'Categoria:enum(emergência,seguro,embaixada,saúde,tomada,fuso,moeda,frases,contato)!=contato@Categoria',
    'Titulo:txt!@Título', 'Conteudo:longtxt@Conteúdo', 'Telefone:txt@Telefone'] },
  Diario: { p: 'DIA', campos: ['Data:data!@Dia', 'PessoaID:ref(Pessoas)!@Quem escreveu', 'Texto:longtxt!@Texto'] },
  Avaliacoes: { p: 'AVA', campos: [
    'LugarID:ref(Lugares)!@Lugar', 'PessoaID:ref(Pessoas)!@Pessoa', 'Nota:int(1-5)!@Nota (1 a 5)',
    'Voltaria:bool@Voltaria?', 'Comentario:longtxt@Comentário'] },
  Mensagens: { p: 'MSG', global: true, campos: ['Nome:txt!@Modelo', 'Texto:longtxt!@Texto com {variáveis}'] }
};

/** Abas internas (só no servidor, cabeçalho próprio). */
var ABAS_INTERNAS = {
  Config: ['Chave', 'Valor', 'Descricao'],
  Sessoes: ['ID', 'TokenHash', 'PessoaID', 'CriadoEm', 'ExpiraEm', 'Aparelho', 'UltimoUso', 'Ativa'],
  Historico: ['Quando', 'PessoaID', 'OpID', 'Acao', 'Aba', 'RegistroID', 'Antes', 'Depois'],
  Cotacoes: ['Data', 'De', 'Para', 'Taxa', 'Fonte'],
  Saldos: ['ViagemID', 'Nivel', 'RefID', 'Nome', 'Pagou', 'Consumiu', 'Recebeu', 'Repassou', 'Saldo', 'AtualizadoEm'],
  ResumoOrcamento: ['ViagemID', 'Dimensao', 'Chave', 'Nome', 'Orcado', 'Gasto', 'Diferenca', 'Percentual', 'AtualizadoEm'],
  PerguntasIA: ['Quando', 'PessoaID', 'Pergunta', 'Resposta'],
  Erros: ['Quando', 'Origem', 'Mensagem', 'Detalhe']
};

var ESQUEMA = (function () {
  var out = {};
  var re = /^(\w+):(\w+)(?:\(([^)]*)\))?([!#~]*)(?:=([^@]*))?(?:@(.*))?$/;
  Object.keys(ESQUEMA_TEXTO).forEach(function (aba) {
    var def = ESQUEMA_TEXTO[aba];
    var campos = def.campos.map(function (s) {
      var m = re.exec(s);
      if (!m) throw new Error('Esquema inválido: ' + aba + ' / ' + s);
      var c = { nome: m[1], tipo: m[2], arg: m[3] || '', obrig: m[4].indexOf('!') >= 0,
        calc: m[4].indexOf('#') >= 0, servidor: m[4].indexOf('~') >= 0,
        padrao: m[5] === undefined ? '' : m[5], rotulo: m[6] || m[1] };
      if (c.tipo === 'enum') c.valores = c.arg.split(',');
      if (c.tipo === 'ref' || c.tipo === 'refs') c.aba = c.arg;
      if (c.tipo === 'int' && c.arg) { var mm = c.arg.split('-'); c.min = Number(mm[0]); c.max = Number(mm[1]); }
      return c;
    });
    out[aba] = { aba: aba, prefixo: def.p, global: !!def.global, campos: campos,
      colunas: COLUNAS_PADRAO.concat(campos.map(function (c) { return c.nome; })),
      porNome: campos.reduce(function (a, c) { a[c.nome] = c; return a; }, {}) };
  });
  return out;
})();

var ABAS_SINC = Object.keys(ESQUEMA);

/* ============================== UTILITÁRIOS ============================== */

function N_sim(v) { return v === true || v === 'sim' || v === 'TRUE' || v === 'true'; }
function N_vivos(linhas) { return (linhas || []).filter(function (r) { return !N_sim(r.Excluido); }); }
function N_porId(linhas) { var o = {}; (linhas || []).forEach(function (r) { o[r.ID] = r; }); return o; }
function N_num(v) { if (v === '' || v === null || v === undefined) return null; var n = Number(String(v).replace(',', '.')); return isFinite(n) ? n : null; }
function N_cent(v) { var n = N_num(v); return n === null ? 0 : Math.round(n * 100); }
function N_lista(v) { return String(v || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }

function N_novoId(prefixo) {
  var t = Date.now().toString(36);
  var r = '';
  while (r.length < 8) r += Math.random().toString(36).slice(2);
  return prefixo + '-' + t + '-' + r.slice(0, 8);
}

var N_RE_ID = /^[A-Z]{3}-[a-z0-9]{6,12}-[a-z0-9]{4,10}$/;

function N_formatarMoeda(cent, moeda) {
  var v = (cent || 0) / 100;
  var s = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var simb = { EUR: '€', BRL: 'R$', USD: 'US$', GBP: '£', CHF: 'CHF' }[moeda] || moeda || '';
  return (v < 0 ? '−' : '') + simb + ' ' + s;
}

function N_preencher(texto, vars) {
  return String(texto || '').replace(/\{(\w+)\}/g, function (m, k) {
    return vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m;
  });
}

/* ============================== VALIDAÇÃO ============================== */

/**
 * Valida e normaliza os campos de uma linha (vindos do app).
 * Retorna { ok, campos (normalizados), erros: [mensagens] }. Campos calculados e de servidor são descartados.
 */
function N_validar(aba, campos, parcial) {
  var esq = ESQUEMA[aba];
  if (!esq) return { ok: false, campos: {}, erros: ['Aba desconhecida: ' + aba] };
  var out = {}, erros = [];
  esq.campos.forEach(function (c) {
    if (c.calc || c.servidor) return;
    var tem = campos && Object.prototype.hasOwnProperty.call(campos, c.nome);
    if (!tem) {
      if (!parcial) {
        if (c.obrig && c.padrao === '') erros.push('Falta preencher: ' + c.rotulo);
        else out[c.nome] = c.padrao;
      }
      return;
    }
    var v = campos[c.nome];
    if (v === null || v === undefined) v = '';
    if (typeof v === 'string') v = v.trim();
    if (v === '') {
      if (c.obrig) erros.push('Falta preencher: ' + c.rotulo);
      out[c.nome] = '';
      return;
    }
    switch (c.tipo) {
      case 'num': {
        var n = N_num(v);
        if (n === null) erros.push(c.rotulo + ': número inválido');
        else out[c.nome] = Math.round(n * 1e6) / 1e6;
        break;
      }
      case 'int': {
        var i = N_num(v);
        if (i === null || Math.round(i) !== i) erros.push(c.rotulo + ': número inteiro inválido');
        else if (c.min !== undefined && (i < c.min || i > c.max)) erros.push(c.rotulo + ': deve ficar entre ' + c.min + ' e ' + c.max);
        else out[c.nome] = i;
        break;
      }
      case 'data':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(Date.parse(v + 'T00:00:00Z'))) erros.push(c.rotulo + ': data inválida (use aaaa-mm-dd)');
        else out[c.nome] = String(v);
        break;
      case 'hora':
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) erros.push(c.rotulo + ': hora inválida (use hh:mm)');
        else out[c.nome] = String(v);
        break;
      case 'dh':
        if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(String(v))) erros.push(c.rotulo + ': data e hora inválidas');
        else out[c.nome] = String(v);
        break;
      case 'bool': {
        var b = String(v).toLowerCase();
        if (['sim', 'true', '1'].indexOf(b) >= 0) out[c.nome] = 'sim';
        else if (['não', 'nao', 'false', '0'].indexOf(b) >= 0) out[c.nome] = 'não';
        else erros.push(c.rotulo + ': use sim ou não');
        break;
      }
      case 'enum':
        if (c.valores.indexOf(String(v)) < 0) erros.push(c.rotulo + ': valor "' + v + '" não permitido. Use: ' + c.valores.join(', '));
        else out[c.nome] = String(v);
        break;
      case 'moeda':
        if (!/^[A-Z]{3}$/.test(String(v).toUpperCase())) erros.push(c.rotulo + ': moeda inválida (ex.: EUR)');
        else out[c.nome] = String(v).toUpperCase();
        break;
      case 'ref':
        if (!N_RE_ID.test(String(v))) erros.push(c.rotulo + ': referência inválida');
        else out[c.nome] = String(v);
        break;
      case 'refs': {
        var l = N_lista(v);
        if (l.some(function (x) { return !N_RE_ID.test(x); })) erros.push(c.rotulo + ': lista inválida');
        else out[c.nome] = l.join(',');
        break;
      }
      case 'longtxt':
        out[c.nome] = String(v).slice(0, 5000);
        break;
      default:
        out[c.nome] = String(v).slice(0, 500);
    }
  });
  return { ok: erros.length === 0, campos: out, erros: erros };
}

/* ============================== PARTICIPANTES ============================== */

function N_presente(part, data) {
  if (!data) return true;
  if (part.DataEntrada && data < part.DataEntrada) return false;
  if (part.DataSaida && data > part.DataSaida) return false;
  return true;
}

/* ============================== DISTRIBUIÇÃO ============================== */

/**
 * Distribui `totalCent` entre itens com peso. Usa centavos inteiros: a soma é sempre igual ao total.
 * A sobra do arredondamento vai para o item `preferidoIdx` (quem pagou), quando existe;
 * senão, para os maiores restos.
 */
function N_distribuir(totalCent, pesos, preferidoIdx) {
  var soma = pesos.reduce(function (a, p) { return a + p; }, 0);
  var n = pesos.length;
  if (!n) return [];
  if (soma <= 0) { pesos = pesos.map(function () { return 1; }); soma = n; }
  var sinal = totalCent < 0 ? -1 : 1, abs = Math.abs(totalCent);
  var base = [], restos = [], usado = 0;
  for (var i = 0; i < n; i++) {
    var exato = abs * pesos[i] / soma;
    base[i] = Math.floor(exato + 1e-9);
    restos[i] = exato - base[i];
    usado += base[i];
  }
  var sobra = abs - usado;
  if (sobra > 0 && preferidoIdx !== undefined && preferidoIdx !== null && preferidoIdx >= 0 && pesos[preferidoIdx] > 0) {
    base[preferidoIdx] += sobra; sobra = 0;
  }
  var ordem = restos.map(function (r, i) { return i; }).sort(function (a, b) { return restos[b] - restos[a] || a - b; });
  for (var k = 0; sobra > 0; k = (k + 1) % n) { if (pesos[ordem[k]] > 0) { base[ordem[k]]++; sobra--; } }
  return base.map(function (b) { return b * sinal; });
}

/* ============================== CÁLCULO PRINCIPAL ============================== */

/**
 * Calcula tudo que é derivado para UMA viagem.
 * @param {Object} d  linhas por aba (já filtradas pela viagem; abas globais completas)
 * @param {String} viagemId
 * @param {Object} opc  { fatorRota, velAPe, velCarro, limiteAPeKm }
 */
function N_calcular(d, viagemId, opc) {
  opc = opc || {};
  var viagem = N_porId(d.Viagens)[viagemId] || {};
  var moedaAc = viagem.MoedaAcerto || 'EUR';
  var pessoas = N_porId(d.Pessoas);
  var familias = N_porId(d.Familias);
  var parts = N_vivos(d.Participantes).filter(function (p) { return p.ViagemID === viagemId; });
  var partPorPessoa = {}; parts.forEach(function (p) { partPorPessoa[p.PessoaID] = p; });
  var familiaDe = function (pid) { var p = partPorPessoa[pid]; return p ? p.FamiliaID : null; };
  var avisos = [];

  var res = {
    moeda: moedaAc, despesas: {}, partes: {}, acertos: {}, orcLinhas: {},
    pessoa: {}, familia: {}, transferencias: [], orcamento: { categoria: [], cidade: [], dia: [], linhas: [] },
    custo: { totalAcerto: 0, totalBRL: 0, divididoAcerto: 0, foraAcerto: 0, porFamiliaAcerto: {}, porFamiliaBRL: {} },
    atividades: {}, avisos: avisos
  };
  var zera = function () { return { pagou: 0, consumiu: 0, recebeu: 0, repassou: 0, saldo: 0 }; };
  parts.forEach(function (p) {
    res.pessoa[p.PessoaID] = zera();
    if (!res.familia[p.FamiliaID]) res.familia[p.FamiliaID] = zera();
  });
  var garantePessoa = function (pid) { if (!res.pessoa[pid]) res.pessoa[pid] = zera(); return res.pessoa[pid]; };
  var garanteFamilia = function (fid) { if (!res.familia[fid]) res.familia[fid] = zera(); return res.familia[fid]; };

  // Membros de uma família presentes numa data, com pesos para repartir a parte da família entre pessoas
  var membros = function (fid, data) {
    var lista = parts.filter(function (p) { return p.FamiliaID === fid; });
    var pres = lista.filter(function (p) { return N_presente(p, data); });
    if (!pres.length) pres = lista;
    var comCota = pres.filter(function (p) { return (N_num(p.CotaPadrao) || 0) > 0; });
    var usa = comCota.length ? comCota : pres;
    return usa.map(function (p) { return { pid: p.PessoaID, peso: comCota.length ? N_num(p.CotaPadrao) : 1 }; });
  };

  var conv = function (valor, moeda, cotacao) {
    if (moeda === moedaAc) return N_cent(valor);
    var c = N_num(cotacao);
    if (c === null || c <= 0) return null;
    return Math.round((N_num(valor) || 0) * c * 100);
  };

  /* ---- Despesas ---- */
  var partesPorDesp = {};
  N_vivos(d.DespesaPartes).forEach(function (pt) { (partesPorDesp[pt.DespesaID] = partesPorDesp[pt.DespesaID] || []).push(pt); });

  N_vivos(d.Despesas).filter(function (x) { return x.ViagemID === viagemId; }).forEach(function (x) {
    var ac = conv(x.Valor, x.Moeda, x.Cotacao);
    var brl = x.Moeda === 'BRL' ? N_cent(x.Valor) : (N_num(x.CotacaoBRL) ? Math.round(N_num(x.Valor) * N_num(x.CotacaoBRL) * 100) : (moedaAc === 'BRL' ? ac : null));
    var info = { valorAcerto: ac, valorBRL: brl, partes: [], aviso: '' };
    res.despesas[x.ID] = info;
    if (ac === null) { info.aviso = 'sem cotação'; avisos.push({ tipo: 'cotacao', id: x.ID, msg: 'Despesa sem cotação: ' + (x.Descricao || x.ID) }); return; }
    res.custo.totalAcerto += ac;
    if (brl !== null) res.custo.totalBRL += brl;

    if (N_sim(x.ForaDivisao)) {
      res.custo.foraAcerto += ac;
      var ff = x.ParaFamiliaID || familiaDe(x.PagoPor) || '—';
      res.custo.porFamiliaAcerto[ff] = (res.custo.porFamiliaAcerto[ff] || 0) + ac;
      if (brl !== null) res.custo.porFamiliaBRL[ff] = (res.custo.porFamiliaBRL[ff] || 0) + brl;
      return;
    }
    res.custo.divididoAcerto += ac;

    // Monta a lista de partes {base, ref, peso}
    var tipo = x.TipoDivisao || 'família';
    var explicitas = (partesPorDesp[x.ID] || []);
    var itens;
    if (explicitas.length) {
      itens = explicitas.map(function (pt) {
        var peso = tipo === 'valores' ? (N_num(pt.ValorFixo) || 0) : (tipo === 'cotas' ? (N_num(pt.Peso) === null ? 1 : N_num(pt.Peso)) : 1);
        return { base: pt.Base, ref: pt.RefID, peso: peso, ptId: pt.ID };
      });
      if (tipo === 'valores') {
        var somaFixo = itens.reduce(function (a, i) { return a + Math.round(i.peso * 100); }, 0);
        if (Math.abs(somaFixo - N_cent(x.Valor)) > 1) {
          info.aviso = 'valores não somam o total';
          avisos.push({ tipo: 'divisao', id: x.ID, msg: 'Os valores da divisão não somam o total: ' + (x.Descricao || x.ID) });
        }
      }
    } else if (tipo === 'família') {
      var fams = {};
      parts.filter(function (p) { return N_presente(p, x.Data); }).forEach(function (p) { fams[p.FamiliaID] = 1; });
      itens = Object.keys(fams).map(function (f) { return { base: 'família', ref: f, peso: 1 }; });
    } else {
      itens = parts.filter(function (p) { return N_presente(p, x.Data); })
        .map(function (p) { return { base: 'pessoa', ref: p.PessoaID, peso: tipo === 'cotas' ? (N_num(p.CotaPadrao) || 0) : ((N_num(p.CotaPadrao) || 0) > 0 ? 1 : 0) }; })
        .filter(function (i) { return i.peso > 0; });
    }
    if (!itens.length) { avisos.push({ tipo: 'divisao', id: x.ID, msg: 'Despesa sem ninguém para dividir: ' + (x.Descricao || x.ID) }); return; }

    var famPag = familiaDe(x.PagoPor);
    var pref = -1;
    itens.forEach(function (it, i) { if (pref < 0 && ((it.base === 'pessoa' && it.ref === x.PagoPor) || (it.base === 'família' && it.ref === famPag))) pref = i; });
    var valores = N_distribuir(ac, itens.map(function (i) { return i.peso; }), pref);

    // Quem pagou
    garantePessoa(x.PagoPor).pagou += ac;
    if (famPag) garanteFamilia(famPag).pagou += ac;

    itens.forEach(function (it, i) {
      var v = valores[i];
      info.partes.push({ base: it.base, ref: it.ref, valor: v });
      if (it.ptId) res.partes[it.ptId] = v;
      if (it.base === 'família') {
        garanteFamilia(it.ref).consumiu += v;
        var ms = membros(it.ref, x.Data);
        if (ms.length) {
          var vv = N_distribuir(v, ms.map(function (m) { return m.peso; }), ms.map(function (m) { return m.pid; }).indexOf(x.PagoPor));
          ms.forEach(function (m, j) { garantePessoa(m.pid).consumiu += vv[j]; });
        }
      } else {
        garantePessoa(it.ref).consumiu += v;
        var fp = familiaDe(it.ref);
        if (fp) garanteFamilia(fp).consumiu += v;
      }
      var fc = it.base === 'família' ? it.ref : (familiaDe(it.ref) || '—');
      res.custo.porFamiliaAcerto[fc] = (res.custo.porFamiliaAcerto[fc] || 0) + v;
      if (brl !== null && ac) res.custo.porFamiliaBRL[fc] = (res.custo.porFamiliaBRL[fc] || 0) + Math.round(brl * v / ac);
    });
  });

  /* ---- Acertos ---- */
  N_vivos(d.Acertos).filter(function (a) { return a.ViagemID === viagemId; }).forEach(function (a) {
    var v = conv(a.Valor, a.Moeda, a.Cotacao);
    res.acertos[a.ID] = v;
    if (v === null) { avisos.push({ tipo: 'cotacao', id: a.ID, msg: 'Acerto sem cotação' }); return; }
    garantePessoa(a.DePessoaID).repassou += v;
    garantePessoa(a.ParaPessoaID).recebeu += v;
    var fd = familiaDe(a.DePessoaID), fr = familiaDe(a.ParaPessoaID);
    if (fd) garanteFamilia(fd).repassou += v;
    if (fr) garanteFamilia(fr).recebeu += v;
  });

  var fecha = function (s) { s.saldo = s.pagou - s.consumiu + s.repassou - s.recebeu; };
  Object.keys(res.pessoa).forEach(function (k) { fecha(res.pessoa[k]); });
  Object.keys(res.familia).forEach(function (k) { fecha(res.familia[k]); });

  /* ---- Sugestão de acerto entre famílias ---- */
  var orgDe = function (fid) {
    var ps = parts.filter(function (p) { return p.FamiliaID === fid; });
    var adultos = ps.filter(function (p) { var pe = pessoas[p.PessoaID]; return pe && pe.Tipo !== 'criança'; });
    var org = adultos.filter(function (p) { return p.Papel === 'organizador'; })[0] || adultos[0] || ps[0];
    return org ? org.PessoaID : null;
  };
  var saldosFam = Object.keys(res.familia).map(function (f) { return { id: f, saldo: res.familia[f].saldo }; });
  res.transferencias = N_menorAcerto(saldosFam).map(function (t) {
    return { deFamilia: t.de, paraFamilia: t.para, dePessoa: orgDe(t.de), paraPessoa: orgDe(t.para), valor: t.valor };
  });

  /* ---- Orçamento ---- */
  var gastos = N_vivos(d.Despesas).filter(function (x) { return x.ViagemID === viagemId && res.despesas[x.ID] && res.despesas[x.ID].valorAcerto !== null; });
  var linhas = N_vivos(d.Orcamento).filter(function (o) { return o.ViagemID === viagemId; });
  var dims = { categoria: {}, cidade: {}, dia: {} };
  var soma = function (dim, chave, campo, v) {
    if (!chave) return;
    var o = dims[dim][chave] || (dims[dim][chave] = { chave: chave, orcado: 0, gasto: 0 });
    o[campo] += v;
  };
  linhas.forEach(function (o) {
    var v = conv(o.Valor, o.Moeda, o.Cotacao);
    res.orcLinhas[o.ID] = v;
    if (v === null) { avisos.push({ tipo: 'cotacao', id: o.ID, msg: 'Linha de orçamento sem cotação' }); return; }
    var g = gastos.filter(function (x) {
      return x.CategoriaID === o.CategoriaID && (!o.CidadeID || x.CidadeID === o.CidadeID) && (!o.Data || x.Data === o.Data);
    }).reduce(function (a, x) { return a + res.despesas[x.ID].valorAcerto; }, 0);
    res.orcamento.linhas.push({ id: o.ID, orcado: v, gasto: g, pct: v ? Math.round(g * 100 / v) : null });
    soma('categoria', o.CategoriaID, 'orcado', v);
    soma('cidade', o.CidadeID, 'orcado', v);
    soma('dia', o.Data, 'orcado', v);
  });
  gastos.forEach(function (x) {
    var v = res.despesas[x.ID].valorAcerto;
    soma('categoria', x.CategoriaID, 'gasto', v);
    soma('cidade', x.CidadeID, 'gasto', v);
    soma('dia', x.Data, 'gasto', v);
  });
  ['categoria', 'cidade', 'dia'].forEach(function (dim) {
    res.orcamento[dim] = Object.keys(dims[dim]).sort().map(function (k) {
      var o = dims[dim][k]; o.diferenca = o.orcado - o.gasto; o.pct = o.orcado ? Math.round(o.gasto * 100 / o.orcado) : null; return o;
    });
  });

  /* ---- Distâncias do roteiro ---- */
  var lug = N_porId(N_vivos(d.Lugares));
  var porDia = {};
  N_vivos(d.Atividades).filter(function (a) { return a.ViagemID === viagemId; }).forEach(function (a) { (porDia[a.Data] = porDia[a.Data] || []).push(a); });
  Object.keys(porDia).forEach(function (dia) {
    var l = N_ordenarAtividades(porDia[dia]);
    l.forEach(function (a, i) {
      var r = { km: '', min: '' };
      var b = l[i + 1];
      var la = a.LugarID && lug[a.LugarID], lb = b && b.LugarID && lug[b.LugarID];
      if (la && lb && N_num(la.Lat) !== null && N_num(lb.Lat) !== null) {
        var km = N_distKm(N_num(la.Lat), N_num(la.Lng), N_num(lb.Lat), N_num(lb.Lng)) * (opc.fatorRota || 1.3);
        r.km = Math.round(km * 10) / 10;
        r.min = N_estimarMin(km, opc);
        r.modo = km <= (opc.limiteAPeKm || 1.5) ? 'a pé' : 'carro';
      }
      res.atividades[a.ID] = r;
    });
  });

  return res;
}

function N_ordenarAtividades(lista) {
  return lista.slice().sort(function (a, b) {
    return (Number(a.Ordem) || 0) - (Number(b.Ordem) || 0) || String(a.HoraInicio || '99').localeCompare(String(b.HoraInicio || '99')) || String(a.ID).localeCompare(String(b.ID));
  });
}

/* ============================== MENOR ACERTO ============================== */

/**
 * Recebe [{id, saldo (centavos; + recebe, − paga)}] e devolve [{de, para, valor}]
 * com o MENOR número de transferências possível (busca exata até 14 participantes; acima disso, método guloso).
 * Ideia: o mínimo = n − (máximo de subgrupos disjuntos que somam zero).
 */
function N_menorAcerto(saldos) {
  var s = saldos.filter(function (x) { return Math.abs(x.saldo) > 0; });
  var n = s.length;
  if (!n) return [];
  var guloso = function (grupo) {
    var cred = grupo.filter(function (x) { return x.saldo > 0; }).map(function (x) { return { id: x.id, v: x.saldo }; }).sort(function (a, b) { return b.v - a.v; });
    var deb = grupo.filter(function (x) { return x.saldo < 0; }).map(function (x) { return { id: x.id, v: -x.saldo }; }).sort(function (a, b) { return b.v - a.v; });
    var out = [], i = 0, j = 0;
    while (i < deb.length && j < cred.length) {
      var v = Math.min(deb[i].v, cred[j].v);
      if (v > 0) out.push({ de: deb[i].id, para: cred[j].id, valor: v });
      deb[i].v -= v; cred[j].v -= v;
      if (deb[i].v === 0) i++;
      if (cred[j].v === 0) j++;
    }
    return out;
  };
  if (n > 14) return guloso(s);
  var total = 1 << n, somas = new Array(total), dp = new Array(total), pai = new Array(total);
  somas[0] = 0; dp[0] = 0;
  for (var m = 1; m < total; m++) {
    var lsb = m & -m, idx = 31 - Math.clz32(lsb);
    somas[m] = somas[m ^ lsb] + s[idx].saldo;
    var melhor = -1, de = -1;
    for (var k = 0; k < n; k++) {
      if (m & (1 << k)) { var v = dp[m ^ (1 << k)]; if (v > melhor) { melhor = v; de = k; } }
    }
    dp[m] = melhor + (somas[m] === 0 ? 1 : 0);
    pai[m] = de;
  }
  // Reconstrói a ordem de inclusão e corta nos pontos em que a soma acumulada zera
  var ordem = [], cur = total - 1;
  while (cur) { ordem.push(pai[cur]); cur ^= (1 << pai[cur]); }
  ordem.reverse();
  var grupos = [], atual = [], acum = 0;
  ordem.forEach(function (k) { atual.push(s[k]); acum += s[k].saldo; if (acum === 0) { grupos.push(atual); atual = []; } });
  if (atual.length) grupos.push(atual);
  var res = [];
  grupos.forEach(function (g) { res = res.concat(guloso(g)); });
  return res;
}

/* ============================== MAPA ============================== */

function N_distKm(lat1, lng1, lat2, lng2) {
  var R = 6371, rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** km já corrigido pelo fator de rota. A pé até o limite; acima disso, carro. */
function N_estimarMin(km, opc) {
  opc = opc || {};
  var aPe = km <= (opc.limiteAPeKm || 1.5);
  var vel = aPe ? (opc.velAPe || 4.5) : (opc.velCarro || 30);
  return Math.max(1, Math.round(km / vel * 60));
}

function N_linksMapa(lat, lng, nome) {
  var ll = lat + ',' + lng, q = encodeURIComponent(nome || ll);
  return {
    apple: 'https://maps.apple.com/?ll=' + ll + '&q=' + q,
    appleRota: 'https://maps.apple.com/?daddr=' + ll,
    google: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ll),
    googleRota: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(ll),
    waze: 'https://waze.com/ul?ll=' + encodeURIComponent(ll) + '&navigate=yes'
  };
}

/** Extrai coordenadas de um link do Google Maps (formato longo). Retorna {lat,lng} ou null. */
function N_coordsDeLink(url) {
  var s = String(url || '');
  try { s = decodeURIComponent(s); } catch (e) { /* mantém */ }
  var pads = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination|daddr)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^\s*(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)\s*$/];
  for (var i = 0; i < pads.length; i++) {
    var m = pads[i].exec(s);
    if (m) {
      var lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: lat, lng: lng };
    }
  }
  return null;
}

/* ============================== DATAS ============================== */

function N_dias(inicio, fim) {
  var out = [];
  if (!inicio || !fim) return out;
  var d = new Date(inicio + 'T12:00:00Z'), f = new Date(fim + 'T12:00:00Z');
  for (var i = 0; d <= f && i < 400; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/** Cidade em que o grupo está numa data (Chegada ≤ data < Saida; no dia da saída, conta a próxima). */
function N_cidadeDoDia(cidades, data) {
  var l = N_vivos(cidades).filter(function (c) { return c.Chegada && c.Saida; })
    .sort(function (a, b) { return a.Chegada.localeCompare(b.Chegada); });
  var c = l.filter(function (c) { return data >= c.Chegada && data < c.Saida; })[0];
  if (!c) c = l.filter(function (c) { return data === c.Saida; })[0];
  return c || null;
}

/* ============================== AJUDA (perguntas frequentes) ============================== */

var N_FAQ = [
  ['Como lanço uma despesa rápido?', 'Toque no + no meio da barra de baixo, digite o valor, escolha a categoria e toque em Salvar. Quem pagou (você), a moeda (a da cidade do dia), a data (hoje) e a divisão (a última usada) já vêm preenchidos; toque na linha de resumo para mudar.'],
  ['O app funciona sem internet?', 'Sim, depois de instalado na tela inicial. Roteiro, reservas, lugares, informações, checklists e saldos ficam no aparelho. O que você lançar sem sinal entra na fila e é enviado quando a conexão voltar (o contador aparece no topo). Busca de endereço, cotação nova e votação precisam de internet.'],
  ['Por que preciso instalar na tela inicial do iPhone?', 'No iPhone, o Safari apaga os dados de sites não instalados depois de alguns dias sem uso. Instalado na tela inicial, o app guarda os dados e abre sem internet. No Safari: botão Compartilhar → Adicionar à Tela de Início.'],
  ['Como funciona a divisão?', 'Cada despesa escolhe: Família (partes iguais entre as famílias presentes no dia), Igual (partes iguais entre as pessoas com cota maior que zero), Cotas (proporcional à cota de cada pessoa; ex.: criança 0,5) ou Valores (você digita quanto cabe a cada um). Quem entra no meio da viagem só divide despesas a partir do dia em que entra.'],
  ['O que é "fora da divisão"?', 'Despesas que cada família paga por conta própria, como passagens com milhas. Entram no custo total da viagem e no custo da família, mas não mexem nos saldos entre famílias.'],
  ['Como é feito o acerto de contas?', 'Em Contas, o app soma tudo na moeda do acerto da viagem e sugere o menor número de transferências entre as famílias. Depois de pagar, toque em "Registrar pagamento". Pode acertar a qualquer momento; despesas novas entram no próximo acerto.'],
  ['Qual cotação o app usa?', 'A cotação de referência do Banco Central Europeu do dia da despesa (em fim de semana, a do último dia útil), gravada na despesa. Se quiser usar a cotação real do cartão, troque a fonte para "cartão" e digite o valor. Sem internet, o app usa a última cotação conhecida e corrige quando sincronizar.'],
  ['Quem vê meus documentos?', 'Cada documento tem um nível: Grupo (todos da viagem), Família (só os adultos da sua família) ou Pessoal (só você). Atenção: o dono da planilha no Google Drive consegue abrir todos os arquivos.'],
  ['Como adiciono um lugar no mapa?', 'No Mapa, toque em "Adicionar lugar" e busque pelo nome ou endereço, ou cole um link do Google Maps, ou toque e segure no ponto do mapa. Confirme o pino e salve. Para virar atividade, abra o lugar e toque em "Pôr no roteiro".'],
  ['O mapa funciona offline?', 'O fundo do mapa precisa de internet (áreas já vistas podem aparecer). Sem sinal, a lista de lugares com endereço e os botões Apple Maps, Google Maps e Waze continuam funcionando. Antes de viajar, baixe os mapas offline de cada cidade no Google Maps ou Apple Maps (há uma tarefa para isso).'],
  ['Desfiz algo sem querer. E agora?', 'Logo após cada mudança aparece "Desfazer" no rodapé. Itens excluídos também podem ser restaurados pelo histórico do item.'],
  ['Duas pessoas editaram a mesma coisa. O que acontece?', 'A segunda gravação recebe um aviso de conflito e o app mostra as duas versões para você escolher qual manter.'],
  ['Esqueci o PIN.', 'Peça a um organizador para definir um PIN provisório (em Pessoas). No primeiro acesso, troque em Mais → Meu perfil.'],
  ['Como convido alguém?', 'O organizador cadastra a pessoa, define um PIN provisório e envia o link de convite (Mais → Viagem → Convite).']
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ESQUEMA: ESQUEMA, ABAS_INTERNAS: ABAS_INTERNAS, ABAS_SINC: ABAS_SINC, COLUNAS_PADRAO: COLUNAS_PADRAO,
    N_validar: N_validar, N_calcular: N_calcular, N_menorAcerto: N_menorAcerto, N_distribuir: N_distribuir,
    N_distKm: N_distKm, N_estimarMin: N_estimarMin, N_linksMapa: N_linksMapa, N_coordsDeLink: N_coordsDeLink,
    N_dias: N_dias, N_cidadeDoDia: N_cidadeDoDia, N_novoId: N_novoId, N_formatarMoeda: N_formatarMoeda,
    N_preencher: N_preencher, N_RE_ID: N_RE_ID, N_FAQ: N_FAQ, N_ordenarAtividades: N_ordenarAtividades, N_porId: N_porId, N_presente: N_presente, N_vivos: N_vivos, N_sim: N_sim };
}
