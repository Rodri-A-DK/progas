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
      <button className="btn" onClick={onVolver}>Volver</button>
    </>
  );
}
