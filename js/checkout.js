/*
  CHECKOUT PROPIO — Halls of Amenti
  Pago dentro del sitio, sin redirigir a otra tienda:
    · PayPal / tarjeta (SDK de PayPal, ventana emergente, cobra en USD)
    · Transferencia bancaria (cobra en CLP, el cliente envía el comprobante por correo)
  Configuración: js/config.js
*/
(() => {
'use strict';
const S = window.HOA_STORE, C = window.HOA_CONFIG;
const form = document.getElementById('order-form');
if (!S || !C || !form) return;
const $ = s => document.querySelector(s);
const e = S.esc, demo = S.demo;

/* ---------- Configuración (en modo prueba se usan datos ficticios) ---------- */
const DEMO_CFG = {
  paypal: { clientId: 'demo' },
  transfer: { holder: 'Titular de prueba', rut: '11.111.111-1', bank: 'Banco de prueba', accountType: 'Cuenta corriente', accountNumber: '000000000', clpPerUsd: null },
  zones: [
    { id: 'chile', label: 'Chile', countries: ['CL'], usd: 4, clp: 3500, extraUsd: 1, extraClp: 900 },
    { id: 'latam', label: 'Latinoamérica', countries: ['AR', 'BR', 'MX', 'PE'], usd: 15, clp: 13000, extraUsd: 4, extraClp: 3500 },
    { id: 'mundo', label: 'Resto del mundo', countries: ['*'], usd: 20, clp: 18000, extraUsd: 5, extraClp: 4500 }
  ]
};
const PP = demo ? DEMO_CFG.paypal : {clientId:''};
let backendReady=false, backendEnvironment='sandbox';
let attempt=null;
try { attempt=JSON.parse(sessionStorage.getItem('hoa-payment-attempt')); } catch {}
const remember=()=>{try{sessionStorage.setItem('hoa-payment-attempt',JSON.stringify(attempt));}catch{}};
async function api(path,body){const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await response.json();if(!response.ok){const error=new Error(result.error||'No se pudo confirmar la operación');error.code=result.code;throw error;}return result;}
const TR = demo ? DEMO_CFG.transfer : ((C.payments && C.payments.transfer) || {});
const ZONES = demo ? DEMO_CFG.zones : ((C.shipping && C.shipping.zones) || []);
const RATE = Number.isFinite(TR.clpPerUsd) && TR.clpPerUsd > 0 ? TR.clpPerUsd : null;
const STORE_KEY = demo ? 'hoa-demo-last-order' : 'hoa-last-order';

/* ---------- Países (código ISO → nombre en español del navegador) ---------- */
const CODES = 'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' ');
let regionNames = null;
try { regionNames = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (_) {}
const countryName = c => { try { return (regionNames && regionNames.of(c)) || c; } catch (_) { return c; } };
(() => {
  const sel = $('#country');
  const list = CODES.map(c => ({ c, n: countryName(c) })).sort((a, b) => (a.c === 'CL' ? -1 : b.c === 'CL' ? 1 : window.HOA_I18N.t(a.n).localeCompare(window.HOA_I18N.t(b.n), window.HOA_I18N.lang)));
  sel.insertAdjacentHTML('beforeend', list.map(x => '<option value="' + x.c + '">' + e(x.n) + '</option>').join(''));
})();

document.addEventListener('hoa:language',()=>{const sel=$('#country'),value=sel.value;const options=[...sel.options].filter(o=>o.value);options.sort((a,b)=>a.value==='CL'?-1:b.value==='CL'?1:a.textContent.localeCompare(b.textContent,window.HOA_I18N.lang));for(const o of options)sel.append(o);sel.value=value;});
/* ---------- Formato y utilidades ---------- */
const fmt = (cur, n) => cur === 'USD' ? S.money(n / 100) : S.clp(n);   // USD en centavos, CLP en pesos
const state = { method: null, panelKey: '', done: null, contact: null };
const field = k => String(new FormData(form).get(k) || '').trim();
const data = () => ({ name: field('name'), email: field('email'), phone: field('phone'), country: field('country'), region: field('region'), city: field('city'), address: field('address'), postal: field('postal'), notes: field('notes') });
const setStatus = (text, bad) => { const el = $('#order-status'); el.textContent = text || ''; el.classList.toggle('err', !!bad); };
function newRef() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = new Uint8Array(4);
  crypto.getRandomValues(b);
  const d = new Date(), ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  return (demo ? 'PRUEBA' : 'HOA') + '-' + ymd + '-' + [...b].map(x => abc[x % 32]).join('');
}

/* ---------- Precios y envío ---------- */
const num = v => (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null;
const clpUnit = p => Number.isSafeInteger(p.priceCLP) ? p.priceCLP : (RATE && p.price !== null ? Math.round(p.price * RATE) : null);
const zoneFor = code => !code ? null : (ZONES.find(z => z.countries.includes(code)) || ZONES.find(z => z.countries.includes('*')) || null);
function quote(code) {
  const rows = S.rows(), units = rows.reduce((n, r) => n + r.q, 0), zone = zoneFor(code);
  const usdSub = S.cents();
  const clpUnits = rows.map(({ p, q }) => { const u = clpUnit(p); return u === null ? null : u * q; });
  const clpSub = clpUnits.every(v => v !== null) ? clpUnits.reduce((a, b) => a + b, 0) : null;
  let usdShip = null, clpShip = null;
  if (zone) {
    const extra = Math.max(0, units - 1);
    if (num(zone.usd) !== null) usdShip = Math.round((zone.usd + (num(zone.extraUsd) || 0) * extra) * 100);
    if (num(zone.clp) !== null) clpShip = Math.round(zone.clp + (num(zone.extraClp) || 0) * extra);
    else if (RATE && usdShip !== null) clpShip = Math.round(usdShip / 100 * RATE);
  }
  return {
    zone, units,
    usd: { sub: usdSub, ship: usdShip, total: usdShip === null ? null : usdSub + usdShip },
    clp: { sub: clpSub, ship: clpShip, total: (clpSub === null || clpShip === null) ? null : clpSub + clpShip }
  };
}
function methods(q) {
  const out = [];
  const ppReady = demo || backendReady;
  const trReady = demo || !!(TR.holder && TR.bank && TR.accountNumber);
  if (ppReady) out.push({ id: 'paypal', ok: q.usd.total !== null, why: 'El envío a este destino está por cotizar.' });
  if (trReady) out.push({ id: 'transfer', ok: q.clp.total !== null, why: q.clp.sub === null ? 'Disponible cuando todos los productos del carrito tienen precio en CLP. Consúltanos por correo.' : 'El envío a este destino está por cotizar.' });
  return out;
}

/* ---------- Textos de correo / comprobante ---------- */
const lineText = ({ p, q }) => q + ' × ' + p.artist + ' — ' + p.title + ' (' + p.format + '; ' + (p.label || '') + ') [' + p.id + '] — ' + S.money(Math.round(p.price * 100) * q / 100);
const contactLines = f => [
  'Nombre: ' + f.name, 'Correo: ' + f.email, 'Teléfono: ' + (f.phone || 'No indicado'),
  'Destino: ' + [f.address, f.city, f.region, f.postal, countryName(f.country)].join(', '),
  'Comentarios: ' + (f.notes || 'Sin comentarios')
];
function requestText(f) {
  return [(demo ? 'PRUEBA — NO ES UN PEDIDO REAL\n' : '') + 'Hola, quisiera cotizar el envío y coordinar este pedido:', '',
    ...S.rows().map(lineText), '', 'Subtotal USD: ' + S.money(S.cents() / 100), '', ...contactLines(f), '',
    'Quedo atento/a a la cotización del envío y al total final.'].join('\n');
}
function receiptText(r) {
  const fm = n => fmt(r.currency, n);
  return [
    (r.demo ? 'PRUEBA — NO ES UN PEDIDO REAL\n' : '') + (r.method === 'paypal' ? 'Pedido ' + r.ref + (r.status==='COMPLETED'?' — pagado con PayPal':' — pago pendiente en PayPal') : 'Pedido ' + r.ref + ' — transferencia bancaria (comprobante adjunto)'), '',
    ...r.lines.map(l => l.qty + ' × ' + l.name + ' (' + l.format + '; ' + l.label + ') [' + l.sku + '] — ' + fm(l.unit * l.qty)), '',
    'Subtotal: ' + fm(r.subtotal), 'Envío (' + r.zone + '): ' + fm(r.shipping), 'Total: ' + fm(r.total),
    r.txId ? 'ID de transacción PayPal: ' + r.txId : null,
    ...(state.contact ? ['', ...contactLines(state.contact)] : [])
  ].filter(x => x !== null).join('\n');
}

/* ---------- Recibo del pedido ---------- */
function makeReceipt(method, q, f, extra) {
  const cur = method === 'transfer' ? 'CLP' : 'USD', t = cur === 'USD' ? q.usd : q.clp;
  return Object.assign({
    ref: newRef(), method, currency: cur, demo,
    lines: S.rows().map(({ p, q: qty }) => ({ qty, name: p.artist + ' — ' + p.title, format: p.format, label: p.label || '', sku: p.id, unit: cur === 'USD' ? Math.round(p.price * 100) : clpUnit(p) })),
    subtotal: t.sub, shipping: t.ship, total: t.total, zone: q.zone.label + (q.zone.eta ? ' · ' + q.zone.eta : ''), country: countryName(f.country), created: new Date().toISOString()
  }, extra || {});
}
function finish(r, contact) {
  state.done = r; state.contact = contact || null;
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(r)); } catch (_) {}
  if (r.lines) S.removePurchased(r.lines); else S.clearCart();
  render();
  window.scrollTo({ top: 0 });
  $('#order-done').focus();
}
function loadSaved() {
  try {
    const r = JSON.parse(sessionStorage.getItem(STORE_KEY));
    if (r && typeof r.ref === 'string' && (r.currency === 'USD' || r.currency === 'CLP') && Array.isArray(r.lines) && Number.isFinite(r.total) && Number.isFinite(r.subtotal) && Number.isFinite(r.shipping)) return r;
  } catch (_) {}
  return null;
}

/* ---------- PayPal ---------- */
let sdk = null;
function loadPayPal() {
  if (window.paypal && window.paypal.Buttons) return Promise.resolve(window.paypal);
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.paypal.com/sdk/js?client-id=' + encodeURIComponent(PP.clientId) + '&currency=USD&intent=capture&components=buttons&enable-funding=card&disable-funding=paylater,venmo&locale='+ (window.HOA_I18N.lang==='en'?'en_US':'es_ES');
    s.onload = () => window.paypal && window.paypal.Buttons ? resolve(window.paypal) : reject(new Error('sdk'));
    s.onerror = () => { sdk = null; reject(new Error('sdk')); };
    document.head.appendChild(s);
  });
  return sdk;
}
function setBusy(busy){form.querySelectorAll('input,select').forEach(el=>el.disabled=busy);}
function acceptReceipt(r){
  if(!r || !['COMPLETED','PENDING'].includes(r.status)){setStatus('El pago todavía no está confirmado. Consulta su estado antes de reintentar.',true);showRecovery();return;}
  if(state.done?.ref===r.ref){state.done=r;render();return;}
  const contactInfo=data();finish(r,contactInfo);attempt=null;remember();
}
function showRecovery(){const area=$('#pay-area');if(!area||!attempt?.orderId)return;let box=$('#recover-payment');if(!box){box=document.createElement('div');box.id='recover-payment';box.className='notice';area.prepend(box);}box.innerHTML='<p>Hay una operación iniciada. Revisa su estado antes de volver a pagar.</p><button type="button" class="btn" id="recover-payment-button">Consultar estado del pago</button><button type="button" class="text-button" id="cancel-payment-attempt">Cancelar pedido sin pago y editar carrito</button>';box.querySelector('button').onclick=async()=>{try{const result=await api('/api/orders/'+encodeURIComponent(attempt.orderId));acceptReceipt(result.receipt);}catch(err){setStatus(err.message,true);}};box.querySelector('#cancel-payment-attempt').onclick=async()=>{try{await api('/api/orders/'+encodeURIComponent(attempt.orderId)+'/cancel',{});attempt=null;remember();box.remove();setStatus('Pedido sin pago cancelado. Puedes editar el carrito.');}catch(err){setStatus(err.message,true);}};}
function mountPayPal() {
  const box=$('#paypal-buttons');if(!box)return;
  if(demo){box.innerHTML='<button type="button" class="btn solid" id="demo-pay">Simular pago con PayPal (prueba)</button><p class="note">Modo de prueba: no se realiza ningún cobro.</p>';return;}
  box.innerHTML='<p class="note">Cargando PayPal…</p>';
  loadPayPal().then(paypal=>{if(!document.body.contains(box))return;box.innerHTML='';return paypal.Buttons({
    style:{layout:'vertical',color:'gold',shape:'rect',label:'pay',height:46},
    onClick:(_d,actions)=>S.validate(form)?actions.resolve():actions.reject(),
    createOrder:async()=>{
      const contactInfo=data(),items=S.rows().map(({p,q})=>({id:p.id,quantity:q}));
      const encoded=new TextEncoder().encode(JSON.stringify({items,contact:contactInfo}));
      const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))).map(x=>x.toString(16).padStart(2,'0')).join('');
      if(attempt?.orderId && attempt.signature!==signature){throw new Error('Hay un pago anterior iniciado. Consulta su estado antes de cambiar el pedido.');}
      if(!attempt || attempt.signature!==signature)attempt={signature,requestKey:crypto.randomUUID()};
      remember();setBusy(true);setStatus('Creando pedido seguro…');
      try{const result=await api('/api/orders',{items,contact:contactInfo,requestKey:attempt.requestKey,expectedTotal:quote(contactInfo.country).usd.total});attempt.orderId=result.id;remember();setStatus('Confirma el pago en la ventana de PayPal');return result.id;}
      catch(err){setBusy(false);if(err.code==='ORDER_EXPIRED'){attempt=null;remember();}setStatus(err.message,true);throw err;}
    },
    onApprove:async(d,actions)=>{
      try{setStatus('Confirmando el pago con PayPal…');const result=await api('/api/orders/'+encodeURIComponent(d.orderID)+'/capture',{});setBusy(false);acceptReceipt(result.receipt);}
      catch(err){setBusy(false);setStatus(err.message,true);showRecovery();if(err.code==='INSTRUMENT_DECLINED')return actions.restart();}
    },
    onCancel:()=>{setBusy(false);attempt=null;remember();setStatus('Cancelaste la autorización. Tu carrito se conserva.');},
    onError:err=>{setBusy(false);setStatus(err?.message||'No se pudo confirmar el pago. Consulta su estado antes de volver a pagar.',true);showRecovery();}
  }).render(box);}).catch(()=>{if(document.body.contains(box))box.innerHTML='<p class="err">No se pudo cargar PayPal. Revisa tu conexión y vuelve a intentarlo.</p>';});
}

