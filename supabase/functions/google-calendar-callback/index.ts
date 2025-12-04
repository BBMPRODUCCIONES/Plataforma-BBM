import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This is the user_id
    const error = url.searchParams.get('error');

    console.log('Callback received - code:', !!code, 'state:', state, 'error:', error);

    // Get the frontend URL for redirects
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://qbcwvrtiedzvsurndizd.lovableproject.com';

    if (error) {
      console.error('OAuth error:', error);
      return Response.redirect(`${frontendUrl}/google-calendar?error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !state) {
      console.error('Missing code or state');
      return Response.redirect(`${frontendUrl}/google-calendar?error=missing_params`, 302);
    }

    const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
    const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google credentials not configured');
    }

    // Exchange authorization code for tokens
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const callbackUrl = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token exchange response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return Response.redirect(`${frontendUrl}/google-calendar?error=token_exchange_failed`, 302);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token) {
      console.error('Missing tokens in response');
      return Response.redirect(`${frontendUrl}/google-calendar?error=missing_tokens`, 302);
    }

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Store tokens in database using service role
    const supabaseAdmin = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    );

    // Upsert the tokens (insert or update if exists)
    const { error: dbError } = await supabaseAdmin
      .from('google_calendar_tokens')
      .upsert({
        user_id: state,
        access_token,
        refresh_token,
        expires_at: expiresAt,
        calendar_id: 'primary',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return Response.redirect(`${frontendUrl}/google-calendar?error=db_error`, 302);
    }

    console.log('Tokens stored successfully for user:', state);

    // Redirect back to the app with success
    return Response.redirect(`${frontendUrl}/google-calendar?success=true`, 302);
  } catch (error) {
    console.error('Error in google-calendar-callback:', error);
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://qbcwvrtiedzvsurndizd.lovableproject.com';
    return Response.redirect(`${frontendUrl}/google-calendar?error=server_error`, 302);
  }
});
