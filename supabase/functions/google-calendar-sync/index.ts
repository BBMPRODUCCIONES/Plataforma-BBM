import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Project {
  id: string;
  evento: string;
  cliente: string;
  ubicacion: string;
  notas: string;
  productor?: string;
  jefeOperaciones?: string;
  aCargoeDe?: string;
  estado?: string;
  personal?: any[];
  fechaMontajeInicio: string;
  fechaMontajeFin: string;
  horaMontajeInicio: string;
  horaMontajeFin: string;
  fechaEjecucionInicio: string;
  fechaEjecucionFin: string;
  horaEjecucionInicio: string;
  horaEjecucionFin: string;
}

interface SyncOptions {
  montaje: boolean;
  ejecucion: boolean;
}

function buildDescription(project: Project, eventType: string): string {
  const personalList = Array.isArray(project.personal)
    ? project.personal.map((p: any) => `  • ${p.nombre || p.proveedor || 'Sin nombre'} (${p.cargo || p.tipoProductoServicio || ''})`).join('\n')
    : '';

  const estadoMap: Record<string, string> = {
    'por_planear': '📋 Por planear',
    'en_ejecucion': '🔄 En ejecución',
    'ejecutado': '✅ Ejecutado',
    'facturado': '💰 Facturado',
    'cobrado': '🏦 Cobrado',
    'cancelado': '❌ Cancelado',
  };

  const lines = [
    `📋 Evento: ${project.evento || 'Sin nombre'}`,
    `👤 Cliente: ${project.cliente || 'Sin cliente'}`,
    `📍 Ubicación: ${project.ubicacion || 'Sin ubicación'}`,
    '',
    `📊 Estado: ${estadoMap[project.estado || ''] || project.estado || 'Sin estado'}`,
  ];

  if (eventType === 'montaje') {
    lines.push('', `🕐 Horario Montaje: ${project.horaMontajeInicio || '08:00'} - ${project.horaMontajeFin || '18:00'}`);
  } else {
    lines.push('', `🕐 Horario Ejecución: ${project.horaEjecucionInicio || '09:00'} - ${project.horaEjecucionFin || '22:00'}`);
  }

  if (project.productor) lines.push(`🎬 Productor: ${project.productor}`);
  if (project.jefeOperaciones) lines.push(`👷 Jefe de Operaciones: ${project.jefeOperaciones}`);
  if (project.aCargoeDe) lines.push(`📌 A cargo de: ${project.aCargoeDe}`);

  if (personalList) {
    lines.push('', '👥 Personal asignado:', personalList);
  }

  if (project.notas) {
    lines.push('', `📝 Notas: ${project.notas}`);
  }

  lines.push('', '─────────────────', '🔄 Sincronizado desde BBM Producciones');

  return lines.join('\n');
}

function computeHash(project: Project, eventType: string): string {
  const fields = eventType === 'montaje'
    ? [project.evento, project.cliente, project.ubicacion, project.notas,
       project.fechaMontajeInicio, project.fechaMontajeFin,
       project.horaMontajeInicio, project.horaMontajeFin,
       project.productor, project.jefeOperaciones, project.estado,
       JSON.stringify(project.personal || [])]
    : [project.evento, project.cliente, project.ubicacion, project.notas,
       project.fechaEjecucionInicio, project.fechaEjecucionFin,
       project.horaEjecucionInicio, project.horaEjecucionFin,
       project.productor, project.jefeOperaciones, project.estado,
       JSON.stringify(project.personal || [])];
  
  const str = fields.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    console.error('Failed to refresh token:', await response.text());
    return null;
  }
  return await response.json();
}

