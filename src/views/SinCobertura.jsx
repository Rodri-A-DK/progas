import { useEffect, useState } from 'react';
import { api, C } from '../lib.js';

const OCULTAS = ['PRUEBAS', 'Galpon', 'Puerta Fortunata Garcia', 'Puerta Colon', 'Capital Zona 1', 'Capital Zona 2', 'Capital Zona 3', 'Capital Zona 4'];

export default function SinCobertura({ onVolver }) {
  const [zonas, setZonas] = useState([]);
  useEffect(() => {
    api(`zonas?select=nombre&nombre=not.in.(${OCULTAS.map(n => '"' + n + '"').join(',')})&order=nombre`).then(setZonas).catch(() => { });
  }, []);
  return (
    <>
      <h2>Sin cobertura en tu zona</h2>
      <p className="sub">Actualmente no llegamos a esa ubicación. Contactate con nosotros al <b>{C.TELEFONO_CONTACTO}</b>.</p>
      {zonas.length > 0 && <>
        <p className="hint" style={{ marginBottom: 8 }}>Zonas con cobertura:</p>
        <ul style={{ paddingLeft: 18, fontSize: '.88rem', lineHeight: 1.5 }}>{zonas.map(z => <li key={z.nombre}>{z.nombre}</li>)}</ul>
      </>}
      <a className="btn" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} target="_blank" rel="noopener"
        href={`https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent('¡Hola! Quise hacer un pedido por la web pero mi dirección figura fuera de la zona de cobertura. ¿Pueden ayudarme?')}`}>
        Escribinos por WhatsApp al {C.TELEFONO_CONTACTO}
      </a>
      <button className="link" style={{ marginTop: 12 }} onClick={onVolver}>Probar con otra dirección</button>
    </>
  );
}
