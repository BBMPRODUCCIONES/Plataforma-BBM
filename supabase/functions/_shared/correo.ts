/**
 * Envio de correo de la plataforma, via Resend.
 *
 * Una sola puerta de salida para todo el correo que manda PLANNER, para que el
 * remitente, la plantilla y el manejo de errores no se dupliquen en cada
 * funcion.
 *
 * Regla de oro: si el correo falla, la operacion que lo pidio NO falla. Crear
 * un usuario y que se caiga el correo debe dejar el usuario creado y avisar que
 * el correo no salio, no perder el trabajo. Por eso nada de aqui lanza: se
 * devuelve el resultado y quien llama decide que decir.
 *
 * Secretos que espera:
 *   RESEND_API_KEY   clave de la cuenta de Resend
 *   CORREO_REMITENTE opcional, por defecto el de abajo
 */

const REMITENTE_POR_DEFECTO = "PLANNER BBM <no-responder@bbmjuegos.com>";

export interface ResultadoCorreo {
  enviado: boolean;
  /** Por que no se envio. Solo para los registros y para avisar al admin. */
  motivo?: string;
}

interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

async function enviar({ para, asunto, html, texto }: Correo): Promise<ResultadoCorreo> {
  const clave = Deno.env.get("RESEND_API_KEY");
  if (!clave) {
    // No es una falla: es que todavia no se ha configurado el envio.
    console.warn("[correo] RESEND_API_KEY no esta configurada; no se envia nada.");
    return { enviado: false, motivo: "El envio de correo no esta configurado." };
  }

  const remitente = Deno.env.get("CORREO_REMITENTE") || REMITENTE_POR_DEFECTO;

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: remitente,
        to: [para],
        subject: asunto,
        html,
        text: texto,
      }),
    });

    if (!respuesta.ok) {
      // El cuerpo de Resend dice exactamente que paso (dominio sin verificar,
      // clave invalida, destinatario rechazado). Vale la pena guardarlo.
      const detalle = await respuesta.text();
      console.error(`[correo] Resend respondio ${respuesta.status}: ${detalle}`);
      return { enviado: false, motivo: `Resend respondio ${respuesta.status}.` };
    }

    const datos = await respuesta.json();
    console.log(`[correo] Enviado a ${para}, id ${datos?.id ?? "sin id"}`);
    return { enviado: true };
  } catch (e) {
    console.error("[correo] No se pudo contactar a Resend:", e);
    return { enviado: false, motivo: "No se pudo contactar al servicio de correo." };
  }
}

/** Escapa lo que venga de la base antes de meterlo en el HTML del correo. */
function limpio(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "2026-09-19T15:27:47Z" -> "viernes 19 de septiembre" */
function fechaLarga(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Bogota",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface DatosInvitacion {
  para: string;
  link: string;
  expira: string;
  /** Paneles a los que tendra acceso, en palabras. */
  paneles: string[];
  /** true cuando es una reactivacion y no un ingreso nuevo. */
  reactivacion?: boolean;
}

/**
 * Blanco y negro, un solo boton y el link tambien en texto plano: muchos
 * correos corporativos no pintan los botones, y un link que no se puede copiar
 * es un link que no sirve.
 */
export function correoDeInvitacion(d: DatosInvitacion): Promise<ResultadoCorreo> {
  const titulo = d.reactivacion
    ? "Tu acceso a PLANNER quedó activo otra vez"
    : "Te dieron acceso a PLANNER";
  const entrada = d.reactivacion
    ? "Tu cuenta de PLANNER, la plataforma interna de BBM Producciones, volvió a quedar activa. Para entrar tienes que crear una contraseña nueva:"
    : "Te crearon un acceso a PLANNER, la plataforma interna de BBM Producciones. Para entrar, crea tu contraseña aquí:";

  const paneles = d.paneles.length
    ? `<p style="margin:0 0 16px;font-size:14px;color:#555;">Vas a tener acceso a: ${limpio(d.paneles.join(", "))}.</p>`
    : "";

  const vence = fechaLarga(d.expira);

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f4;font-family:Helvetica,Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e3e3;">
    <tr><td style="padding:28px 28px 8px;">
      <div style="font-size:20px;font-weight:700;letter-spacing:1px;">BBM PRODUCCIONES</div>
      <div style="font-size:12px;color:#777;letter-spacing:2px;text-transform:uppercase;">Producción de eventos</div>
    </td></tr>
    <tr><td style="padding:8px 28px 0;">
      <h1 style="margin:16px 0 12px;font-size:19px;font-weight:700;">${limpio(titulo)}</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#333;">${limpio(entrada)}</p>
      ${paneles}
      <p style="margin:0 0 20px;">
        <a href="${limpio(d.link)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;font-size:14px;font-weight:600;">Crear mi contraseña</a>
      </p>
      <p style="margin:0 0 6px;font-size:13px;color:#555;">Si el botón no abre, copia y pega esta dirección:</p>
      <p style="margin:0 0 20px;font-size:12px;word-break:break-all;"><a href="${limpio(d.link)}" style="color:#111;">${limpio(d.link)}</a></p>
      <p style="margin:0 0 24px;font-size:13px;color:#555;">El enlace vence el <strong>${limpio(vence)}</strong>. Después de esa fecha hay que pedir uno nuevo.</p>
    </td></tr>
    <tr><td style="padding:0 28px 28px;border-top:1px solid #eee;">
      <p style="margin:16px 0 0;font-size:12px;color:#888;line-height:1.5;">
        Si no esperabas este correo, ignóralo: sin crear la contraseña nadie entra a la cuenta.
        Este mensaje se envía solo; no respondas aquí.
      </p>
    </td></tr>
  </table>
</body></html>`;

  const texto = [
    titulo.toUpperCase(),
    "",
    entrada,
    "",
    d.link,
    "",
    d.paneles.length ? `Acceso a: ${d.paneles.join(", ")}.` : "",
    `El enlace vence el ${vence}.`,
    "",
    "Si no esperabas este correo, ignóralo. Este mensaje se envía solo; no respondas aquí.",
  ]
    .filter(Boolean)
    .join("\n");

  return enviar({ para: d.para, asunto: titulo, html, texto });
}
