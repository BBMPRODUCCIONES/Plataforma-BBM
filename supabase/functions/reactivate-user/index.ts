import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { correoDeInvitacion } from "../_shared/correo.ts";

/** Los paneles se guardan por clave; en el correo se leen en palabras. */
const NOMBRE_DE_PANEL: Record<string, string> = {
  directivo: "Panel Directivo",
  general: "Panel General",
  operaciones: "Panel Operaciones",
  proveedores: "Proveedores",
  calendar: "Calendario",
  reportes: "Reportes",
};
const enPalabras = (claves: string[]) =>
  claves.map((c) => NOMBRE_DE_PANEL[c] ?? c);


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Valid roles enum
const validRoles = ['administrador', 'operativo', 'visual'] as const;
const validPanels = ['directivo', 'general', 'operaciones', 'proveedores'] as const;

// Schema validation for reactivate user
const reactivateUserSchema = z.object({
  email: z.string()
    .email({ message: "Email inválido" })
    .max(255, "Email muy largo")
    .transform(val => val.toLowerCase().trim()),
  role: z.enum(validRoles, { 
    errorMap: () => ({ message: "Rol inválido. Debe ser: administrador, operativo o visual" })
  }),
  allowed_panels: z.array(z.enum(validPanels)).optional(),
  orphanedUserId: z.string().uuid().optional(), // For cleaning up orphaned auth users
  action: z.enum(['reactivate', 'delete_completely']).optional(), // Action type for orphaned users
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

    // Get current user (admin performing the action)
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
    const validationResult = reactivateUserSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, role, allowed_panels, orphanedUserId, action } = validationResult.data;

    console.log(`[reactivate-user] Starting process for email: ${email}, action: ${action || 'reactivate'}`);

    // ============================================
    // HANDLE DELETE COMPLETELY ACTION
    // ============================================
    if (action === 'delete_completely' && orphanedUserId) {
      console.log(`[reactivate-user] Deleting orphaned user completely: ${orphanedUserId}`);
      
      // Delete from profiles first (if exists)
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', orphanedUserId);
      
      // Delete from auth.users
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(orphanedUserId);
      if (deleteAuthError) {
        console.error('[reactivate-user] Error deleting orphaned auth user:', deleteAuthError);
        return new Response(
          JSON.stringify({ error: 'Error al eliminar el usuario huérfano' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Log the deletion
      await supabaseAdmin
        .from('user_audit_log')
        .insert({
          action: 'DELETE_ORPHANED_USER',
          actor_id: user.id,
          actor_email: actorEmail,
          target_email: email,
          target_id: orphanedUserId,
          panel: 'usuarios',
          details: {
            reason: 'Usuario huérfano eliminado completamente por administrador',
            deleted_at: new Date().toISOString()
          }
        });
      
      console.log(`[reactivate-user] Successfully deleted orphaned user: ${orphanedUserId}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          action: 'deleted',
          message: `Usuario huérfano ${email} eliminado completamente del sistema.`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // STEP 0: Clean up orphaned auth user if exists (for reactivation)
    // ============================================
    if (orphanedUserId) {
      console.log(`[reactivate-user] Cleaning up orphaned auth user: ${orphanedUserId}`);
      
      // Delete from profiles first (if exists)
      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', orphanedUserId);
      
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(orphanedUserId);
      if (deleteAuthError) {
        console.error('[reactivate-user] Error deleting orphaned auth user:', deleteAuthError);
        // Continue anyway - the user might not exist anymore
      } else {
        console.log(`[reactivate-user] Successfully deleted orphaned auth user: ${orphanedUserId}`);
        
        // Log the cleanup
        await supabaseAdmin
          .from('user_audit_log')
          .insert({
            action: 'CLEANUP_ORPHANED_USER',
            actor_id: user.id,
            actor_email: actorEmail,
            target_email: email,
            target_id: orphanedUserId,
            panel: 'usuarios',
            details: {
              reason: 'User existed in auth.users without role assignment - cleaned for reactivation',
              cleaned_at: new Date().toISOString()
            }
          });
      }
    }

    // Determine allowed panels based on role
    const ALL_PANELS = ['directivo', 'general', 'operaciones', 'proveedores'];
    let finalAllowedPanels: string[];
    
    if (role === 'administrador') {
      finalAllowedPanels = ALL_PANELS;
    } else if (allowed_panels && allowed_panels.length > 0) {
      finalAllowedPanels = allowed_panels.filter((p: string) => p !== 'directivo');
    } else {
      finalAllowedPanels = ['general', 'operaciones'];
    }

    // ============================================
    // STEP 1: Check if employee is soft-deleted and reactivate
    // ============================================
    const { data: deletedEmployee, error: empQueryError } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('correo', email)
      .not('deleted_at', 'is', null)
      .maybeSingle();

    let employeeReactivated = false;
    let reactivatedEmployeeId: string | null = null;

    if (deletedEmployee) {
      console.log(`[reactivate-user] Found soft-deleted employee: ${deletedEmployee.id}`);
      
      // Reactivate the employee
      const { error: updateError } = await supabaseAdmin
        .from('employees')
        .update({
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', deletedEmployee.id);

      if (updateError) {
        console.error('[reactivate-user] Error reactivating employee:', updateError);
      } else {
        employeeReactivated = true;
        reactivatedEmployeeId = deletedEmployee.id;
        console.log(`[reactivate-user] Employee ${deletedEmployee.id} reactivated successfully`);
        
        // Log employee reactivation
        await supabaseAdmin
          .from('user_audit_log')
          .insert({
            action: 'REACTIVATE_EMPLOYEE',
            actor_id: user.id,
            actor_email: actorEmail,
            target_email: email,
            target_id: deletedEmployee.id,
            panel: 'usuarios',
            details: {
              employee_name: deletedEmployee.nombre,
              reactivated_at: new Date().toISOString()
            }
          });
      }
    } else {
      console.log(`[reactivate-user] No soft-deleted employee found for ${email}`);
    }

    // ============================================
    // STEP 2: Check if there's an active employee (maybe just reactivated)
    // ============================================
    const { data: activeEmployee } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('correo', email)
      .is('deleted_at', null)
      .maybeSingle();

    let linkedEmployeeId = activeEmployee?.id || null;

    // If no active employee exists, create one
    if (!activeEmployee) {
      console.log(`[reactivate-user] Creating new employee for ${email}`);
      const { data: newEmployee, error: createError } = await supabaseAdmin
        .from('employees')
        .insert({
          nombre: email.split('@')[0],
          correo: email,
          cargo: role === 'administrador' ? 'Administrador' : (role === 'operativo' ? 'Operativo' : 'Visual'),
          telefono: '',
          banco: '',
          tipo_cuenta: '',
          numero_cuenta: ''
        })
        .select()
        .single();

      if (createError) {
        console.error('[reactivate-user] Error creating employee:', createError);
      } else if (newEmployee) {
        linkedEmployeeId = newEmployee.id;
        console.log(`[reactivate-user] Created new employee: ${newEmployee.id}`);
      }
    }

    // ============================================
    // STEP 3: Create new invitation (user must register again)
    // ============================================
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('invitations')
      .insert({
        email,
        role,
        allowed_panels: finalAllowedPanels,
        created_by_admin_id: user.id
      })
      .select()
      .single();

    if (invitationError) {
      console.error('[reactivate-user] Error creating invitation:', invitationError);
      return new Response(
        JSON.stringify({ error: 'Error al crear la invitación de reactivación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate invitation link
    const origin = req.headers.get('origin')
      || Deno.env.get('APP_URL')
      || 'https://planner.bbmjuegos.com';
    const invitationLink = `${origin}/crear-cuenta?token=${invitation.token}`;

    const correo = await correoDeInvitacion({
      para: email,
      link: invitationLink,
      expira: invitation.expires_at,
      paneles: enPalabras(finalAllowedPanels),
      reactivacion: true,
    });

    // ============================================
    // STEP 4: Log the reactivation action
    // ============================================
    await supabaseAdmin
      .from('user_audit_log')
      .insert({
        action: 'REACTIVATE_USER',
        actor_id: user.id,
        actor_email: actorEmail,
        target_email: email,
        target_role: role,
        panel: 'usuarios',
        details: {
          invitation_id: invitation.id,
          employee_reactivated: employeeReactivated,
          employee_id: linkedEmployeeId,
          was_orphaned_user: !!orphanedUserId,
          reactivated_at: new Date().toISOString()
        }
      });

    // Log the link
    console.log('==========================================');
    console.log('USUARIO REACTIVADO - INVITACIÓN CREADA');
    console.log('==========================================');
    console.log(`Email: ${email}`);
    console.log(`Rol: ${role}`);
    console.log(`Paneles: ${finalAllowedPanels.join(', ')}`);
    console.log(`Token: ${invitation.token}`);
    console.log(`Link de invitación: ${invitationLink}`);
    console.log(`Empleado reactivado: ${employeeReactivated}`);
    console.log(`Empleado ID: ${linkedEmployeeId}`);
    console.log(`Era usuario huérfano: ${!!orphanedUserId}`);
    console.log('==========================================');

    return new Response(
      JSON.stringify({
        success: true,
        action: 'reactivated',
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
        correoEnviado: correo.enviado,
        correoMotivo: correo.motivo,
        employeeReactivated,
        reactivatedEmployeeId,
        linkedEmployeeId,
        message: correo.enviado
          ? `Usuario reactivado. Se le envió el link por correo a ${email}.`
          : `Usuario reactivado, pero el correo no salió (${correo.motivo ?? 'motivo desconocido'}). Copia el link y mándaselo tú.`
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reactivate-user:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});