import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const deleteUserSchema = z.object({
  user_id: z.string().uuid({ message: "user_id debe ser un UUID válido" }),
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticated user client (to read current user)
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Body de la petición inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validation = deleteUserSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map((e) => e.message).join(", ");
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id } = validation.data;

    if (user_id === user.id) {
      return new Response(
        JSON.stringify({ error: "No puedes eliminar tu propio usuario desde aquí." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify requester is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "administrador")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Acceso denegado. Se requiere rol de administrador." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[delete-user] Request by ${user.id} to delete ${user_id}`);

    // Get target user info before deletion for audit
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("email, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const targetEmail = targetRole?.email || "unknown";
    const targetRoleValue = targetRole?.role || "unknown";

    // Delete auth user
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (authDeleteError) {
      console.error("[delete-user] Error deleting auth user:", authDeleteError);
      return new Response(
        JSON.stringify({ error: `No se pudo eliminar el usuario: ${authDeleteError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Best-effort cleanup public tables
    const [{ error: rolesDeleteError }, { error: profileDeleteError }] = await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", user_id),
      supabaseAdmin.from("profiles").delete().eq("id", user_id),
    ]);

    if (rolesDeleteError) console.error("[delete-user] Error deleting user_roles:", rolesDeleteError);
    if (profileDeleteError) console.error("[delete-user] Error deleting profile:", profileDeleteError);

    // Get actor email for audit
    const { data: actorRole } = await supabaseAdmin
      .from("user_roles")
      .select("email")
      .eq("user_id", user.id)
      .maybeSingle();

    // Log to audit table
    const { error: auditError } = await supabaseAdmin.from("user_audit_log").insert({
      action: "DELETE_USER",
      actor_id: user.id,
      actor_email: actorRole?.email || user.email || "unknown",
      target_id: user_id,
      target_email: targetEmail,
      target_role: targetRoleValue,
      panel: "usuarios",
      details: { deleted_at: new Date().toISOString() },
    });

    if (auditError) {
      console.error("[delete-user] Error creating audit log:", auditError);
    }

    console.log(`[delete-user] Deleted user ${user_id} (${targetEmail}) successfully`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in delete-user:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