/* ---------- Render: panel de pago ---------- */
function bankHtml() {
  const rows = [['Titular', TR.holder], ['RUT', TR.rut], ['Banco', TR.bank], ['Tipo de cuenta', TR.accountType], ['N.º de cuenta', TR.accountNumber], ['Correo para el comprobante', C.email]].filter(r => r[1]);
  return '<dl class="bank">' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + e(r[1]) + '</dd>').join('') + '</dl>';
}
function renderPay() {
  const box = $('#pay-area'), f = data(), q = quote(f.country);
  let key, html = '';
  if (!f.country) {
    state.method = null; key = 'nocountry';
    html = '<p class="note">Selecciona tu país de destino para calcular el envío y ver los métodos de pago disponibles.</p>';
  } else if (!q.zone) {
    state.method = null; key = 'nozone';
    html = '<p class="note">Aún no hay envíos configurados para este destino. <button type="button" class="text-button" data-act="quote">Solicitar cotización por correo</button></p>';
  } else {
    const ms = methods(q), ok = ms.filter(m => m.ok);
    if (!ok.some(m => m.id === state.method)) state.method = ok.length ? ok[0].id : null;
    key = ['pay', q.zone.id, state.method, ...ms.map(m => m.ok ? 1 : 0)].join(':');
    if (!ok.length) {
      html = '<div class="pay-panel"><p>' + (ms.length ? e(ms[0].why) : 'El pago en línea no está disponible por ahora.') + ' Escríbenos y te cotizamos el envío y el total final.</p><button type="button" class="btn solid" data-act="quote">Solicitar cotización por correo</button></div>';
    } else {
      const label = { paypal: ['PayPal o tarjeta', 'Cuenta PayPal y, cuando esté disponible, tarjeta de crédito/débito. Se cobra en USD.'], transfer: ['Transferencia bancaria', 'Desde un banco en Chile. Se cobra en CLP.'] };
      html = '<div class="pay-methods" role="radiogroup" aria-label="Método de pago">' + ms.map(m => '<label class="pay-option' + (m.ok ? '' : ' disabled') + '"><input type="radio" name="method" value="' + m.id + '"' + (state.method === m.id ? ' checked' : '') + (m.ok ? '' : ' disabled') + '><span><strong>' + label[m.id][0] + '</strong><small>' + (m.ok ? label[m.id][1] : e(m.why)) + '</small></span></label>').join('') + '</div>';
      if (state.method === 'paypal') html += '<div class="pay-panel"><div id="paypal-buttons"></div><p class="note">Se abrirá la ventana segura de PayPal para pagar sin salir de esta página.</p></div>';
      if (state.method === 'transfer') html += '<div class="pay-panel">' + (demo ? '<p class="note">Datos de prueba.</p>' : '') + '<p>Al confirmar verás el número de pedido y los datos para transferir el total exacto.</p>' + bankHtml() + '<button type="button" class="btn solid" data-act="transfer">Confirmar pedido por transferencia</button></div>';
    }
    html += '<p><button type="button" class="text-button" data-act="quote">¿Prefieres coordinar por correo? Solicitar cotización</button></p>';
  }
  if (key === state.panelKey) return;
  state.panelKey = key;
  box.innerHTML = html;
  if (state.method === 'paypal' && $('#paypal-buttons')) mountPayPal();
  if(!demo)showRecovery();
}

