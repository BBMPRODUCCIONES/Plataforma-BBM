import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid roles enum
const validRoles = ['administrador', 'operativo', 'visual'] as const;
const validPanels = ['directivo', 'general', 'operaciones', 'proveedores'] as const;

// Schema validation for create invitation
const createInvitationSchema = z.object({
  email: z.string()
    .email({ message: "Email inválido" })
    .max(255, "Email muy largo")
    .transform(val => val.toLowerCase().trim()),
  role: z.enum(validRoles, { 
    errorMap: () => ({ message: "Rol inválido. Debe ser: administrador, operativo o visual" })
  }),
  allowed_panels: z.array(z.enum(validPanels)).optional(),
  permissions: z.object({
    puede_ver_feedback: z.boolean().optional(),
    puede_editar_feedback: z.boolean().optional(),
    puede_aprobar_caja_menor: z.boolean().optional(),
    puede_crear_anticipos: z.boolean().optional(),
    puede_editar_general: z.boolean().optional(),
    puede_editar_operaciones: z.boolean().optional(),
    puede_editar_directivo: z.boolean().optional(),
    puede_editar_personal: z.boolean().optional(),
    puede_editar_inventario: z.boolean().optional(),
    puede_asignar_responsables: z.boolean().optional(),
    puede_restaurar_solicitudes: z.boolean().optional(),
    puede_acceder_usuarios: z.boolean().optional(),
    puede_acceder_clientes: z.boolean().optional(),
    puede_acceder_empleados: z.boolean().optional(),
    puede_acceder_constructor: z.boolean().optional(),
    puede_acceder_agentes: z.boolean().optional(),
  }).optional(),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify they're authenticated
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, email')
      .eq('user_id', user.id)
      .eq('role', 'administrador')
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Acceso denegado. Se requiere rol de administrador.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actorEmail = roleData.email || user.email || 'admin@unknown.com';

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
    const validationResult = createInvitationSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, role, allowed_panels, permissions } = validationResult.data;

    // Determine allowed panels based on role
    const ALL_PANELS = ['directivo', 'general', 'operaciones', 'proveedores'];
    let finalAllowedPanels: string[];
    
    if (role === 'administrador') {
      // Admin always gets all panels
      finalAllowedPanels = ALL_PANELS;
    } else if (allowed_panels && allowed_panels.length > 0) {
      // Use provided panels but exclude directivo for non-admins
      finalAllowedPanels = allowed_panels.filter((p: string) => p !== 'directivo');
    } else {
      // Default panels for non-admin roles
      finalAllowedPanels = ['general', 'operaciones'];
    }

    // ============================================
    // VALIDATION 1: Check if email exists in auth.users (existing user)
    // ============================================
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email);
    
    if (existingUser) {
      // Check if user has a role (active user) or is orphaned (no role)
      const { data: userRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id)
        .maybeSingle();

      if (userRole) {
        // User is fully active - cannot create invitation
        return new Response(
          JSON.stringify({ 
            error: 'Este correo ya está registrado como usuario activo. No se puede crear una invitación para un usuario existente.',
            existingUserId: existingUser.id 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // User exists in auth but has no role - orphaned user
        console.log(`[create-invitation] Found orphaned user (no role): ${email}`);
        
        // Get profile info if exists
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, created_at')
          .eq('id', existingUser.id)
          .maybeSingle();
        
        // Check if we already logged this orphaned user
        const { data: existingOrphanLog } = await supabaseAdmin
          .from('user_audit_log')
          .select('id')
          .eq('target_id', existingUser.id)
          .eq('action', 'INCOMPLETE_DELETION_DETECTED')
          .maybeSingle();
        
        // If not logged yet, log it now
        if (!existingOrphanLog) {
          await supabaseAdmin
            .from('user_audit_log')
            .insert({
              action: 'INCOMPLETE_DELETION_DETECTED',
              actor_id: user.id,
              actor_email: actorEmail,
              target_email: email,
              target_id: existingUser.id,
              panel: 'usuarios',
              details: {
                reason: 'Usuario detectado en auth.users sin registro en user_roles (eliminación incompleta)',
                detected_at: new Date().toISOString(),
                full_name: profile?.full_name || email.split('@')[0]
              }
            });
          console.log(`[create-invitation] Logged orphaned user detection for ${email}`);
        }
        
        return new Response(
          JSON.stringify({
            needsReactivation: true,
            isOrphanedUser: true,
            orphanedUserId: existingUser.id,
            deletedUser: { 
              target_email: email, 
              created_at: existingUser.created_at,
              full_name: profile?.full_name || null
            },
            deletedEmployee: null,
            message: 'Este usuario existe pero no tiene rol asignado (datos incompletos). ¿Deseas limpiar y reinvitar o eliminar completamente?'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================
    // NEW: Check if email was previously deleted (in audit log)
    // ============================================
    const { data: deletedUserLog } = await supabaseAdmin
      .from('user_audit_log')
      .select('*')
      .eq('action', 'DELETE_USER')
      .eq('target_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ============================================
    // NEW: Check if employee with this email is soft-deleted
    // ============================================
    const { data: deletedEmployee } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('correo', email)
      .not('deleted_at', 'is', null)
      .maybeSingle();

    // If we found a deleted user or soft-deleted employee, return needsReactivation
    if (deletedUserLog || deletedEmployee) {
      console.log(`[create-invitation] Detected previously deleted user/employee: ${email}`);
      console.log(`[create-invitation] Deleted user log:`, deletedUserLog);
      console.log(`[create-invitation] Deleted employee:`, deletedEmployee);
      
      return new Response(
        JSON.stringify({
          needsReactivation: true,
          isOrphanedUser: false,
          deletedUser: deletedUserLog,
          deletedEmployee: deletedEmployee,
          message: 'Este correo fue previamente eliminado. ¿Deseas reactivar el usuario?'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // VALIDATION 2: Check if there's a pending invitation for this email
    // ============================================
    const { data: existingInvitation } = await supabaseAdmin
      .from('invitations')
      .select('*')
      .eq('email', email)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvitation) {
      return new Response(
        JSON.stringify({ error: 'Ya existe una invitación pendiente para este email' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // VALIDATION 3: Check if email exists in employees table (active)
    // ============================================
    const { data: existingEmployee } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('correo', email)
      .is('deleted_at', null)
      .maybeSingle();

    let employeeLinked = false;
    let linkedEmployeeId: string | null = null;
    let employeeCreated = false;

    if (existingEmployee) {
      // Employee exists with this email - we'll link to this employee
      // Don't create a new employee, just note that we're linking
      employeeLinked = true;
      linkedEmployeeId = existingEmployee.id;
      console.log(`[create-invitation] Found existing employee with email ${email}, will link invitation to employee ${existingEmployee.id}`);
    } else {
      // ============================================
      // CREATE NEW EMPLOYEE (Caso A: email no existe)
      // ============================================
      console.log(`[create-invitation] No existing employee found for ${email}, creating new employee...`);
      
      const { data: newEmployee, error: employeeError } = await supabaseAdmin
        .from('employees')
        .insert({
          nombre: email.split('@')[0], // Nombre temporal basado en email
          correo: email,
          cargo: role === 'administrador' ? 'Administrador' : (role === 'operativo' ? 'Operativo' : 'Visual'),
          telefono: '',
          banco: '',
          tipo_cuenta: '',
          numero_cuenta: ''
        })
        .select()
        .single();

      if (employeeError) {
        console.error('[create-invitation] Error creating employee:', employeeError);
        // Don't fail the invitation, just log the error
      } else if (newEmployee) {
        employeeCreated = true;
        linkedEmployeeId = newEmployee.id;
        console.log(`[create-invitation] Created new employee ${newEmployee.id} for email ${email}`);
      }
    }

    // Create invitation with allowed_panels and permissions
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        role,
        allowed_panels: finalAllowedPanels,
        created_by_admin_id: user.id,
        permissions: permissions || {}
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Error al crear la invitación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation link
    const origin = req.headers.get('origin') || 'https://lovable.dev';
    const invitationLink = `${origin}/crear-cuenta?token=${invitation.token}`;

    // Log the link (simulating email send)
    console.log('==========================================');
    console.log('INVITACIÓN CREADA');
    console.log('==========================================');
    console.log(`Email: ${email}`);
    console.log(`Rol: ${role}`);
    console.log(`Paneles: ${finalAllowedPanels.join(', ')}`);
    console.log(`Token: ${invitation.token}`);
    console.log(`Link de invitación: ${invitationLink}`);
    console.log(`Expira: ${invitation.expires_at}`);
    if (employeeLinked) {
      console.log(`Empleado existente vinculado: ${linkedEmployeeId}`);
    }
    if (employeeCreated) {
      console.log(`Nuevo empleado creado: ${linkedEmployeeId}`);
    }
    console.log('==========================================');

    return new Response(
      JSON.stringify({
        success: true,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          allowed_panels: finalAllowedPanels,
          token: invitation.token,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at
        },
        link: invitationLink,
        employeeLinked,
        employeeCreated,
        linkedEmployeeId,
        message: employeeLinked 
          ? `Invitación creada. Se vinculará al empleado existente (${existingEmployee?.nombre || email}).`
          : employeeCreated
            ? `Invitación creada y empleado creado automáticamente.`
            : 'Invitación creada. El link ha sido registrado en los logs (simulación de envío de email).'
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in create-invitation:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});