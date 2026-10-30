/*
  CONFIGURACIÓN DE HALLS OF AMENTI
  ─────────────────────────────────────────────────────────────
  Configuración pública de catálogo, contacto, transferencias y tarifas:

  PayPal se configura en variables privadas del servidor

  1) PayPal → PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en el hosting
  2) payments.transfer.*        → datos bancarios para transferencias en CLP
  3) shipping.zones[].usd         → tarifas de envío por zona (en USD)

  Mientras un dato esté vacío (''/null), ese método o destino se muestra
  como "no disponible" / "por cotizar" y el cliente puede pedir cotización por correo.
  Nada de lo que está aquí es secreto: este archivo es público en el navegador.
*/
window.HOA_CONFIG = Object.freeze({
  name: 'Halls of Amenti Records',
  currency: 'USD',
  email: 'hallsofamenti.rec@gmail.com',
  instagram: 'https://www.instagram.com/halls_of_amenti_rec/',
  facebook: 'https://www.facebook.com/share/1Bfd8r7pue/',
  youtube: 'https://youtube.com/@hallsofamenti-rec?si=BsLIkzuZPwm6OCvC',
  bandcamp: 'https://hallsofamenti-rec.bandcamp.com/',

  /* Políticas alojadas en este mismo sitio. */
  policies: {
    terms: 'terminos.html',
    shipping: 'envios.html',
    refund: 'devoluciones.html',
    'legal-notice': 'aviso-legal.html'
  },

  payments: {
    /* PayPal Checkout (cuenta PayPal o tarjeta de crédito/débito). Cobra en USD.
       Client ID: developer.paypal.com → Apps & Credentials → (Live) → tu app → Client ID.
       Para probar sin dinero real usa el Client ID de "Sandbox". */
    paypal: {
      clientId: '' // El servidor entrega el identificador público desde /api/config
    },

    /* Transferencia bancaria (cobra en CLP). Completa al menos titular, banco y número de cuenta. */
    transfer: {
      holder: '',          // Nombre del titular
      rut: '',             // RUT del titular (opcional pero recomendado)
      bank: '',            // Banco
      accountType: '',     // Ej.: Cuenta corriente / Cuenta vista / Cuenta RUT
      accountNumber: '',   // Número de cuenta (el comprobante se recibe en el correo general del sitio: email)
      /* Tipo de cambio opcional (CLP por 1 USD). Úsalo solo si quieres aceptar transferencias de
         productos que no tienen priceCLP en js/productos.js. null = solo productos con precio en CLP. */
      clpPerUsd: null
    }
  },

  /* Envío (tarifas en USD, configuradas para la tienda).
     Se cobra por pedido = usd (primer artículo) + extraUsd por cada artículo adicional.
     countries: códigos ISO de país; '*' = cualquier otro país. usd: null = sin tarifa (queda "por cotizar").
     clp / extraClp: solo se usan para pagar por transferencia en CLP (déjalos en null si no la usas).
     eta: tránsito estimado después del despacho.
     Los países de cada zona los agrupé yo por continente; ajústalos si tu proveedor de envío los agrupa distinto. */
  shipping: {
    zones: [
      { id: 'chile', label: 'Chile', eta: '2–5 días hábiles', countries: ['CL'],
        usd: 5, extraUsd: 1.5, clp: null, extraClp: 0 },
      { id: 'sudamerica', label: 'Sudamérica', eta: '7–14 días hábiles', countries: ['AR', 'BO', 'BR', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE'],
        usd: 14, extraUsd: 3, clp: null, extraClp: 0 },
      { id: 'norteamerica', label: 'Norteamérica', eta: '7–14 días hábiles', countries: ['US', 'CA', 'MX'],
        usd: 16, extraUsd: 3.5, clp: null, extraClp: 0 },
      { id: 'europa-occidental', label: 'Europa occidental', eta: '7–14 días hábiles', countries: ['AD', 'AT', 'AX', 'BE', 'CH', 'DE', 'DK', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LU', 'MC', 'MT', 'NL', 'NO', 'PT', 'SE', 'SM', 'VA'],
        usd: 17, extraUsd: 4, clp: null, extraClp: 0 },
      { id: 'europa-oriental', label: 'Europa oriental', eta: '7–14 días hábiles', countries: ['AL', 'BA', 'BG', 'BY', 'CZ', 'EE', 'HR', 'HU', 'LT', 'LV', 'MD', 'ME', 'MK', 'PL', 'RO', 'RS', 'RU', 'SI', 'SK', 'UA'],
        usd: 18, extraUsd: 4.5, clp: null, extraClp: 0 },
      { id: 'oceania', label: 'Australia y Nueva Zelanda', eta: '7–14 días hábiles', countries: ['AU', 'NZ'],
        usd: 19, extraUsd: 5, clp: null, extraClp: 0 },
      { id: 'asia', label: 'Asia', eta: '7–14 días hábiles', countries: ['BD', 'BN', 'BT', 'CN', 'HK', 'ID', 'IN', 'JP', 'KG', 'KH', 'KR', 'KZ', 'LA', 'LK', 'MM', 'MN', 'MO', 'MV', 'MY', 'NP', 'PH', 'PK', 'SG', 'TH', 'TJ', 'TM', 'TW', 'UZ', 'VN'],
        usd: 18, extraUsd: 5, clp: null, extraClp: 0 },
      /* Cualquier país no listado arriba (Centroamérica, Caribe, África, Medio Oriente, etc.):
         sin tarifa publicada → el cliente pide cotización por correo. */
      { id: 'otros', label: 'Otros destinos', eta: '', countries: ['*'],
        usd: null, extraUsd: 0, clp: null, extraClp: 0 }
    ]
  }
});
