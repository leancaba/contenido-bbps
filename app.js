/* ============================================================
   CONTENIDO BBPS — sorteo de locales para Reels y Stories
   ============================================================ */

/* ---------- Reglas (fáciles de ajustar) ---------- */
const REGLAS = {
  reel: {
    cantidad: 2,
    bloqueoMeses: 2,          // no repite si salió en los últimos 2 meses
    // true = el segundo local NUNCA es de MODA. false = puede ser otra MODA
    // siempre que respete "distinta categoría" y la regla de MODA UNISEX.
    segundoSinModa: false,
  },
  stories: {
    cantidad: 5,
    bloqueoHoras: 48,         // no repite si salió en las últimas 48 horas
    minimoModa: 3,            // al menos 3 locales de MODA
  },
};
const TZ = 'America/Argentina/Buenos_Aires';
const LOCAL_KEY = 'bbps-contenido';

/* ---------- Locales iniciales ---------- */
const LOCALES_INICIALES = `
47 STREET|MODA ADOLESCENTE
AARON|VARIOS
AL ALBA|MODA HOMBRE
ARTURITO|NIÑO
AY QUE LINDO|DECO
BALLON CITY|VARIOS
BRUTTO PASTIFICIO|GASTRO
CARDON|MODA UNISEX
CAREY JOYERIA|JOYERIA
CASA BIANCA|DECO
CHARLIE CANDY|VARIOS
CHEEKY|NIÑO
CIPRIANO|GASTRO
CITY GIRL|BELLEZA
COVER STORE|VARIOS
DESIDERATA|MODA MUJER
DOJA RAPSODIA|MODA MUJER
EL MUNDO DEL JUGUETE|JUGUETERIA
ESCENCIA DE LOS ARTESANOS|DECO
EVA MILLER|MODA MUJER
FERREIRA SPORT|DEPORTE
GRAN VIA|GASTRO
GRIMOLDI|ZAPATERIA
GRISINO|NIÑO
HAVANNA|GASTRO
HOLLY|BELLEZA
HOMOLUDENS|JUGUETERIA
INFINIT|OPTICA
ISADORA|JOYERIA
JULIEN|MODA MUJER
JUMBALAY|GASTRO
KEVINGSTON|MODA UNISEX
KOSIUKO|MODA MUJER
LACOSTE|MODA UNISEX
LEGACY|MODA HOMBRE
LEMON PIE|ZAPATERIA
LEVIS STORE|MODA UNISEX
LIDHERMA SKIN HOUSE|BELLEZA
LOOT COMICS LOCAL|JUGUETERIA
LOVELY DENIM|MODA MUJER
MADE DECO|DECO
MADISON|GASTRO
MARKOVA|MODA MUJER
MAS QUE PLATA|JOYERIA
MELOCOTON|MODA MUJER
MIMO & CO|NIÑO
MODDE GAMING PRO|VARIOS
MONTAGNE|MODA UNISEX
MUNDO OUTDOOR|MODA UNISEX
OPTICA VENTURA|OPTICA
PAMPERO|MODA UNISEX
PANTHERA|JOYERIA
PARFUMERIE|BELLEZA
PATO PAMPA|MODA UNISEX
PETIT RAINBOW|JUGUETERIA
PORTSAID|MODA MUJER
PRUNE|ZAPATERIA
PUNTO APPLE|VARIOS
QUEEN JUANA|MODA ADOLESCENTE
RAFAEL BERTIN BEAUTY|BELLEZA
RAMIRA|JOYERIA
RAMIRA CHULAS|VARIOS
RISK POINT|DEPORTE
ROUGE|BELLEZA
SACOA|VARIOS
SAMSUNG|VARIOS
SANTA BOHEMIA|MODA MUJER
SANTARELLI|JOYERIA
SAYHUEQUE|VARIOS
SELU|MODA MUJER
SEPTIMO|MODA UNISEX
SESTINA|ZAPATERIA
SOUL COVER|VARIOS
THE COFFEE STORE|GASTRO
THE SKIN STORE|VARIOS
TIJERITAS|VARIOS
TODO MODA|JOYERIA
TUCCI|MODA MUJER
VER|MODA MUJER
XL|ZAPATERIA
YAGMOUR|MODA MUJER
YENNY|VARIOS`.trim().split('\n').map(l => {
  const [nombre, categoria] = l.split('|');
  return { nombre: limpiar(nombre), categoria: limpiar(categoria) };
});

