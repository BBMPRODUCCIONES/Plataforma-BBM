import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  headings: string;
  contents: string;
  // Optional: target specific user(s) by external_user_id
  targetUserIds?: string[];
  // Optional: send to all subscribed users
  sendToAll?: boolean;
  // Optional: additional data
  data?: Record<string, string>;
  // Optional: URL to open on click
  url?: string;
  // Optional: notification type for in-app notifications
  type?: "info" | "success" | "warning" | "error";
  // Optional: create in-app notifications for all users
  createInAppNotifications?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = "5086e10d-5653-4368-b13a-cd1a46ba3fac";
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const payload: PushPayload = await req.json();
    console.log("[send-push-notification] Payload:", JSON.stringify(payload));

    // Create in-app notifications for all users if requested
    if (payload.createInAppNotifications && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Get all user IDs from user_roles table
        const { data: users, error: usersError } = await supabase
          .from("user_roles")
          .select("user_id");

        if (usersError) {
          console.error("[send-push-notification] Error fetching users:", usersError);
        } else if (users && users.length > 0) {
          // Create notifications for all users
          const notifications = users.map((user: { user_id: string }) => ({
            user_id: user.user_id,
            title: payload.headings,
            message: payload.contents,
            type: payload.type || "info",
            read: false,
            data: payload.data || {},
          }));

          const { error: insertError } = await supabase
            .from("notifications")
            .insert(notifications);

          if (insertError) {
            console.error("[send-push-notification] Error creating in-app notifications:", insertError);
          } else {
            console.log("[send-push-notification] Created in-app notifications for", users.length, "users");
          }
        }
      } catch (dbError) {
        console.error("[send-push-notification] Database error:", dbError);
      }
    }

    // If no OneSignal key, skip push but still return success (in-app notifications may have been created)
    if (!ONESIGNAL_REST_API_KEY) {
      console.log("[send-push-notification] ONESIGNAL_REST_API_KEY not configured, skipping push");
      return new Response(
        JSON.stringify({ success: true, message: "In-app notifications created, push skipped (no API key)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build OneSignal notification object
    const notification: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: payload.headings, es: payload.headings },
      contents: { en: payload.contents, es: payload.contents },
    };

    // Target users or send to all
    if (payload.targetUserIds && payload.targetUserIds.length > 0) {
      notification.include_aliases = {
        external_id: payload.targetUserIds,
      };
      notification.target_channel = "push";
    } else if (payload.sendToAll) {
      notification.included_segments = ["Subscribed Users"];
    } else {
      // Default: send to all subscribed users
      notification.included_segments = ["Subscribed Users"];
    }

    // Add optional data
    if (payload.data) {
      notification.data = payload.data;
    }

    // Add URL to open on click
    if (payload.url) {
      notification.url = payload.url;
    }

    const onesignalKey = ONESIGNAL_REST_API_KEY.trim();
    const isRichKey = onesignalKey.startsWith("os_v2_");
    
    console.log("[send-push-notification] Key prefix (first 10 chars):", onesignalKey.substring(0, 10));
    console.log("[send-push-notification] Is Rich Key:", isRichKey);
    console.log("[send-push-notification] Sending to OneSignal:", JSON.stringify(notification));

    const onesignalUrl = isRichKey
      ? "https://api.onesignal.com/notifications"
      : "https://onesignal.com/api/v1/notifications";

    const authorizationHeader = isRichKey
      ? `Key ${onesignalKey}`
      : `Basic ${onesignalKey}`;

    const response = await fetch(onesignalUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authorizationHeader,
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();
    console.log("[send-push-notification] OneSignal response:", JSON.stringify(result));

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to send notification", details: result }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: result.id, recipients: result.recipients }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-push-notification] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
