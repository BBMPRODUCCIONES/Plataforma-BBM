import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function computeHash(project: any, eventType: string): string {
  const fields = eventType === 'montaje'
    ? [project.evento, project.cliente, project.ubicacion, project.notas,
       project.fecha_montaje_inicio, project.fecha_montaje_fin,
       project.hora_montaje_inicio, project.hora_montaje_fin,
       project.productor, project.jefe_operaciones, project.estado,
       JSON.stringify(project.personal || [])]
    : [project.evento, project.cliente, project.ubicacion, project.notas,
       project.fecha_ejecucion_inicio, project.fecha_ejecucion_fin,
       project.hora_ejecucion_inicio, project.hora_ejecucion_fin,
       project.productor, project.jefe_operaciones, project.estado,
       JSON.stringify(project.personal || [])];
  
  const str = fields.join('|');
  // Simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function buildDescription(project: any, eventType: string): string {
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
    `📊 Estado: ${estadoMap[project.estado] || project.estado || 'Sin estado'}`,
  ];

  if (eventType === 'montaje') {
    lines.push('', `🕐 Horario Montaje: ${project.hora_montaje_inicio || '08:00'} - ${project.hora_montaje_fin || '18:00'}`);
  } else {
    lines.push('', `🕐 Horario Ejecución: ${project.hora_ejecucion_inicio || '09:00'} - ${project.hora_ejecucion_fin || '22:00'}`);
  }

  if (project.productor) lines.push(`🎬 Productor: ${project.productor}`);
  if (project.jefe_operaciones) lines.push(`👷 Jefe de Operaciones: ${project.jefe_operaciones}`);
  if (project.a_cargo_de) lines.push(`📌 A cargo de: ${project.a_cargo_de}`);

  if (personalList) {
    lines.push('', '👥 Personal asignado:', personalList);
  }

  if (project.notas) {
    lines.push('', `📝 Notas: ${project.notas}`);
  }

  lines.push('', '─────────────────', '🔄 Sincronizado automáticamente desde BBM Producciones');

  return lines.join('\n');
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
    console.error(`Failed to ${existingEventId ? 'update' : 'create'} event:`, errorText);
    // If update fails with 404, the event was deleted in Google; create a new one
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all connected users
    const { data: tokens, error: tokensError } = await supabase
      .from('google_calendar_tokens')
      .select('*');

    if (tokensError || !tokens || tokens.length === 0) {
      console.log('No connected users found');
      return new Response(JSON.stringify({ success: true, message: 'No connected users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active projects with dates
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('is_deleted', false)
      .or('fecha_montaje_inicio.neq.,fecha_ejecucion_inicio.neq.');

    if (projectsError) {
      throw new Error(`Failed to fetch projects: ${projectsError.message}`);
    }

    if (!projects || projects.length === 0) {
      console.log('No projects with dates found');
      return new Response(JSON.stringify({ success: true, message: 'No projects to sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timeZone = 'America/Bogota';
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const token of tokens) {
      let accessToken = token.access_token;
      const calendarId = token.calendar_id || 'primary';

      // Refresh token if expired
      const expiresAt = new Date(token.expires_at);
      if (expiresAt <= new Date()) {
        const newTokens = await refreshAccessToken(token.refresh_token);
        if (!newTokens) {
          console.error(`Failed to refresh token for user ${token.user_id}`);
          continue;
        }
        accessToken = newTokens.access_token;
        await supabase
          .from('google_calendar_tokens')
          .update({
            access_token: accessToken,
            expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', token.user_id);
      }

      // Get existing tracked events for this user
      const { data: existingEvents } = await supabase
        .from('google_calendar_events')
        .select('*')
        .eq('user_id', token.user_id);

      const existingMap = new Map(
        (existingEvents || []).map(e => [`${e.project_id}_${e.event_type}`, e])
      );

      for (const project of projects) {
        // Process montaje
        if (project.fecha_montaje_inicio && project.fecha_montaje_fin) {
          const hash = computeHash(project, 'montaje');
          const key = `${project.id}_montaje`;
          const existing = existingMap.get(key);

          if (existing && existing.project_hash === hash) {
            totalSkipped++;
            continue;
          }

          // All-day event: end date must be exclusive (next day)
          const endDate = new Date(project.fecha_montaje_fin);
          endDate.setDate(endDate.getDate() + 1);
          const endDateStr = endDate.toISOString().split('T')[0];

          const eventData = {
            summary: `[MONTAJE] ${project.evento} - ${project.cliente}`,
            description: buildDescription(project, 'montaje'),
            location: project.ubicacion,
            start: { date: project.fecha_montaje_inicio },
            end: { date: endDateStr },
            colorId: '2',
          };

          const result = await createOrUpdateEvent(
            accessToken, calendarId, eventData,
            existing?.google_event_id
          );

          if (result.success && result.eventId) {
            if (existing) {
              await supabase
                .from('google_calendar_events')
                .update({ google_event_id: result.eventId, project_hash: hash, last_synced_at: new Date().toISOString() })
                .eq('id', existing.id);
              totalUpdated++;
            } else {
              await supabase
                .from('google_calendar_events')
                .insert({
                  user_id: token.user_id,
                  project_id: project.id,
                  event_type: 'montaje',
                  google_event_id: result.eventId,
                  project_hash: hash,
                });
              totalCreated++;
            }
          }
        }

        // Process ejecucion
        if (project.fecha_ejecucion_inicio && project.fecha_ejecucion_fin) {
          const hash = computeHash(project, 'ejecucion');
          const key = `${project.id}_ejecucion`;
          const existing = existingMap.get(key);

          if (existing && existing.project_hash === hash) {
            totalSkipped++;
            continue;
          }

          const startDateTime = `${project.fecha_ejecucion_inicio}T${project.hora_ejecucion_inicio || '09:00'}:00`;
          const endDateTime = `${project.fecha_ejecucion_fin}T${project.hora_ejecucion_fin || '22:00'}:00`;

          const eventData = {
            summary: `[EJECUCIÓN] ${project.evento} - ${project.cliente}`,
            description: buildDescription(project, 'ejecucion'),
            location: project.ubicacion,
            start: { dateTime: startDateTime, timeZone },
            end: { dateTime: endDateTime, timeZone },
            colorId: '9',
          };

          const result = await createOrUpdateEvent(
            accessToken, calendarId, eventData,
            existing?.google_event_id
          );

          if (result.success && result.eventId) {
            if (existing) {
              await supabase
                .from('google_calendar_events')
                .update({ google_event_id: result.eventId, project_hash: hash, last_synced_at: new Date().toISOString() })
                .eq('id', existing.id);
              totalUpdated++;
            } else {
              await supabase
                .from('google_calendar_events')
                .insert({
                  user_id: token.user_id,
                  project_id: project.id,
                  event_type: 'ejecucion',
                  google_event_id: result.eventId,
                  project_hash: hash,
                });
              totalCreated++;
            }
          }
        }
      }
    }

    const message = `Auto-sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} unchanged`;
    console.log(message);

    return new Response(JSON.stringify({ success: true, message, created: totalCreated, updated: totalUpdated, skipped: totalSkipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-calendar-auto-sync:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
