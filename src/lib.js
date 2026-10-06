export const C = window.CFG;
const H = { apikey: C.SUPABASE_KEY, Authorization: 'Bearer ' + C.SUPABASE_KEY, 'Content-Type': 'application/json' };

export async function api(path, opt = {}) {
  const r = await fetch(C.SUPABASE_URL + '/rest/v1/' + path, { cache: 'no-store', ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(await r.text());
  return r.status === 204 ? null : r.json();
}
const rep = { Prefer: 'return=representation' };
export const post = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body), headers: rep });
export const patch = (p, body) => api(p, { method: 'PATCH', body: JSON.stringify(body), headers: rep });
export const rpc = (fn, body) => api('rpc/' + fn, { method: 'POST', body: JSON.stringify(body) });
export const head = path => fetch(C.SUPABASE_URL + '/rest/v1/' + path, { method: 'HEAD', cache: 'no-store', headers: { ...H, Prefer: 'count=exact' } });

export const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { } },
  del: k => { try { localStorage.removeItem(k) } catch { } },
};
export const money = n => '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
export const dirTxt = c => [c.calle, c.numero, c.localidad].filter(Boolean).join(' ');

// Deja el celular siempre como 549 + 10 dígitos (área + número), ej: 5493815684987.
// Acepta +54, 54, 549, 0 de área, 15 de celular, espacios, guiones, paréntesis, etc.
// Devuelve '' si no se puede armar un número válido.
export function normalizarCel(n) {
  let d = String(n || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('54') && d.length > 10) d = d.slice(2);        // código de país
  if (d.startsWith('9') && d.length > 10) d = d.slice(1);        // el 9 de celular
  d = d.replace(/^0+/, '');                                       // 0 de área (0381...)
  if (d.length === 12) {                                          // área + 15 + número
    const i = d.startsWith('11') ? 2 : [3, 4, 2].find(k => d.substr(k, 2) === '15');
    if (i !== undefined && d.substr(i, 2) === '15') d = d.slice(0, i) + d.slice(i + 2);
  }
  return d.length === 10 ? '549' + d : '';
}
// Busca al cliente por coincidencia EXACTA del celular (sin importar el formato guardado),
// no por "contiene": así 5493816677869 no trae 54938166778694124.
export async function buscarPorCel(cel) {
  const n = cel.slice(-10);
  const r = await api(`clientes?celular=in.(${['549' + n, '54' + n, n, '0' + n].join(',')})&select=*&order=activo.desc.nullslast,id_cliente&limit=1`);
  return r[0] || null;
}
export const celValido = c => /^549\d{10}$/.test(c);

function pip(lat, lon, poly) { // punto en polígono; poly = [[lat,lon],...]
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lon) !== (yj > lon) && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export async function reverse(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
    return (await r.json()).address || null;
  } catch { return null }
}
export const dirDeAddr = (a = {}) => ({ calle: a.road || '', numero: a.house_number || '', localidad: a.city || a.town || a.village || a.suburb || '' });

export async function buscarDirecciones(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&countrycodes=ar&viewbox=-66.3,-25.9,-64.3,-28.0&bounded=1&q=${encodeURIComponent(q)}`;
  return (await fetch(u)).json();
}

let leaflet;
export function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  return leaflet || (leaflet = new Promise((ok, ko) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = ok; s.onerror = () => { leaflet = null; ko(); }; document.head.appendChild(s);
  }));
}
export const tiles = () => window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });

// Igual que el flujo n8n: polígono -> (si no) geocodificación inversa + zona por nombre -> lista más usada de la zona
let zonasCache;
export async function resolverZonaLista(lat, lon) {
  let id_zona = null;
  try {
    zonasCache = zonasCache || await api('zonas?coordenadas=not.is.null&select=id_zona,nombre,coordenadas');
    for (const z of zonasCache) {
      let p = z.coordenadas; if (typeof p === 'string') { try { p = JSON.parse(p) } catch { continue } }
      if (Array.isArray(p) && p.length >= 3 && pip(lat, lon, p)) { id_zona = z.id_zona; break; }
    }
  } catch (e) { console.warn(e) }
  if (!id_zona) {
    const a = await reverse(lat, lon);
    const msg = a && (a.state_district === 'Departamento Capital' ? 'Capital' : (a.city || a.town || a.suburb || a.village));
    if (msg) try {
      let z = await rpc('buscar_zona_por_mensaje', { p_mensaje: msg });
      if (Array.isArray(z)) z = z[0];
      id_zona = (z && z.id_zona) || null;
    } catch (e) { console.warn(e) }
  }
  if (!id_zona) return { id_zona: null, id_lista_precio: null };
  const rows = await api(`clientes?id_zona=eq.${id_zona}&id_lista_precio=not.is.null&select=id_lista_precio&limit=1000`);
  const cnt = {}; rows.forEach(r => cnt[r.id_lista_precio] = (cnt[r.id_lista_precio] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  // Con zona detectada siempre se asigna una lista: la más usada de la zona o, si la zona aún no tiene clientes, la lista base (lista 1)
  return { id_zona, id_lista_precio: top ? +top[0] : (C.LISTA_BASE || 6) };
}

// Guarda al cliente nuevo o actualiza la ubicación del existente.
// Devuelve { sin: true } (sin cobertura) o { cliente, existente? }
export async function guardarCliente({ nuevo, datos, cliente, loc, f }) {
  const zl = await resolverZonaLista(loc.lat, loc.lon);
  // Un cliente existente conserva SU lista de precios: la lista por zona solo se usa si no tiene ninguna.
  const listaPropia = !nuevo && cliente.id_lista_precio;
  if (!listaPropia && (!zl.id_zona || !zl.id_lista_precio)) return { sin: true };
  const dir = { calle: f.calle.trim() || null, numero: f.numero.trim() || null, localidad: f.localidad.trim() || null, latitud: loc.lat, longitud: loc.lon };
  if (zl.id_zona) dir.id_zona = zl.id_zona;
  if (!listaPropia) dir.id_lista_precio = zl.id_lista_precio;
  const ref = f.ref.trim();
  if (nuevo) {
    const ex = await buscarPorCel(datos.celular);
    if (ex) return { cliente: ex, existente: true };
    try {
      return { cliente: (await post('clientes', { ...datos, referencia: ref || null, tipo: 'Consumidor final', ...dir }))[0] };
    } catch (e) { // celular único: si otro registro se coló en el medio, se usa esa cuenta
      const ya = /23505|duplicate/i.test(String(e.message)) && await buscarPorCel(datos.celular);
      if (ya) return { cliente: ya, existente: true };
      throw e;
    }
  }
  if (ref) dir.referencia = ref;
  return { cliente: (await patch(`clientes?id_cliente=eq.${cliente.id_cliente}`, dir))[0] || { ...cliente, ...dir } };
}
