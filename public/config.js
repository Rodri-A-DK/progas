// Configuración pública (la clave anon ya es pública en la app principal)
window.CFG = {
  SUPABASE_URL: "https://ofiqazminnanuwakjkcv.supabase.co",
  SUPABASE_KEY: "sb_publishable__24QlnixxNwP3DKwFJLdow_ZttfAO9z",
  WHATSAPP: "5493816426900",   // número de WhatsApp que recibe los pedidos (549 + área + número, sin +)
  TELEFONO_CONTACTO: "3816426900",
  ID_RECEPCIONISTA: null,      // <-- CAMBIAR si la tabla pedidos exige id_recepcionista (id de un usuario "Web")
  LISTA_BASE: 6,               // id de la "lista 1" (se usa si la zona del cliente todavía no tiene una lista más usada)
  CENTRO: [-26.834, -65.204]   // centro inicial del mapa (Tucumán)
};