/* ---------- Estado ---------- */
let estado = { locales: [], historial: { reel: [], stories: [] } };
let modo = 'api';
let password = sessionStorage.getItem('bbps-pass') || '';
const actual = { reel: null, stories: null };

/* ---------- Utilidades ---------- */
function limpiar(s) { return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase(); }
function norm(s) { return limpiar(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
const esModa = c => norm(c).includes('MODA');
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function mezclar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatear(fecha) {
  const d = new Date(fecha);
  return {
    fecha: d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: TZ }),
    hora: d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }),
  };
}

function sumarBloqueo(tipo, fecha) {
  const d = new Date(fecha);
  if (tipo === 'reel') d.setMonth(d.getMonth() + REGLAS.reel.bloqueoMeses);
  else d.setTime(d.getTime() + REGLAS.stories.bloqueoHoras * 3600e3);
  return d;
}

/** Nombres (normalizados) que todavía están bloqueados para un tipo */
function bloqueados(tipo) {
  const ahora = new Date();
  const set = new Set();
  for (const e of estado.historial[tipo]) {
    if (sumarBloqueo(tipo, e.fecha) > ahora) e.locales.forEach(l => set.add(norm(l.nombre)));
  }
  return set;
}

function disponibles(tipo) {
  const bloq = bloqueados(tipo);
  return estado.locales.filter(l => !bloq.has(norm(l.nombre)));
}

/* ---------- Sorteos ---------- */
const MODA_ROPA = ['MODA MUJER', 'MODA HOMBRE', 'MODA UNISEX'];

function parReelValido(a, b) {
  const ca = norm(a.categoria), cb = norm(b.categoria);
  if (ca === cb) return false;                                   // nunca misma categoría
  if (!esModa(ca) && !esModa(cb)) return false;                  // al menos uno de MODA
  if (REGLAS.reel.segundoSinModa && esModa(ca) && esModa(cb)) return false;
  if (ca === 'MODA UNISEX' && MODA_ROPA.includes(cb)) return false; // regla UNISEX
  if (cb === 'MODA UNISEX' && MODA_ROPA.includes(ca)) return false;
  return true;
}

function sortearReel() {
  const disp = disponibles('reel');
  const pares = [];
  for (let i = 0; i < disp.length; i++)
    for (let j = i + 1; j < disp.length; j++)
      if (parReelValido(disp[i], disp[j])) pares.push([disp[i], disp[j]]);

  if (!pares.length) {
    const moda = disp.filter(l => esModa(l.categoria)).length;
    throw new Error(moda
      ? 'No hay combinaciones posibles: faltan locales de otras categorías disponibles.'
      : 'No quedan locales de MODA disponibles para Reel (todos salieron en los últimos 2 meses).');
  }
  const par = pares[Math.floor(Math.random() * pares.length)];
  return par.sort((x, y) => esModa(y.categoria) - esModa(x.categoria)); // MODA primero
}

function sortearStories() {
  const { cantidad, minimoModa } = REGLAS.stories;
  const disp = mezclar(disponibles('stories'));
  const moda = disp.filter(l => esModa(l.categoria));
  if (moda.length < minimoModa)
    throw new Error(`Solo hay ${moda.length} locales de MODA disponibles para Stories (se necesitan ${minimoModa}).`);
  if (disp.length < cantidad)
    throw new Error(`Solo hay ${disp.length} locales disponibles para Stories (se necesitan ${cantidad}).`);

  const elegidos = moda.slice(0, minimoModa);
  const resto = disp.filter(l => !elegidos.includes(l));
  elegidos.push(...resto.slice(0, cantidad - minimoModa));
  return elegidos.sort((x, y) => esModa(y.categoria) - esModa(x.categoria));
}

/* ---------- Persistencia ---------- */
function semilla() {
  return { locales: LOCALES_INICIALES.map(l => ({ ...l })), historial: { reel: [], stories: [] } };
}

function sanear(d) {
  const locales = Array.isArray(d && d.locales) ? d.locales : [];
  const h = (d && d.historial) || {};
  return {
    locales: locales.map(l => ({ nombre: limpiar(l.nombre), categoria: limpiar(l.categoria) })).filter(l => l.nombre && l.categoria),
    historial: {
      reel: Array.isArray(h.reel) ? h.reel : [],
      stories: Array.isArray(h.stories) ? h.stories : [],
    },
  };
}

