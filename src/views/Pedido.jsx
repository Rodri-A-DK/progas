import { useEffect, useState } from 'react';
import { api, post, head, money, dirTxt, C } from '../lib.js';

const IMG = {
  10: 'https://d17xkca3wmvow8.cloudfront.net/yelo_products/thumb-400-400-h3g3ptsmCaQu2P1623865188642-Imagen20OK10kg.jpg',
  15: 'https://d17xkca3wmvow8.cloudfront.net/yelo_products/thumb-400-400-dgjdnmr5C9iaOa1590947870430-15kgesp24974.jpg',
  45: 'https://encrypted-tbn3.gstatic.com/images?q=tbn:ANd9GcTDVb8gnbLEQ4De3ADgPCGk3Xop2AHK3qjb_g1HNKN9VHNsRboE',
};
const ORDEN = [10, 15, 45];
const kgDe = n => { const m = /(\d+)\s*kg/i.exec(n) || /(\d+)/.exec(n); return m ? +m[1] : null; };
const rango = p => { const i = ORDEN.indexOf(p.kg); return i < 0 ? ORDEN.length : i; };

const traerCliente = id => api(`clientes?id_cliente=eq.${id}&select=*&limit=1`).then(r => r[0] || null);

export default function Pedido({ cliente: inicial, onCambiar, onSalir }) {
  const [cli, setCli] = useState(null); // datos frescos del cliente (su lista de precios manda)
  const cliente = cli || inicial;
  const [items, setItems] = useState(null);
  const [cant, setCant] = useState({});
  const [pago, setPago] = useState('Efectivo');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(null);
  const [paso, setPaso] = useState(null); // null | 'nota' | 'aviso'
  const [nota, setNota] = useState('');

  useEffect(() => { traerCliente(inicial.id_cliente).then(c => setCli(c || inicial)).catch(() => setCli(inicial)); }, [inicial.id_cliente]);

  useEffect(() => {
    if (!cli) return;
    if (!cli.id_lista_precio) { setErr('Tu cuenta no tiene lista de precios asignada. Comunicate con nosotros al ' + C.TELEFONO_CONTACTO + '.'); setItems([]); return; }
    setItems(null); setCant({});
    api(`productos?select=id_producto,nombre,url_imagen,productos_listas_precios!inner(precio)&productos_listas_precios.id_lista_precio=eq.${cliente.id_lista_precio}&order=nombre`)
      .then(r => setItems(r.map(p => { const kg = kgDe(p.nombre); return { id: p.id_producto, nombre: p.nombre, kg, img: IMG[kg] || p.url_imagen, precio: +p.productos_listas_precios[0].precio }; })
        .filter(p => p.precio > 0).sort((a, b) => rango(a) - rango(b) || a.nombre.localeCompare(b.nombre))))
      .catch(e => { console.error(e); setErr('No pudimos cargar los productos. Intentá de nuevo.'); setItems([]); });
  }, [cli && cli.id_lista_precio]);

  const sel = (items || []).filter(p => cant[p.id] > 0);
  const total = sel.reduce((s, p) => s + p.precio * cant[p.id], 0);
  const mod = (id, d) => setCant(c => ({ ...c, [id]: Math.max(0, (c[id] || 0) + d) }));

  async function confirmar() {
    setPaso(null); setBusy(true); setErr('');
    const obs = nota.replace(/[:;]/g, ' ').replace(/\s+/g, ' ').trim(); // nota para el repartidor
    try {
      // Antes de registrar, se verifica que la lista con la que se vieron los precios siga siendo la de la cuenta
      const fresco = await traerCliente(cliente.id_cliente);
      if (!fresco || !fresco.id_lista_precio) throw new Error('cliente sin lista de precios');
      if (fresco.id_lista_precio !== cliente.id_lista_precio) {
        setCli(fresco); setBusy(false); setErr('Actualizamos los precios de tu cuenta. Revisá tu pedido y confirmá de nuevo.'); return;
      }
      const hoy = new Date(), ini = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
      const r = await head(`pedidos?select=id_pedido&fecha_pedido=gte.${ini}`);
      const n = +((r.headers.get('content-range') || '').split('/')[1]) || 0;
      const codigo = `P-${hoy.toISOString().slice(0, 10).replace(/-/g, '')}-${n + 1}`;
      const rec = { codigo, id_cliente: cliente.id_cliente, id_zona: cliente.id_zona, id_lista_precio: cliente.id_lista_precio, estado: 'Pendiente', forma_pago: pago, tipo_pedido: 'Pedido', monto_total: total, observaciones: obs ? `[Pedido web] ${obs}` : '[Pedido web]' };
      if (C.ID_RECEPCIONISTA) rec.id_recepcionista = C.ID_RECEPCIONISTA;
      const ped = (await post('pedidos', rec))[0];
      await post('pedidos_productos', sel.map(p => ({ id_pedido: ped.id_pedido, id_producto: p.id, cantidad: cant[p.id], precio_unitario: p.precio })));
      const msg = [
        `¡Hola! Mi pedido es el N° ${codigo}`,
        `Cliente: ${`${cliente.nombre} ${cliente.apellido || ''}`.trim()}`,
        cliente.celular ? `Teléfono de la cuenta: ${cliente.celular}` : null,
        '',
        ...sel.map(p => `• ${cant[p.id]} x ${p.nombre} — ${money(p.precio * cant[p.id])}`),
        '',
        `*Total: ${money(total)}*`,
        `Pago: ${pago}`,
        dirTxt(cliente) ? `Dirección: ${dirTxt(cliente)}` : null,
        `Ubicación: https://maps.google.com/?q=${cliente.latitud},${cliente.longitud}`,
        obs ? `Nota para el repartidor: ${obs}` : null,
      ].filter(l => l !== null).join('\n');
      const url = `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent(msg)}`;
      setOk({ codigo, url, monto: total }); location.href = url;
    } catch (e) { console.error(e); setBusy(false); setErr(`No pudimos registrar tu pedido. Intentá de nuevo o llamanos al ${C.TELEFONO_CONTACTO}.`); }
  }

  if (ok) return (
    <div className="center">
      <h2>¡Pedido registrado! ✅</h2>
      <p className="sub">N° {ok.codigo} · {money(ok.monto)}<br />Para concluir el pedido tenés que <b>enviar el mensaje</b> en WhatsApp.<br />Si no se abrió, tocá el botón.</p>
      <a className="btn" style={{ display: 'block', textDecoration: 'none' }} href={ok.url}>Enviar por WhatsApp</a>
      <button className="link" style={{ marginTop: 14 }} onClick={() => { setOk(null); setBusy(false); setCant({}); }}>Hacer otro pedido</button>
    </div>
  );
  if (!items) return <p className="center"><span className="spin" /></p>;

  return (
    <>
      <div className="top">
        <div><h2>Hola, {cliente.nombre}</h2>
          <div className="addr">📍 {dirTxt(cliente) || 'Ubicación registrada'} · <button className="link" onClick={onCambiar}>Cambiar</button></div></div>
        <button className="link" onClick={onSalir}>Salir</button>
      </div>
      <p className="sub">Elegí lo que necesitás:</p>
      {items.length ? items.map(p => (
        <div className="prod" key={p.id}>
          {p.img && <img src={p.img} alt={p.nombre} loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />}
          <div className="n">{p.nombre}<div className="p">{money(p.precio)}</div></div>
          <div className="qty"><button type="button" onClick={() => mod(p.id, -1)}>−</button><span>{cant[p.id] || 0}</span><button type="button" onClick={() => mod(p.id, 1)}>+</button></div>
        </div>
      )) : <p className="hint">No hay productos disponibles por el momento.</p>}
      <label>Forma de pago</label>
      <select value={pago} onChange={e => setPago(e.target.value)}><option>Efectivo</option><option>Transferencia</option></select>
      {pago === 'Transferencia' && <p className="nota">🧾 Tené el comprobante de la transferencia a mano para mostrarlo al momento de la entrega.</p>}
      <div className="total"><span>Total</span><span>{money(total)}</span></div>
      {err && <div className="err">{err}</div>}
      <button className="btn" disabled={!sel.length || busy} onClick={() => setPaso('nota')}>{busy ? <span className="spin" /> : 'Confirmar pedido'}</button>
      {paso === 'nota' && (
        <div className="modal" onClick={() => setPaso(null)}>
          <div className="modal-c" onClick={e => e.stopPropagation()}>
            <h2>Nota para el repartidor</h2>
            <p className="sub" style={{ marginBottom: 10 }}>Opcional. Podés indicar el horario que preferís para la entrega, si tiene que tocar el timbre, etc.</p>
            <textarea rows="3" maxLength="200" value={nota} onChange={e => setNota(e.target.value)} placeholder="Ej: tocar el timbre, entregar después de las 10 hs, dejar con el portero…" style={{ textAlign: 'left' }} />
            <button className="btn" onClick={() => setPaso('aviso')}>{nota.trim() ? 'Continuar' : 'Continuar sin nota'}</button>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setPaso(null)}>Volver</button>
          </div>
        </div>
      )}
      {paso === 'aviso' && (
        <div className="modal" onClick={() => setPaso(null)}>
          <div className="modal-c" onClick={e => e.stopPropagation()}>
            <h2>Antes de confirmar</h2>
            <ul className="avisos">
              <li>💬 Te vamos a abrir WhatsApp con un mensaje listo, con todos los datos de tu pedido, en el chat de la empresa.</li>
              <li><b>Para concluir el pedido tenés que enviar ese mensaje.</b></li>
              {pago === 'Transferencia' && <li>🧾 Pasá el comprobante de la transferencia por WhatsApp o tenelo listo para mostrárselo al chofer.</li>}
            </ul>
            <button className="btn" onClick={confirmar}>Entendido, ir a WhatsApp</button>
            <button className="link" style={{ marginTop: 10 }} onClick={() => setPaso('nota')}>Volver</button>
          </div>
        </div>
      )}
    </>
  );
}
