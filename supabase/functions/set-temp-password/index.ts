import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const esquema = z.object({
  user_id: z.string().uuid({ message: "Usuario inválido" }),
});

/**
 * Genera la contraseña temporal aquí, en el servidor.
 *
 * A proposito NO se deja que el administrador la escriba: una clave tecleada
 * a mano termina siendo la misma de siempre, o uno de esos "Bbm2026*" que se
 * adivinan. Ademas, asi nadie manda una contraseña por el chat ni queda
 * escrita en el navegador de quien invita.
 *
 * Se excluyen los caracteres que se confunden al dictarla por telefono o
 * WhatsApp: O y 0, l, I y 1. Una clave temporal que no se puede dictar sin
 * equivocarse no sirve de nada.
 */
function claveTemporal(): string {
  const MAYUS = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const MINUS = "abcdefghijkmnpqrstuvwxyz";
  const NUMS = "23456789";
  const SIGNOS = "!@#$%*";
  const TODO = MAYUS + MINUS + NUMS + SIGNOS;

  const azar = (alfabeto: string) => {
    // rejection sampling: tomar el modulo directo sesga hacia las primeras
    // letras del alfabeto, y en una clave eso es un regalo para quien adivine.
    const limite = Math.floor(256 / alfabeto.length) * alfabeto.length;
    const b = new Uint8Array(1);
    let v: number;
    do { crypto.getRandomValues(b); v = b[0]; } while (v >= limite);
    return alfabeto[v % alfabeto.length];
  };

  // Una de cada tipo asegura que cumpla las reglas de la pantalla; el resto
  // al azar entre todos.
  const caracteres = [azar(MAYUS), azar(MINUS), azar(NUMS), azar(SIGNOS)];
  while (caracteres.length < 14) caracteres.push(azar(TODO));

  // Barajar, para que los cuatro obligatorios no queden siempre al principio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const b = new Uint8Array(1);
    let j: number;
    const limite = Math.floor(256 / (i + 1)) * (i + 1);
    do { crypto.getRandomValues(b); j = b[0]; } while (j >= limite);
    j = j % (i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join("");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const comoUsuario = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: errorUsuario } = await comoUsuario.auth.getUser();
    if (errorUsuario || !user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Solo administradores. Se consulta con la llave de servicio para que la
    // comprobacion no dependa de las politicas de lectura del que pregunta.
    const { data: rol } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'administrador')
      .single();

    if (!rol) {
      return new Response(JSON.stringify({ error: 'Acceso denegado. Se requiere rol de administrador.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let cuerpo;
    try { cuerpo = await req.json(); } catch {
      return new Response(JSON.stringify({ error: 'Body de la petición inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validacion = esquema.safeParse(cuerpo);
    if (!validacion.success) {
      return new Response(JSON.stringify({ error: validacion.error.errors.map(e => e.message).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { user_id } = validacion.data;

    // Un administrador no se pone una clave temporal a si mismo: se quedaria
    // obligado a cambiarla en la siguiente pantalla sin necesidad, y si se
    // equivoca de fila se saca a si mismo de la sesion.
    if (user_id === user.id) {
      return new Response(JSON.stringify({ error: 'Para cambiar tu propia contraseña usa "Cambiar contraseña", no esta opción.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: destino, error: errorDestino } = await admin.auth.admin.getUserById(user_id);
    if (errorDestino || !destino?.user) {
      return new Response(JSON.stringify({ error: 'Ese usuario no existe.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const clave = claveTemporal();

    // Se conserva el resto de user_metadata: escribir solo la bandera borraria
    // lo que hubiera ahi (el nombre, por ejemplo).
    const metadatos = {
      ...(destino.user.user_metadata || {}),
      debe_cambiar_password: true,
      password_temporal_puesta_en: new Date().toISOString(),
      password_temporal_puesta_por: user.email ?? null,
    };

    const { error: errorCambio } = await admin.auth.admin.updateUserById(user_id, {
      password: clave,
      user_metadata: metadatos,
    });

    if (errorCambio) {
      console.error('[set-temp-password] updateUserById:', errorCambio);
      return new Response(JSON.stringify({ error: 'No se pudo cambiar la contraseña.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Queda constancia de quien se la cambio a quien. La clave NO se registra.
    console.log(`[set-temp-password] ${user.email} puso clave temporal a ${destino.user.email}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: destino.user.email,
        // Se devuelve una sola vez. No queda guardada en ninguna parte: ni en
        // la base, ni en los registros, ni en el navegador.
        password: clave,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[set-temp-password] error:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
