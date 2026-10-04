/* app-push.js — notificações no celular (Web Push pelo Firebase Cloud Messaging).
   O servidor decide QUANDO avisar; aqui o aparelho só pede permissão, obtém o endereço (token) e escolhe os tipos.
   No iPhone, só funciona com o app instalado na tela de início (iOS 16.4 ou mais novo). */

const FIREBASE_VERSAO = '10.14.1';
const PUSH = { cfg: null, carregando: false, erro: null };

function pushSuportado() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function plataformaPush() { return IOS ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'computador'; }
function pushTiposLocais() { return (lsGet('pushTipos') || 'proxima,lembretes,contas,decisoes,resumo').split(',').filter(Boolean); }

function carregarPushConfig() {
  if (PUSH.cfg || PUSH.carregando || !navigator.onLine || !S.sessao) return;
  PUSH.carregando = true;
  api('pushConfig', {}).then(c => { PUSH.cfg = c; PUSH.erro = null; })
    .catch(e => { PUSH.erro = e.message; })
    .finally(() => { PUSH.carregando = false; if (rotaAtual().nome === 'perfil') render(true); });
}

function carregarScriptUnico(src) {
  _scripts[src] = _scripts[src] || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete _scripts[src]; rej(new Error('Sem internet para ativar as notificações.')); };
    document.head.appendChild(s);
  });
  return _scripts[src];
}

/** Obtém o token do Firebase usando o service worker do próprio app (que já sabe mostrar as notificações). */
async function tokenFirebase(cfg) {
  const base = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSAO + '/';
  if (!window.firebase) await carregarScriptUnico(CFG.firebaseAppJs || base + 'firebase-app-compat.js');
  if (!window.firebase.messaging) await carregarScriptUnico(CFG.firebaseMessagingJs || base + 'firebase-messaging-compat.js');
  if (!firebase.apps.length) firebase.initializeApp(cfg.webConfig);
  const reg = await navigator.serviceWorker.ready;
  return firebase.messaging().getToken({ vapidKey: cfg.vapidKey, serviceWorkerRegistration: reg });
}

AC['push-ativar'] = async () => {
  if (!pushSuportado()) { toast(IOS ? 'No iPhone, instale o app na tela de início para receber notificações.' : 'Este navegador não recebe notificações.', { ms: 7000 }); return; }
  // O pedido de permissão precisa ser a primeira coisa depois do toque (exigência do iPhone)
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Sem permissão, o app não consegue avisar. Dá para liberar depois nos ajustes do aparelho.', { ms: 8000 }); render(true); return; }
  toast('Ativando notificações…');
  const cfg = PUSH.cfg || await api('pushConfig', {});
  PUSH.cfg = cfg;
  if (!cfg.ativo) throw erroApp('O organizador ainda não configurou as notificações no servidor.', 'CONFIG');
  const tok = await tokenFirebase(cfg);
  if (!tok) throw erroApp('O aparelho não devolveu o endereço de notificação. Tente de novo.', 'EXTERNO');
  const r = await api('registrarPush', { token_push: tok, plataforma: plataformaPush(), tipos: pushTiposLocais() });
  lsSet('pushToken', tok); lsSet('pushTipos', r.tipos.join(',')); lsSet('pushVerif', isoLocal(new Date()));
  toast('Notificações ativadas neste aparelho.', { acao: 'Testar', fn: () => AC['push-teste']() });
  render(true);
};

AC['push-tipo'] = async el => {
  const tok = lsGet('pushToken'); if (!tok) return;
  const t = el.dataset.t;
  const atuais = pushTiposLocais();
  const novos = el.checked ? atuais.concat(atuais.includes(t) ? [] : [t]) : atuais.filter(x => x !== t);
  lsSet('pushTipos', novos.join(','));
  render(true);
  try { await api('preferenciasPush', { token_push: tok, tipos: novos }); }
  catch (e) { lsSet('pushTipos', atuais.join(',')); render(true); throw e; }
};

AC['push-teste'] = async () => {
  const tok = lsGet('pushToken'); if (!tok) return;
  await api('testarPush', { token_push: tok });
  toast('Enviado. A notificação deve chegar em alguns segundos.');
};

AC['push-desligar'] = async () => {
  const tok = lsGet('pushToken');
  if (tok) { try { await api('removerPush', { token_push: tok }); } catch (e) { /* desliga localmente mesmo assim */ } }
  try { if (window.firebase && firebase.apps.length) await firebase.messaging().deleteToken(); } catch (e) { /* ok */ }
  lsSet('pushToken', null); lsSet('pushVerif', null);
  toast('Notificações desligadas neste aparelho.');
  render(true);
};

