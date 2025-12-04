import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse request body
    const { token, password, full_name } = await req.json();

    if (!token || !password) {
      return new Response(
        JSON.stringify({ error: 'Token y contraseña son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Strong password validation
    const passwordErrors: string[] = [];
    if (password.length < 8) {
      passwordErrors.push('mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      passwordErrors.push('una letra mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      passwordErrors.push('una letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
      passwordErrors.push('un número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      passwordErrors.push('un carácter especial');
    }

    if (passwordErrors.length > 0) {
      return new Response(
        JSON.stringify({ error: `La contraseña debe contener: ${passwordErrors.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find and validate invitation
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .single();

    if (invError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Token de invitación inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (invitation.accepted_at) {
      return new Response(
        JSON.stringify({ error: 'Esta invitación ya ha sido utilizada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Esta invitación ha expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: invitation.email,
      password: password,
      email_confirm: true // Auto-confirm email
    });

    if (authError || !authData.user) {
      console.error('Error creating user:', authError);
      return new Response(
        JSON.stringify({ error: 'Error al crear el usuario: ' + (authError?.message || 'Unknown error') }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        full_name: full_name || null
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Don't fail the whole operation, profile can be created later
    }

    // Determine allowed panels - use invitation's panels or defaults based on role
    const ALL_PANELS = ['directivo', 'general', 'operaciones', 'proveedores'];
    let allowedPanels: string[];
    
    if (invitation.role === 'administrador') {
      allowedPanels = ALL_PANELS;
    } else if (invitation.allowed_panels && Array.isArray(invitation.allowed_panels)) {
      allowedPanels = invitation.allowed_panels;
    } else {
      // Default panels for non-admin
      allowedPanels = ['general', 'operaciones'];
    }

    // Assign role with allowed_panels
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: invitation.role,
        allowed_panels: allowedPanels
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error al asignar el rol' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Don't fail, user is already created
    }

    console.log('==========================================');
    console.log('USUARIO CREADO EXITOSAMENTE');
    console.log('==========================================');
    console.log(`Email: ${invitation.email}`);
    console.log(`Rol: ${invitation.role}`);
    console.log(`Paneles: ${allowedPanels.join(', ')}`);
    console.log(`User ID: ${userId}`);
    console.log('==========================================');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email: authData.user.email,
          role: invitation.role,
          allowed_panels: allowedPanels
        },
        message: 'Cuenta creada exitosamente. Ya puedes iniciar sesión.'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in accept-invitation:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
