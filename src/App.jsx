import { useState } from 'react';
import { patch, resolverZonaLista } from './lib.js';
import Tel from './views/Tel.jsx';
import Ubicacion from './views/Ubicacion.jsx';
import Pedido from './views/Pedido.jsx';
import SinCobertura from './views/SinCobertura.jsx';

export default function App() {
  const [vista, setVista] = useState('tel');
  const [cliente, setCliente] = useState(null);
  const [celular, setCelular] = useState('');
  const [msg, setMsg] = useState('');

  async function entrar(c) {
    setCliente(c);
    if (!c.latitud || !c.longitud) return setVista('loc');
    if (c.id_lista_precio) return setVista('pedido');
    setVista('cargando');
    try {
      const zl = await resolverZonaLista(+c.latitud, +c.longitud);
      if (!zl.id_lista_precio) return setVista('sin');
      setCliente((await patch(`clientes?id_cliente=eq.${c.id_cliente}`, zl))[0] || { ...c, ...zl });
      setVista('pedido');
    } catch { setMsg('No pudimos cargar tus datos. Intentá de nuevo.'); setVista('tel'); }
  }
  const guardado = ({ sin, cliente: c, existente }) => {
    if (sin) return setVista('sin');
    existente ? entrar(c) : (setCliente(c), setVista('pedido'));
  };

  return (
    <div className="wrap">
      <div className="logo"><div><img src="logo.png" alt="ProGas" /></div></div>
      <div className="card">
        {vista === 'cargando' && <p className="center"><span className="spin" /></p>}
        {vista === 'tel' && <Tel msg={msg} onCliente={entrar} onNuevo={cel => { setCelular(cel); setVista('loc'); }} />}
        {vista === 'loc' && <Ubicacion cliente={cliente} celular={celular} onCancel={cliente?.latitud ? () => setVista('pedido') : null} onGuardado={guardado} />}
        {vista === 'pedido' && <Pedido cliente={cliente} onCambiar={() => setVista('loc')} onSalir={() => { setCliente(null); setMsg(''); setVista('tel'); }} />}
        {vista === 'sin' && <SinCobertura onVolver={() => setVista('loc')} />}
      </div>
    </div>
  );
}
