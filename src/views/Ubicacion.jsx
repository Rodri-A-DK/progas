import { useEffect, useRef, useState } from 'react';
import { buscarDirecciones, cargarLeaflet, dirDeAddr, guardarCliente, celValido, normalizarCel, reverse, store, tiles, C } from '../lib.js';

// "38, Avenida Alem, Barrio..." -> ["Avenida Alem 38", "Barrio..."]
function partes(x) {
  const p = x.display_name.split(',').map(t => t.trim());
  const n = /^\d+[a-zA-Z]?$/.test(p[0]) && p.length > 1;
  return [n ? `${p[1]} ${p[0]}` : p[0], p.slice(n ? 2 : 1, n ? 5 : 4).join(', ')];
}

// Registro de cliente nuevo (cliente = null) o cambio de dirección de uno existente:
// GPS, búsqueda y mapa con pin arrastrable.
export default function Ubicacion({ cliente, celular, onCancel, onGuardado }) {
  const nuevo = !cliente;
  const c = cliente || {};
  const tiene = c.latitud && c.longitud;
  const [d, setD] = useState({ nombre: '', apellido: '', celular: celular || '' });
  const [f, setF] = useState({ calle: c.calle || '', numero: c.numero || '', localidad: c.localidad || '', ref: c.referencia || '' });
  const [loc, setLoc] = useState(tiene ? { lat: +c.latitud, lon: +c.longitud } : null);
  const [q, setQ] = useState('');
  const [sug, setSug] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [manual, setManual] = useState(false); // dirección a mano (sin GPS o la del mapa no es correcta)
  const el = useRef(), map = useRef(), marker = useRef(), skip = useRef(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const setDato = k => e => setD({ ...d, [k]: e.target.value });

  async function mover(lat, lon, rev = true) {
    setLoc({ lat, lon });
    if (!rev) return;
    const a = await reverse(lat, lon);
    if (a) setF(p => {
      const d = dirDeAddr(a);
      return { ...p, calle: p.calle || d.calle, numero: p.numero || d.numero, localidad: p.localidad || d.localidad };
    });
  }

  useEffect(() => {
    if (!loc && !manual) return;
    let vivo = true;
    cargarLeaflet().then(() => {
      if (!vivo || !el.current) return;
      const L = window.L, ll = loc ? [loc.lat, loc.lon] : C.CENTRO;
      if (!map.current) {
        map.current = L.map(el.current).setView(ll, loc ? 17 : 13);
        tiles().addTo(map.current);
        map.current.on('click', e => mover(e.latlng.lat, e.latlng.lng));
      } else if (loc) map.current.setView(ll, Math.max(map.current.getZoom(), 17));
      if (loc) {
        if (marker.current) marker.current.setLatLng(ll);
        else {
          marker.current = L.marker(ll, { draggable: true }).addTo(map.current);
          marker.current.on('dragend', () => { const p = marker.current.getLatLng(); mover(p.lat, p.lng); });
        }
      }
      setTimeout(() => map.current && map.current.invalidateSize(), 50);
    }).catch(() => { });
    return () => { vivo = false; };
  }, [loc, manual]);
  useEffect(() => () => { if (map.current) map.current.remove(); map.current = marker.current = null; }, []);

  function gps() {
    if (!navigator.geolocation) { setManual(true); return setErr('Tu navegador no permite compartir ubicación. Escribí tu dirección a mano.'); }
    setGpsBusy(true); setErr('');
    navigator.geolocation.getCurrentPosition(
      p => { setGpsBusy(false); mover(p.coords.latitude, p.coords.longitude); },
      () => { setGpsBusy(false); setManual(true); setErr('No pudimos obtener tu ubicación. Activá el permiso o escribí tu dirección a mano.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  // Sugerencias mientras escribe (sin botón Buscar)
  useEffect(() => {
    const t = q.trim();
    if (skip.current) { skip.current = false; return; }
    if (t.length < 3) { setSug(null); return; }
    let vivo = true;
    const id = setTimeout(() => {
      setBuscando(true);
      buscarDirecciones(t).then(r => vivo && setSug(r)).catch(() => vivo && setSug([])).finally(() => vivo && setBuscando(false));
    }, 450);
    return () => { vivo = false; clearTimeout(id); };
  }, [q]);
  function elegir(x) {
    setSug(null); skip.current = true;
    setQ(partes(x)[0]);
    setF(p => ({ ...p, ...dirDeAddr(x.address) }));
    mover(+x.lat, +x.lon, false);
  }
  async function guardar(e) {
    e.preventDefault(); setErr('');
    let datos;
    if (nuevo) {
      const cel = normalizarCel(d.celular);
      if (!celValido(cel)) return setErr('Revisá el número: ingresá código de área y número. Ej: 3815684987');
      datos = { nombre: d.nombre.trim(), apellido: d.apellido.trim(), celular: cel };
    }
    if (!loc) {
      if (!manual) return setErr('Buscá tu dirección o compartí tu ubicación para continuar.');
      if (!f.calle.trim()) return setErr('Escribí al menos la calle, o tocá el mapa para marcar tu casa.');
      setBusy(true);
      try {
        const r = await buscarDirecciones([f.calle, f.numero, f.localidad].filter(Boolean).join(' '));
        if (r.length) { setLoc({ lat: +r[0].lat, lon: +r[0].lon }); setErr('Ubicamos tu dirección en el mapa. Revisá que el pin esté sobre tu casa (podés moverlo) y tocá de nuevo para confirmar.'); }
        else setErr('No pudimos ubicar esa dirección. Tocá el mapa para marcar el punto de tu casa.');
      } catch { setErr('No pudimos ubicar la dirección. Tocá el mapa para marcar el punto de tu casa.'); }
      return setBusy(false);
    }
    setBusy(true);
    try {
      const r = await guardarCliente({ nuevo, datos, cliente, loc, f });
      if (nuevo && r.cliente) store.set('pg_tel', datos.celular);
      onGuardado(r);
    }
    catch (e) { console.error(e); setBusy(false); setErr('No pudimos guardar tus datos. Intentá de nuevo.'); }
  }

  return (
    <>
      <h2>{nuevo ? 'Registrate' : 'Tu ubicación'}</h2>
      <p className="sub">{nuevo ? 'Completá tus datos una sola vez.' : 'Marcá dónde te entregamos el pedido.'}</p>
      <form onSubmit={guardar}>
        {nuevo && <>
          <div className="row">
            <div><label>Nombre</label><input name="nombre" autoComplete="given-name" enterKeyHint="next" value={d.nombre} onChange={setDato('nombre')} required /></div>
            <div><label>Apellido</label><input name="apellido" autoComplete="family-name" enterKeyHint="next" value={d.apellido} onChange={setDato('apellido')} required /></div>
          </div>
          <label>Celular</label><input type="tel" name="tel" autoComplete="tel" inputMode="tel" value={d.celular} onChange={setDato('celular')} required />
        </>}
        <label>{nuevo ? 'Dirección de entrega' : 'Nueva dirección'}</label>
        <div className="search">
          <span className="ico">⌕</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Escribí tu calle y número" autoComplete="off" enterKeyHint="search" />
          {buscando && <span className="spin sm" />}
          {sug && (
            <ul className="sug">
              {sug.length ? sug.map((x, i) => {
                const [t, r] = partes(x);
                return <li key={i} onClick={() => elegir(x)}><b>{t}</b><small>{r}</small></li>;
              }) : <li onClick={() => { setSug(null); setManual(true); }}><small>No encontramos esa dirección. <b>Tocá acá para escribirla a mano.</b></small></li>}
            </ul>
          )}
        </div>
        <button type="button" className="gpsbtn" onClick={gps} disabled={gpsBusy}>{gpsBusy ? 'Buscando tu ubicación…' : '◎ Usar mi ubicación actual'}</button>
        {!loc && !manual && <button type="button" className="link" style={{ marginTop: 10 }} onClick={() => setManual(true)}>¿No podés compartir tu ubicación o no encontrás tu dirección? Escribila a mano</button>}
        <div id="map" ref={el} style={{ display: loc || manual ? 'block' : 'none' }} />
        {!loc && manual && <p className="hint">Escribí tu dirección abajo y tocá el mapa para marcar tu casa.</p>}
        {loc && <div className="ok-loc">✓ Ubicación marcada · podés mover el pin para ajustarla</div>}
        {loc && !manual && <div className="resumen">📍 {[f.calle, f.numero, f.localidad].filter(Boolean).join(' ') || 'Ubicación seleccionada'}
          <button type="button" className="link" onClick={() => setManual(true)}>¿No es correcta? Corregir dirección</button></div>}
        {manual && <>
          <div className="row"><div><label>Calle</label><input name="calle" autoComplete="address-line1" value={f.calle} onChange={set('calle')} /></div><div><label>Número</label><input name="numero" autoComplete="off" inputMode="numeric" value={f.numero} onChange={set('numero')} /></div></div>
          <label>Localidad</label><input name="localidad" autoComplete="address-level2" value={f.localidad} onChange={set('localidad')} />
        </>}
        {(loc || manual) && <><label>Referencia (opcional)</label><input name="referencia" autoComplete="off" value={f.ref} onChange={set('ref')} placeholder="Ej: casa con portón azul" /></>}
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : nuevo ? 'Registrarme y continuar' : 'Guardar ubicación'}</button>
        {onCancel && <button type="button" className="link" style={{ marginTop: 10 }} onClick={onCancel}>Cancelar</button>}
      </form>
    </>
  );
}
