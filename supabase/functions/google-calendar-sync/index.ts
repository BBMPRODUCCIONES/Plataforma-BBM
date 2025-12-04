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

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
  const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
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

async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    colorId?: string;
  }
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to create event:', errorText);
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

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const supabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
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
    const refreshToken = tokenData.refresh_token;
    const calendarId = tokenData.calendar_id || 'primary';

    // Check if token is expired and refresh if needed
    const expiresAt = new Date(tokenData.expires_at);
    if (expiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      const newTokens = await refreshAccessToken(refreshToken);
      if (!newTokens) {
        throw new Error('Failed to refresh access token');
      }

      accessToken = newTokens.access_token;
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update tokens in database
      const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      await supabaseAdmin
        .from('google_calendar_tokens')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    }

    const results: { projectId: string; montaje?: { success: boolean; eventId?: string }; ejecucion?: { success: boolean; eventId?: string } }[] = [];
    const timeZone = 'America/Bogota';

    for (const project of projects) {
      const result: { projectId: string; montaje?: { success: boolean; eventId?: string }; ejecucion?: { success: boolean; eventId?: string } } = {
        projectId: project.id,
      };

      const description = [
        `Cliente: ${project.cliente}`,
        `Ubicación: ${project.ubicacion}`,
        project.notas ? `Notas: ${project.notas}` : '',
      ].filter(Boolean).join('\n');

      // Create Montaje event if option is enabled
      if (syncOptions.montaje && project.fechaMontajeInicio && project.fechaMontajeFin) {
        const startDateTime = `${project.fechaMontajeInicio}T${project.horaMontajeInicio || '08:00'}:00`;
        const endDateTime = `${project.fechaMontajeFin}T${project.horaMontajeFin || '18:00'}:00`;

        const montajeResult = await createCalendarEvent(accessToken, calendarId, {
          summary: `[MONTAJE] ${project.evento} - ${project.cliente}`,
          description,
          location: project.ubicacion,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
          colorId: '8', // Gray
        });

        result.montaje = montajeResult;
      }

      // Create Ejecucion event if option is enabled
      if (syncOptions.ejecucion && project.fechaEjecucionInicio && project.fechaEjecucionFin) {
        const startDateTime = `${project.fechaEjecucionInicio}T${project.horaEjecucionInicio || '09:00'}:00`;
        const endDateTime = `${project.fechaEjecucionFin}T${project.horaEjecucionFin || '22:00'}:00`;

        const ejecucionResult = await createCalendarEvent(accessToken, calendarId, {
          summary: `[EJECUCIÓN] ${project.evento} - ${project.cliente}`,
          description,
          location: project.ubicacion,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
          colorId: '9', // Blue
        });

        result.ejecucion = ejecucionResult;
      }

      results.push(result);
    }

    const successCount = results.filter(r => 
      (r.montaje?.success || !syncOptions.montaje) && 
      (r.ejecucion?.success || !syncOptions.ejecucion)
    ).length;

    console.log(`Synced ${successCount}/${projects.length} projects for user ${user.id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      message: `${successCount} proyecto(s) sincronizado(s) exitosamente`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in google-calendar-sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