/* ---------- Render: resumen ---------- */
function renderSummary() {
  const rows = S.rows(), f = data(), q = quote(f.country);
  const cur = state.method === 'transfer' ? 'CLP' : 'USD', t = cur === 'USD' ? q.usd : q.clp;
  const line = (a, b, cls) => '<div class="total ' + (cls || '') + '"><span>' + a + '</span><strong>' + b + '</strong></div>';
  let totals = line('Subtotal ' + cur, t.sub === null ? 'Por confirmar' : fmt(cur, t.sub));
  totals += !q.zone ? line('Envío', 'Elige tu país') : line('Envío · ' + e(q.zone.label) + (q.zone.eta ? '<br><small>Tránsito estimado: ' + e(q.zone.eta) + '</small>' : ''), t.ship === null ? 'Por cotizar' : fmt(cur, t.ship));
  totals += line('Total a pagar', (t.sub === null || t.ship === null) ? '—' : fmt(cur, t.sub + t.ship), 'grand');
  $('#order-summary').innerHTML = '<h2>Resumen</h2><ul class="summary-list">' + rows.map(({ p, q: qty }) => '<li>' + qty + ' × ' + e(p.artist) + ' — ' + e(p.title) + '<br>' + e(p.format) + ' · ' + e(p.label || '') + '<span>' + S.priceLabel(p, qty) + '</span></li>').join('') + '</ul>' + totals +
    '<p class="note">USD y CLP son alternativas de precio, no se suman. El total final depende del método de pago elegido.</p><a class="back" href="' + S.href('carrito.html') + '">Modificar carrito</a>';
}