/** Bloco da tela Ajustes. */
function secaoPush() {
  const tok = lsGet('pushToken');
  let corpo;
  if (!pushSuportado()) {
    corpo = IOS && !INSTALADO
      ? `<p class="peq">No iPhone, as notificações só funcionam com o app <b>instalado na tela de início</b> (iOS 16.4 ou mais novo).</p><button class="btn" data-a="como-instalar">Como instalar</button>`
      : '<p class="peq">Este navegador não recebe notificações. No Android, use o Chrome; no computador, Chrome, Edge ou Safari.</p>';
  } else if (Notification.permission === 'denied') {
    corpo = `<p class="peq">As notificações estão bloqueadas para o Rumo neste aparelho. ${IOS ? 'Libere em <b>Ajustes do iPhone → Notificações → Rumo</b>.' : 'Libere nas configurações do site/app (cadeado ao lado do endereço ou Configurações → Apps → Rumo → Notificações).'}</p>`;
  } else if (tok && Notification.permission === 'granted') {
    const tipos = pushTiposLocais();
    const nomes = (PUSH.cfg && PUSH.cfg.tipos) || { proxima: 'Próxima atividade (30 min antes)', lembretes: 'Prazos de tarefas, cancelamento e pagamento', contas: 'Despesas lançadas por outras pessoas', decisoes: 'Novas votações', resumo: 'Resumo da manhã durante a viagem' };
    corpo = `<p class="peq" style="margin-top:0"><span class="etiqueta ok">ativas</span> neste aparelho. Escolha o que quer receber:</p>
      ${Object.keys(nomes).map(k => `<label class="check"><input type="checkbox" data-a="push-tipo" data-t="${k}" ${tipos.includes(k) ? 'checked' : ''}><span>${esc(nomes[k])}</span></label>`).join('')}
      <div class="botoes" style="margin-top:8px"><button class="btn" data-a="push-teste">Enviar um teste</button><button class="btn perigo" data-a="push-desligar">Desligar aqui</button></div>`;
  } else if (!navigator.onLine) {
    corpo = '<p class="peq">Conecte-se à internet para ativar as notificações.</p>';
  } else if (!PUSH.cfg) {
    carregarPushConfig();
    corpo = PUSH.erro ? `<p class="peq">${esc(PUSH.erro)}</p>` : '<div class="esq" style="height:44px"></div>';
  } else if (!PUSH.cfg.ativo) {
    corpo = `<p class="peq">As notificações ainda não foram ligadas no servidor.${souOrg() ? ' Veja "Notificações no celular" no guia de implantação (uns 15 minutos, uma vez só).' : ' Peça ao organizador.'}</p>`;
  } else {
    corpo = `<p class="peq" style="margin-top:0">Receba no celular: próxima atividade, prazos, despesas lançadas pelos outros, votações e o resumo da manhã. Você escolhe quais depois.</p>
      <button class="btn prim" data-a="push-ativar">🔔 Ativar notificações</button>`;
  }
  return `<div class="rotulo">Notificações no celular</div><div class="cartao">${corpo}</div>`;
}

/** Uma vez por dia: confirma o token (o Firebase pode trocá-lo) ou limpa se a permissão foi retirada. */
async function revisarPush() {
  const tok = lsGet('pushToken');
  if (!tok || !S.sessao || !navigator.onLine || !pushSuportado()) return;
  if (Notification.permission !== 'granted') { try { await api('removerPush', { token_push: tok }); } catch (e) { /* ok */ } lsSet('pushToken', null); return; }
  const hojeIso = isoLocal(new Date());
  if (lsGet('pushVerif') === hojeIso) return;
  try {
    const cfg = PUSH.cfg || await api('pushConfig', {});
    PUSH.cfg = cfg;
    if (!cfg.ativo) return;
    const novo = await tokenFirebase(cfg);
    if (novo && novo !== tok) { try { await api('removerPush', { token_push: tok }); } catch (e) { /* ok */ } }
    const r = await api('registrarPush', { token_push: novo || tok, plataforma: plataformaPush(), tipos: pushTiposLocais() });
    lsSet('pushToken', novo || tok); lsSet('pushTipos', r.tipos.join(',')); lsSet('pushVerif', hojeIso);
  } catch (e) { /* tenta de novo na próxima abertura */ }
}

/* Tocar numa notificação abre o app na tela certa (o service worker avisa qual) */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.ir) { location.hash = String(e.data.ir).replace(/^#?/, '#'); } });
}
