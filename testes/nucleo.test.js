/* Testes do núcleo compartilhado (rode com: node --test testes/nucleo.test.js) */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const N = require('../nucleo.js');

const ID = p => p + '-abcdef12-abcd';

test('distribuir: a soma é sempre o total e a sobra vai para quem pagou', () => {
  const v = N.N_distribuir(1000, [1, 1, 1], 2);
  assert.strictEqual(v.reduce((a, b) => a + b, 0), 1000);
  assert.deepStrictEqual(v, [333, 333, 334]);
  assert.deepStrictEqual(N.N_distribuir(-100, [1, 1, 1]).reduce((a, b) => a + b, 0), -100);
});

test('menor acerto: zera os saldos com o mínimo de transferências', () => {
  const saldos = [{ id: 'a', saldo: 500 }, { id: 'b', saldo: -300 }, { id: 'c', saldo: -200 }, { id: 'd', saldo: 100 }, { id: 'e', saldo: -100 }];
  const t = N.N_menorAcerto(saldos);
  const final = {}; saldos.forEach(s => final[s.id] = s.saldo);
  t.forEach(x => { final[x.de] += x.valor; final[x.para] -= x.valor; });
  assert.ok(Object.values(final).every(v => v === 0));
  assert.strictEqual(t.length, 3); // {d,e} fecha sozinho; {a,b,c} precisa de 2
});

test('validar: normaliza tipos e acusa campos obrigatórios', () => {
  const ok = N.N_validar('Despesas', { Data: '2026-05-01', CategoriaID: ID('CAT'), Valor: '12,5', Moeda: 'eur', PagoPor: ID('PES') });
  assert.ok(ok.ok, ok.erros.join());
  assert.strictEqual(ok.campos.Valor, 12.5);
  assert.strictEqual(ok.campos.Moeda, 'EUR');
  const falta = N.N_validar('Despesas', { Valor: '10' });
  assert.ok(!falta.ok);
});

test('calcular: divisão por família e saldo de quem pagou', () => {
  const V = ID('VIA');
  const d = {
    Viagens: [{ ID: V, MoedaAcerto: 'EUR' }],
    Pessoas: [{ ID: 'PES-aaaaaa-0001', Tipo: 'adulto' }, { ID: 'PES-aaaaaa-0002', Tipo: 'adulto' }],
    Familias: [{ ID: 'FAM-aaaaaa-0001' }, { ID: 'FAM-aaaaaa-0002' }],
    Participantes: [
      { ID: 'PAR-1', ViagemID: V, PessoaID: 'PES-aaaaaa-0001', FamiliaID: 'FAM-aaaaaa-0001', CotaPadrao: 1 },
      { ID: 'PAR-2', ViagemID: V, PessoaID: 'PES-aaaaaa-0002', FamiliaID: 'FAM-aaaaaa-0002', CotaPadrao: 1 }],
    Despesas: [{ ID: 'DSP-1', ViagemID: V, Data: '2026-05-01', Valor: 100, Moeda: 'EUR', PagoPor: 'PES-aaaaaa-0001', TipoDivisao: 'família' }],
    DespesaPartes: [], Acertos: [], Orcamento: [], Atividades: [], Lugares: []
  };
  const r = N.N_calcular(d, V, {});
  assert.strictEqual(r.familia['FAM-aaaaaa-0001'].saldo, 5000);
  assert.strictEqual(r.familia['FAM-aaaaaa-0002'].saldo, -5000);
  assert.deepStrictEqual(r.transferencias.map(t => t.valor), [5000]);
});