/* ---------- Render: confirmación ---------- */
function renderDone(r) {
  const fm = n => fmt(r.currency, n), paypal = r.method === 'paypal';
  const lines = r.lines.map(l => '<li>' + Number(l.qty) + ' × ' + e(l.name) + '<br>' + e(l.format) + ' · ' + e(l.label) + '<span>' + fm(Number(l.unit) * Number(l.qty)) + '</span></li>').join('');
  let body;
  if (paypal) {
    body = '<h2>' + (r.demo ? (demo ? 'Pago simulado — prueba' : 'Pago de prueba — PayPal Sandbox') : r.status === 'COMPLETED' ? 'Pago recibido' : 'Pago pendiente de confirmación') + '</h2><p>Tu número de pedido es <strong>' + e(r.ref) + '</strong>.</p>' +
      (String(r.status).toUpperCase() === 'PENDING' ? '<p class="notice">PayPal indica que el pago está pendiente de aprobación. Te avisará por correo cuando se complete.</p>' : '') +
      (r.txId ? '<p class="note">ID de transacción PayPal: ' + e(r.txId) + '</p>' : '') +
      '<p>Consulta el estado de la operación en PayPal. El envío se prepara una vez confirmado el pago y la disponibilidad. Destino: ' + e(r.country) + ' y te escribiremos si necesitamos confirmar algo, por ejemplo la disponibilidad de algún artículo.</p>';
  } else {
    body = '<h2>Pedido preparado — falta enviar el comprobante</h2><p>Tu número de pedido es <strong>' + e(r.ref) + '</strong>. Úsalo como glosa o comentario de la transferencia.</p>' +
      '<p class="notice">Tu pedido queda confirmado cuando recibamos el comprobante y verifiquemos el pago. Hasta entonces no se reservan unidades.</p>' +
      '<h3>Transfiere ' + fm(r.total) + '</h3>' + (r.demo ? '<p class="note">Datos de prueba.</p>' : '') + bankHtml() +
      '<ol class="steps"><li><p>Transfiere el total exacto indicando tu número de pedido.</p></li><li><p>Envíanos el comprobante a <strong>' + e(C.email) + '</strong> con el botón de abajo (adjunta la imagen o PDF del comprobante).</p></li><li><p>Te confirmaremos y despacharemos tu pedido.</p></li></ol>' +
      '<div class="stack"><button type="button" class="btn solid" data-done="mail">Enviar comprobante por correo</button><button type="button" class="btn" data-done="copy">Copiar mensaje del pedido</button></div>';
  }
  $('#order-done').innerHTML = body + '<h3>Detalle</h3><ul class="summary-list">' + lines + '</ul>' +
    '<div class="total"><span>Subtotal</span><strong>' + fm(r.subtotal) + '</strong></div><div class="total"><span>Envío · ' + e(r.zone) + '</span><strong>' + fm(r.shipping) + '</strong></div><div class="total grand"><span>Total</span><strong>' + fm(r.total) + '</strong></div>' +
    (r.status==='PENDING'&&r.orderId?'<button class="btn" type="button" data-done="refresh">Actualizar estado del pago</button>':'') + '<p id="done-status" role="status"></p><div id="done-manual" hidden><label for="done-text">Copia este mensaje</label><textarea id="done-text" rows="9" readonly></textarea></div>' +
    '<div class="buttons left"><button type="button" class="btn" data-done="download">Descargar resumen</button><a class="btn" href="' + S.href('catalogo.html') + '">Seguir explorando</a></div>';
}