async function createOrUpdateEvent(
  accessToken: string,
  calendarId: string,
  eventData: any,
  existingEventId?: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const url = existingEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: existingEventId ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (existingEventId && response.status === 404) {
      return createOrUpdateEvent(accessToken, calendarId, eventData);
    }
    return { success: false, error: errorText };
  }

  const data = await response.json();
  return { success: true, eventId: data.id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { projects, syncOptions }: { projects: Project[]; syncOptions: SyncOptions } = await req.json();

    if (!projects || projects.length === 0) {
      throw new Error('No projects provided');
    }

    // Get user's tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('google_calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Google Calendar not connected');
    }

    let accessToken = tokenData.access_token;
    const calendarId = tokenData.calendar_id || 'primary';

    // Refresh if expired
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt <= new Date()) {
      const newTokens = await refreshAccessToken(tokenData.refresh_token);
      if (!newTokens) throw new Error('Failed to refresh access token');

      accessToken = newTokens.access_token;
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabaseAdmin
        .from('google_calendar_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get existing tracked events for this user
    const { data: existingEvents } = await supabaseAdmin
      .from('google_calendar_events')
      .select('*')
      .eq('user_id', user.id);

    const existingMap = new Map(
      (existingEvents || []).map(e => [`${e.project_id}_${e.event_type}`, e])
    );

    const results: any[] = [];
    const timeZone = 'America/Bogota';

    for (const project of projects) {
      const result: any = { projectId: project.id };

      // Montaje
      if (syncOptions.montaje && project.fechaMontajeInicio && project.fechaMontajeFin) {
        const hash = computeHash(project, 'montaje');
        const key = `${project.id}_montaje`;
        const existing = existingMap.get(key);

        // All-day event: end date must be exclusive (next day)
        const endDate = new Date(project.fechaMontajeFin);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const eventData = {
          summary: `[MONTAJE] ${project.evento} - ${project.cliente}`,
          description: buildDescription(project, 'montaje'),
          location: project.ubicacion,
          start: { date: project.fechaMontajeInicio },
          end: { date: endDateStr },
          colorId: '2',
        };

        const syncResult = await createOrUpdateEvent(accessToken, calendarId, eventData, existing?.google_event_id);
        result.montaje = syncResult;

        if (syncResult.success && syncResult.eventId) {
          if (existing) {
            await supabaseAdmin
              .from('google_calendar_events')
              .update({ google_event_id: syncResult.eventId, project_hash: hash, last_synced_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('google_calendar_events')
              .insert({
                user_id: user.id,
                project_id: project.id,
                event_type: 'montaje',
                google_event_id: syncResult.eventId,
                project_hash: hash,
              });
          }
        }
      }

      // Ejecucion
      if (syncOptions.ejecucion && project.fechaEjecucionInicio && project.fechaEjecucionFin) {
        const hash = computeHash(project, 'ejecucion');
        const key = `${project.id}_ejecucion`;
        const existing = existingMap.get(key);

        // All-day event: end date must be exclusive (next day)
        const endDate = new Date(project.fechaEjecucionFin);
        endDate.setDate(endDate.getDate() + 1);
        const endDateStr = endDate.toISOString().split('T')[0];

        const eventData = {
          summary: `[EJECUCIÓN] ${project.evento} - ${project.cliente}`,
          description: buildDescription(project, 'ejecucion'),
          location: project.ubicacion,
          start: { date: project.fechaEjecucionInicio },
          end: { date: endDateStr },
          colorId: '9',
        };

        const syncResult = await createOrUpdateEvent(accessToken, calendarId, eventData, existing?.google_event_id);
        result.ejecucion = syncResult;

        if (syncResult.success && syncResult.eventId) {
          if (existing) {
            await supabaseAdmin
              .from('google_calendar_events')
              .update({ google_event_id: syncResult.eventId, project_hash: hash, last_synced_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('google_calendar_events')
              .insert({
                user_id: user.id,
                project_id: project.id,
                event_type: 'ejecucion',
                google_event_id: syncResult.eventId,
                project_hash: hash,
              });
          }
        }
      }

      results.push(result);
    }

    const successCount = results.filter(r =>
      (r.montaje?.success || !syncOptions.montaje) &&
      (r.ejecucion?.success || !syncOptions.ejecucion)
    ).length;

    return new Response(JSON.stringify({
      success: true,
      results,
      message: `${successCount} proyecto(s) sincronizado(s) exitosamente`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-calendar-sync:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
