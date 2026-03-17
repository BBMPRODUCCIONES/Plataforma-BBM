import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Password validation schema with strong requirements
const passwordSchema = z.string()
  .min(8, "La contraseña debe tener mínimo 8 caracteres")
  .regex(/[A-Z]/, "La contraseña debe contener una letra mayúscula")
  .regex(/[a-z]/, "La contraseña debe contener una letra minúscula")
  .regex(/[0-9]/, "La contraseña debe contener un número")
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "La contraseña debe contener un carácter especial");

// Schema validation for accept invitation
const acceptInvitationSchema = z.object({
  token: z.string().uuid({ message: "Token debe ser un UUID válido" }),
  password: passwordSchema,
  full_name: z.string().max(255, "Nombre muy largo").optional().nullable(),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Body de la petición inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate with zod schema
    const validationResult = acceptInvitationSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { token, password, full_name } = validationResult.data;

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

    // Assign role with allowed_panels, email, and granular permissions
    const permissions = (invitation as any).permissions || {};
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role: invitation.role,
        allowed_panels: allowedPanels,
        email: invitation.email,
        puede_ver_feedback: permissions.puede_ver_feedback ?? false,
        puede_editar_feedback: permissions.puede_editar_feedback ?? false,
        puede_aprobar_caja_menor: permissions.puede_aprobar_caja_menor ?? false,
        puede_crear_anticipos: permissions.puede_crear_anticipos ?? false,
        puede_editar_general: permissions.puede_editar_general ?? false,
        puede_editar_operaciones: permissions.puede_editar_operaciones ?? false,
        puede_editar_directivo: permissions.puede_editar_directivo ?? false,
        puede_editar_personal: permissions.puede_editar_personal ?? false,
        puede_editar_inventario: permissions.puede_editar_inventario ?? false,
        puede_asignar_responsables: permissions.puede_asignar_responsables ?? false,
        puede_restaurar_solicitudes: permissions.puede_restaurar_solicitudes ?? false,
        puede_ajustar_base_caja_menor: permissions.puede_ajustar_base_caja_menor ?? false,
        puede_desembolsar: permissions.puede_desembolsar ?? false,
        puede_acceder_aprobaciones: permissions.puede_acceder_aprobaciones ?? false,
        puede_acceder_usuarios: permissions.puede_acceder_usuarios ?? true,
        puede_acceder_clientes: permissions.puede_acceder_clientes ?? true,
        puede_acceder_empleados: permissions.puede_acceder_empleados ?? true,
        puede_acceder_constructor: permissions.puede_acceder_constructor ?? true,
        puede_acceder_agentes: permissions.puede_acceder_agentes ?? true,
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      return new Response(
        JSON.stringify({ error: 'Error al asignar el rol' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // AUTO-CREATE EMPLOYEE (1:1 linking by email)
    // ============================================
    let employeeId: string | null = null;
    let employeeCreated = false;
    let employeeReactivated = false;

    // Check if employee exists (active or soft-deleted)
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id, deleted_at')
      .eq('correo', invitation.email)
      .maybeSingle();

    if (existingEmployee) {
      employeeId = existingEmployee.id;
      
      // If soft-deleted, reactivate
      if (existingEmployee.deleted_at) {
        const { error: reactivateError } = await supabase
          .from('employees')
          .update({ deleted_at: null, deleted_by: null })
          .eq('id', existingEmployee.id);
        
        if (!reactivateError) {
          employeeReactivated = true;
          console.log(`[accept-invitation] Reactivated employee ${existingEmployee.id}`);
        }
      }
    } else {
      // Create new employee
      const { data: newEmployee, error: empError } = await supabase
        .from('employees')
        .insert({
          nombre: full_name || invitation.email.split('@')[0],
          correo: invitation.email,
          cargo: invitation.role === 'administrador' ? 'Administrador' : 
                 (invitation.role === 'operativo' ? 'Operativo' : 'Visual'),
          telefono: '',
          banco: '',
          tipo_cuenta: '',
          numero_cuenta: ''
        })
        .select('id')
        .single();

      if (!empError && newEmployee) {
        employeeId = newEmployee.id;
        employeeCreated = true;
        console.log(`[accept-invitation] Created employee ${newEmployee.id} for ${invitation.email}`);
      } else {
        console.error('[accept-invitation] Error creating employee:', empError);
      }
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
    }

    console.log('==========================================');
    console.log('USUARIO CREADO EXITOSAMENTE');
    console.log('==========================================');
    console.log(`Email: ${invitation.email}`);
    console.log(`Rol: ${invitation.role}`);
    console.log(`Paneles: ${allowedPanels.join(', ')}`);
    console.log(`User ID: ${userId}`);
    console.log(`Employee ID: ${employeeId}`);
    console.log(`Employee Created: ${employeeCreated}`);
    console.log(`Employee Reactivated: ${employeeReactivated}`);
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