function render() {
  const has = S.rows().length > 0, done = state.done;
  $('#order-done').hidden = !done;
  $('#order-layout').hidden = !!done || !has;
  $('#order-empty').hidden = !!done || has;
  $('#back-cart').hidden = !!done;
  if (done) { renderDone(done); return; }
  if (!has) return;
  renderPay();
  renderSummary();
}

/* ---------- Eventos ---------- */
form.addEventListener('submit', ev => ev.preventDefault());
form.addEventListener('input', render);
form.addEventListener('change', ev => {
  const m = ev.target.closest && ev.target.closest('input[name="method"]');
  if (m) {
    state.method = m.value; state.panelKey = ''; setStatus('');
    render();
    const checked = form.querySelector('input[name="method"]:checked');
    if (checked) checked.focus();
    return;
  }
  render();
});
form.addEventListener('click', ev => {
  const b = ev.target.closest('[data-act],#demo-pay');
  if (!b) return;
  if (b.id === 'demo-pay' || b.dataset.act === 'transfer' || b.dataset.act === 'quote') setStatus('');
  if (b.id === 'demo-pay') {
    if (!S.validate(form)) return;
    const f = data(), q = quote(f.country);
    if (q.usd.total === null) return;
    finish(makeReceipt('paypal', q, f, { txId: 'DEMO-' + newRef().slice(-4), status: 'COMPLETED' }), f);
    return;
  }
  if (b.dataset.act === 'transfer') {
    if (!S.validate(form)) return;
    const f = data(), q = quote(f.country);
    if (!q.zone || q.clp.total === null) { setStatus('No pudimos calcular el total en CLP para este destino. Solicita una cotización por correo.', true); return; }
    finish(makeReceipt('transfer', q, f), f);
    return;
  }
  if (b.dataset.act === 'quote') {
    if (!S.validate(form)) return;
    S.openMail('Cotización de pedido · Halls of Amenti', requestText(data()), '#order-status', '#manual-copy', '#manual-text');
  }
});
$('#order-done').addEventListener('click', ev => {
  const b = ev.target.closest('[data-done]'), r = state.done;
  if (!b || !r) return;
  if(b.dataset.done==='refresh'){api('/api/orders/'+encodeURIComponent(r.orderId)).then(x=>{state.done=x.receipt;try{sessionStorage.setItem(STORE_KEY,JSON.stringify(x.receipt));}catch{}render();}).catch(err=>{$('#done-status').textContent=err.message;});return;}
  const text = window.HOA_I18N.t(receiptText(r));
  if (b.dataset.done === 'mail') S.openMail('Comprobante de transferencia · Pedido ' + r.ref, text, '#done-status', '#done-manual', '#done-text');
  if (b.dataset.done === 'copy') S.copy(text, '#done-status', '#done-manual', '#done-text');
  if (b.dataset.done === 'download') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'pedido-' + r.ref + '.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#done-status').textContent = 'Resumen descargado.';
  }
});
document.addEventListener('hoa:cart', () => {
  if (state.done) return;
  render();
});

/* ---------- Inicio ---------- */
if (!S.rows().length) state.done = loadSaved();
render();
if(!demo){api('/api/config').then(cfg=>{backendReady=cfg.ready;backendEnvironment=cfg.environment;PP.clientId=cfg.clientId;state.panelKey='';render();if(backendReady&&backendEnvironment==='sandbox'){const n=document.createElement('p');n.className='notice';n.textContent='PayPal Sandbox — esta tienda está en modo de prueba, no se cobran pagos reales.';form.prepend(n);}if(attempt?.orderId)showRecovery();}).catch(()=>setStatus('El pago requiere que la página esté instalada con su servidor. Contacta a la tienda para coordinar el pedido.',true));}
})();
