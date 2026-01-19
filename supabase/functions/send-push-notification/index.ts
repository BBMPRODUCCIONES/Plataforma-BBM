import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ONESIGNAL_APP_ID = "5086e10d-5653-4368-b13a-cd1a46ba3fac";
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    if (!ONESIGNAL_REST_API_KEY) {
      console.error("[send-push-notification] ONESIGNAL_REST_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Push notification service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: PushPayload = await req.json();
    console.log("[send-push-notification] Payload:", JSON.stringify(payload));

    // Build OneSignal notification object
    const notification: Record<string, any> = {
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

    console.log("[send-push-notification] Sending to OneSignal:", JSON.stringify(notification));

    const onesignalKey = ONESIGNAL_REST_API_KEY.trim();
    const isRichKey = onesignalKey.startsWith("os_v2_");

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