const headers = () => ({ 'Content-Type': 'application/json', ...(password ? { 'x-app-password': password } : {}) });

async function cargar() {
  let r;
  try {
    r = await fetch('api/data', { headers: headers(), cache: 'no-store' });
  } catch {
    return usarModoLocal();
  }
  if (r.status === 404 || r.status === 503) return usarModoLocal();
  if (r.status === 401) { mostrarLogin(!!password); return false; }
  if (!r.ok) throw new Error('No se pudieron leer los datos del servidor.');

  modo = 'api';
  const j = await r.json();
  if (j.data) estado = sanear(j.data);
  else { estado = semilla(); await guardar(); }
  return true;
}

function usarModoLocal() {
  modo = 'local';
  $('#modo').hidden = false;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    estado = raw ? sanear(JSON.parse(raw)) : semilla();
  } catch { estado = semilla(); }
  return true;
}

async function guardar() {
  if (modo === 'local') {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(estado)); } catch {}
    return;
  }
  const r = await fetch('api/data', { method: 'PUT', headers: headers(), body: JSON.stringify(estado) });
  if (r.status === 401) { mostrarLogin(true); throw new Error('Contraseña incorrecta'); }
  if (!r.ok) throw new Error('No se pudo guardar en el servidor.');
}

/* ---------- Render ---------- */
function completo(tipo) {
  const l = actual[tipo];
  return Array.isArray(l) && l.length === REGLAS[tipo].cantidad && l.every(Boolean);
}

function renderSlots(tipo, lista, girando = false) {
  const ul = $(`#slots-${tipo}`);
  const n = REGLAS[tipo].cantidad;
  ul.classList.toggle('girando', girando);
  ul.innerHTML = Array.from({ length: n }, (_, i) => {
    const l = lista && lista[i];
    const attrs = `class="slot${l ? '' : ' vacio'}" type="button" data-accion="elegir" data-tipo="${tipo}" data-index="${i}" ${girando ? 'disabled' : ''}`;
    return l
      ? `<li><button ${attrs} title="Tocá para cambiar este local">${esc(l.nombre)}<small>${esc(l.categoria)}</small></button></li>`
      : `<li><button ${attrs} title="Tocá para elegir un local">—</button></li>`;
  }).join('');
  document.querySelector(`.ok[data-tipo="${tipo}"]`).disabled = !completo(tipo) || girando;
}

/* Elegir / cambiar un local a mano */
function ponerEnSlot(tipo, index, valor) {
  const n = REGLAS[tipo].cantidad;
  const base = Array.isArray(actual[tipo]) ? [...actual[tipo]] : Array.from({ length: n }, () => null);
  base.length = n;
  base[index] = valor;
  actual[tipo] = base.some(Boolean) ? base : null;
  renderSlots(tipo, actual[tipo]);
  renderAvisos(tipo);
}

/** Avisos cuando el armado manual no cumple alguna regla (igual se puede guardar) */
function revisar(tipo, lista) {
  const avisos = [];
  if (!Array.isArray(lista) || !lista.every(Boolean)) return avisos;

  const repetidos = [...new Set(lista
    .filter((l, i) => lista.findIndex(x => norm(x.nombre) === norm(l.nombre)) !== i)
    .map(l => l.nombre))];
  if (repetidos.length) avisos.push(`${repetidos.join(', ')} está repetido.`);

  const recientes = [...bloqueados(tipo)];
  const salieron = lista.filter(l => recientes.includes(norm(l.nombre))).map(l => l.nombre);
  if (salieron.length) avisos.push(`${salieron.join(', ')} ya salió hace poco en ${tipo === 'reel' ? 'Reel' : 'Stories'}.`);

  const moda = lista.filter(l => esModa(l.categoria)).length;
  if (tipo === 'reel') {
    const [a, b] = lista;
    if (!parReelValido(a, b)) {
      if (norm(a.categoria) === norm(b.categoria)) avisos.push('Los dos son de la misma categoría.');
      else if (!moda) avisos.push('Falta un local de MODA.');
      else avisos.push('MODA UNISEX no va con MODA MUJER, MODA HOMBRE ni MODA UNISEX.');
    }
  } else if (moda < REGLAS.stories.minimoModa) {
    avisos.push(`Hay ${moda} ${moda === 1 ? 'local' : 'locales'} de MODA y la regla pide ${REGLAS.stories.minimoModa}.`);
  }
  return avisos;
}

