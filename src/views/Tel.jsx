import { useEffect, useRef, useState } from 'react';
import { buscarPorCel, celValido, normalizarCel, store } from '../lib.js';

export default function Tel({ msg, onCliente, onNuevo }) {
  const qs = new URLSearchParams(location.search);
  const link = qs.get('tel') || qs.get('t');
  const [tel, setTel] = useState(link || store.get('pg_tel') || '');
  const [err, setErr] = useState(msg || '');
  const [busy, setBusy] = useState(false);
  const auto = useRef(!!link);

  async function enviar(valor) {
    const cel = normalizarCel(valor);
    if (!celValido(cel)) return setErr('Revisá el número: ingresá código de área y número. Ej: 3815684987');
    setErr(''); setBusy(true);
    try {
      const c = await buscarPorCel(cel);
      if (c) store.set('pg_tel', cel); // se recuerda solo el número de una sesión real (cuenta encontrada o recién registrada)
      c ? onCliente(c) : onNuevo(cel);
    } catch (e) { console.error(e); setBusy(false); setErr('No pudimos conectar. Intentá de nuevo.'); }
  }
  useEffect(() => { if (auto.current && qs.get('auto') !== '0') { auto.current = false; enviar(tel); } }, []);

  return (
    <>
      <h2>¡Hola! 👋</h2><p className="sub">Ingresá tu número de celular para hacer tu pedido. Si ya te registraste antes con algún número, ingresalo y podés hacer tu pedido directamente.</p>
      <form onSubmit={e => { e.preventDefault(); enviar(tel); }}>
        <label>Celular</label>
        <input type="tel" name="tel" autoComplete="tel" inputMode="tel" placeholder="Ej: 381 5123456" value={tel} onChange={e => setTel(e.target.value)} required />
        <p className="hint">Sin 0 ni 15. Ej: 3815123456</p>
        {err && <div className="err">{err}</div>}
        <button className="btn" disabled={busy}>{busy ? <span className="spin" /> : 'Continuar'}</button>
      </form>
    </>
  );
}