function renderAvisos(tipo) {
  const msg = $(`#msg-${tipo}`);
  const avisos = revisar(tipo, actual[tipo]);
  msg.className = avisos.length ? 'msg aviso' : 'msg';
  msg.textContent = avisos.join(' ');
}

function renderHistorial(tipo) {
  const cont = $(`#hist-${tipo}`);
  const items = [...estado.historial[tipo]].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (!items.length) {
    cont.innerHTML = `<p class="vacio">Todavía no hay sorteos guardados. Tirá el dado y confirmá con OK.</p>`;
    return;
  }
  cont.innerHTML = items.map(e => {
    const f = formatear(e.fecha);
    return `<div class="fila-hist">
      <div class="nombres">${e.locales.map(l => `<div>${esc(l.nombre)}</div>`).join('')}</div>
      <div class="cuando">${f.fecha}<span>${f.hora} hs</span></div>
    </div>`;
  }).join('') + '<div class="relleno"></div>';
}

function renderBusqueda() {
  const q = norm($('#buscar').value);
  const out = $('#resultados');
  if (q.length < 2) {
    out.innerHTML = '<p class="vacio">Escribí el nombre para ver sus últimas apariciones.</p>';
    return;
  }

  // nombres que coinciden: locales actuales + los que ya no están pero figuran en historiales
  const nombres = new Map();
  estado.locales.forEach(l => nombres.set(norm(l.nombre), l.nombre));
  ['reel', 'stories'].forEach(t => estado.historial[t].forEach(e =>
    e.locales.forEach(l => { if (!nombres.has(norm(l.nombre))) nombres.set(norm(l.nombre), l.nombre); })));

  const coincidencias = [...nombres.entries()].filter(([k]) => k.includes(q)).slice(0, 6);
  if (!coincidencias.length) {
    out.innerHTML = '<p class="vacio">No hay locales con ese nombre.</p>';
    return;
  }

  const ahora = new Date();
  out.innerHTML = coincidencias.map(([clave, nombre]) => {
    const apariciones = [];
    ['reel', 'stories'].forEach(t => estado.historial[t].forEach(e => {
      if (e.locales.some(l => norm(l.nombre) === clave)) apariciones.push({ tipo: t, fecha: e.fecha });
    }));
    apariciones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const lista = apariciones.length
      ? `<ul>${apariciones.slice(0, 5).map(a => {
          const f = formatear(a.fecha);
          return `<li><b>${f.fecha}</b> ${a.tipo === 'reel' ? 'REEL' : 'STORIES'}</li>`;
        }).join('')}</ul>`
      : '<ul><li>Sin apariciones</li></ul>';

    const estados = ['reel', 'stories'].map(t => {
      const ultima = apariciones.find(a => a.tipo === t);
      if (!ultima) return null;
      const libre = sumarBloqueo(t, ultima.fecha);
      return libre > ahora ? `${t === 'reel' ? 'Reel' : 'Stories'}: libre desde ${formatear(libre).fecha} ${formatear(libre).hora}` : null;
    }).filter(Boolean);

    return `<div class="res"><strong>${esc(nombre)}:</strong>${lista}${estados.length ? `<div class="estado">${estados.join('<br>')}</div>` : ''}</div>`;
  }).join('');
}

function categorias() {
  const set = new Set(LOCALES_INICIALES.map(l => l.categoria));
  estado.locales.forEach(l => set.add(l.categoria));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}

function renderPanel() {
  const sel = $('#nueva-categoria');
  const previo = sel.value;
  sel.innerHTML = `<option value="" disabled ${previo ? '' : 'selected'}>SELECCIONÁ CATEGORÍA</option>` +
    categorias().map(c => `<option ${c === previo ? 'selected' : ''}>${esc(c)}</option>`).join('') +
    `<option value="__nueva" ${previo === '__nueva' ? 'selected' : ''}>+ NUEVA CATEGORÍA</option>`;

  const locales = [...estado.locales].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
  $('#contador').textContent = `${locales.length} locales cargados`;
  $('#lista-locales').innerHTML = locales.map(l => `
    <li>
      <button class="quitar" data-accion="quitar" data-nombre="${esc(l.nombre)}" aria-label="Quitar ${esc(l.nombre)}"></button>
      <span>${esc(l.nombre)}</span>
      <span>${esc(l.categoria)}</span>
    </li>`).join('');
}

function renderTodo() {
  renderSlots('reel', actual.reel);
  renderSlots('stories', actual.stories);
  renderAvisos('reel');
  renderAvisos('stories');
  renderHistorial('reel');
  renderHistorial('stories');
  renderBusqueda();
  renderPanel();
}

/* ---------- Acciones ---------- */
let toastTimer;
function toast(texto, error = false) {
  const t = $('#toast');
  t.textContent = texto;
  t.classList.toggle('error', error);
  t.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visible'), 2600);
}

const girandoAhora = { reel: false, stories: false };

async function sortear(tipo, boton) {
  if (girandoAhora[tipo]) return;
  const msg = $(`#msg-${tipo}`);
  msg.className = 'msg';
  msg.textContent = '';

  // en modo servidor refrescamos antes, por si se guardó algo desde otro dispositivo
  if (modo === 'api') { try { await cargar(); renderHistorial('reel'); renderHistorial('stories'); } catch {} }

  let resultado;
  try {
    resultado = tipo === 'reel' ? sortearReel() : sortearStories();
  } catch (e) {
    actual[tipo] = null;
    renderSlots(tipo, null);
    msg.className = 'msg';
    msg.textContent = e.message;
    return;
  }

  girandoAhora[tipo] = true;
  actual[tipo] = resultado;
  boton.classList.remove('gira'); void boton.offsetWidth; boton.classList.add('gira');

  const reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vueltas = reducir ? 0 : 8;
  for (let i = 0; i < vueltas; i++) {
    renderSlots(tipo, mezclar(estado.locales).slice(0, REGLAS[tipo].cantidad), true);
    await new Promise(r => setTimeout(r, 60));
  }
  girandoAhora[tipo] = false;
  renderSlots(tipo, resultado);
  renderAvisos(tipo);
}

async function confirmar(tipo) {
  const sel = actual[tipo];
  if (!completo(tipo)) return;
  const avisos = revisar(tipo, sel);
  if (avisos.length && !confirm(`${avisos.join('\n')}\n\n¿Guardar igual?`)) return;
  const entrada = {
    id: nuevoId(),
    fecha: new Date().toISOString(),
    locales: sel.map(({ nombre, categoria }) => ({ nombre, categoria })),
  };
  estado.historial[tipo].unshift(entrada);
  actual[tipo] = null;
  renderTodo();
  try {
    await guardar();
    toast(`${tipo === 'reel' ? 'Reel' : 'Stories'} guardado en el historial`);
  } catch (e) {
    estado.historial[tipo] = estado.historial[tipo].filter(x => x.id !== entrada.id);
    actual[tipo] = sel;
    renderTodo();
    toast(`${e.message} Probá de nuevo con OK.`, true);
  }
}

async function agregarLocal(ev) {
  ev.preventDefault();
  const nombre = limpiar($('#nuevo-nombre').value);
  let categoria = $('#nueva-categoria').value;
  if (categoria === '__nueva') categoria = limpiar($('#categoria-libre').value);
  categoria = limpiar(categoria);

  if (!nombre) return toast('Escribí el nombre del local.', true);
  if (!categoria) return toast('Elegí o escribí una categoría.', true);
  if (estado.locales.some(l => norm(l.nombre) === norm(nombre))) return toast(`${nombre} ya está en la lista.`, true);

  const previo = estado.locales;
  estado.locales = [...estado.locales, { nombre, categoria }];
  try {
    await guardar();
    $('#nuevo-nombre').value = '';
    $('#categoria-libre').value = '';
    $('#categoria-libre').hidden = true;
    $('#nueva-categoria').value = '';
    renderPanel();
    toast(`${nombre} agregado`);
  } catch (e) {
    estado.locales = previo;
    toast(e.message, true);
  }
}

async function quitarLocal(nombre) {
  if (!confirm(`¿Quitar ${nombre} de la lista?\nSus apariciones en los historiales se mantienen.`)) return;
  const previo = estado.locales;
  estado.locales = estado.locales.filter(l => norm(l.nombre) !== norm(nombre));
  try {
    await guardar();
    renderPanel();
    toast(`${nombre} quitado`);
  } catch (e) {
    estado.locales = previo;
    toast(e.message, true);
  }
}

/* ---------- Selector manual de locales ---------- */
let picker = { tipo: null, index: -1 };

function abrirPicker(tipo, index) {
  picker = { tipo, index };
  $('#picker-titulo').textContent = `${tipo === 'reel' ? 'Reel' : 'Stories'}: casillero ${index + 1}`;
  $('#picker-buscar').value = '';
  renderPicker();
  $('#picker').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#picker-buscar').focus();
}

function cerrarPicker() {
  $('#picker').hidden = true;
  document.body.style.overflow = '';
  const { tipo, index } = picker;
  picker = { tipo: null, index: -1 };
  const slot = document.querySelector(`.slot[data-tipo="${tipo}"][data-index="${index}"]`);
  if (slot) slot.focus();
}

function renderPicker() {
  const { tipo, index } = picker;
  if (!tipo) return;
  const q = norm($('#picker-buscar').value);
  const bloq = bloqueados(tipo);
  const puestos = new Set((actual[tipo] || [])
    .map((l, i) => (l && i !== index ? norm(l.nombre) : null)).filter(Boolean));

  const lista = [...estado.locales]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
    .filter(l => !q || norm(l.nombre).includes(q) || norm(l.categoria).includes(q));

  $('#picker-lista').innerHTML = lista.length
    ? lista.map(l => {
        const yaEsta = puestos.has(norm(l.nombre));
        const reciente = bloq.has(norm(l.nombre));
        const tag = yaEsta ? '<span class="pl-tag">Ya elegido</span>'
          : reciente ? '<span class="pl-tag alerta">Salió hace poco</span>' : '';
        return `<li><button type="button" data-accion="tomar" data-nombre="${esc(l.nombre)}" ${yaEsta ? 'disabled' : ''}>
          <span class="pl-nombre">${esc(l.nombre)}</span>
          <span class="pl-cat">${esc(l.categoria)}</span>${tag}
        </button></li>`;
      }).join('')
    : '<li class="vacio">No hay locales con ese nombre. Podés agregarlo desde el panel de locales.</li>';
}

function tomarLocal(nombre) {
  const { tipo, index } = picker;
  if (!tipo) return;
  const l = estado.locales.find(x => norm(x.nombre) === norm(nombre));
  if (!l) return;
  ponerEnSlot(tipo, index, { nombre: l.nombre, categoria: l.categoria });
  cerrarPicker();
}

function mostrarLogin(error) {
  $('#login').hidden = false;
  $('#msg-login').textContent = error ? 'Contraseña incorrecta.' : '';
  $('#pass').focus();
}

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const { accion, tipo, nombre, index } = b.dataset;
  if (accion === 'sortear') sortear(tipo, b);
  if (accion === 'ok') confirmar(tipo);
  if (accion === 'quitar') quitarLocal(nombre);
  if (accion === 'elegir') abrirPicker(tipo, Number(index));
  if (accion === 'tomar') tomarLocal(nombre);
});

$('#buscar').addEventListener('input', renderBusqueda);
$('#form-local').addEventListener('submit', agregarLocal);
$('#nueva-categoria').addEventListener('change', e => {
  const libre = $('#categoria-libre');
  libre.hidden = e.target.value !== '__nueva';
  if (!libre.hidden) libre.focus();
});

$('#abrir-panel').addEventListener('click', () => {
  renderPanel();
  $('#panel').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#nuevo-nombre').focus();
});
function cerrarPanel() {
  $('#panel').hidden = true;
  document.body.style.overflow = '';
  $('#abrir-panel').focus();
}
$('#cerrar-panel').addEventListener('click', cerrarPanel);
$('#cerrar-picker').addEventListener('click', cerrarPicker);
$('#picker-buscar').addEventListener('input', renderPicker);
$('#picker').addEventListener('click', e => { if (e.target === $('#picker')) cerrarPicker(); });
$('#vaciar-slot').addEventListener('click', () => {
  const { tipo, index } = picker;
  if (tipo) { ponerEnSlot(tipo, index, null); cerrarPicker(); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#picker').hidden) cerrarPicker();
  else if (!$('#panel').hidden) cerrarPanel();
});

$('#form-login').addEventListener('submit', async e => {
  e.preventDefault();
  password = $('#pass').value;
  sessionStorage.setItem('bbps-pass', password);
  if (await iniciar()) $('#login').hidden = true;
});

/* ---------- Inicio ---------- */
async function iniciar() {
  try {
    const ok = await cargar();
    if (ok) renderTodo();
    return ok;
  } catch (e) {
    toast(e.message, true);
    return false;
  }
}
renderTodo();
iniciar();
