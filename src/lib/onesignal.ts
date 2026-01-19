// OneSignal Web Push SDK Integration
// App ID: 5086e10d-5653-4368-b13a-cd1a46ba3fac

declare global {
  interface Window {
    OneSignalDeferred?: Array<(onesignal: any) => void>;
    OneSignal?: any;
  }
}

const ONESIGNAL_APP_ID = "5086e10d-5653-4368-b13a-cd1a46ba3fac";

let isInitialized = false;

export async function initOneSignal(): Promise<void> {
  if (isInitialized) return;
  if (typeof window === "undefined") return;

  // Load the OneSignal SDK script
  if (!document.querySelector('script[src*="OneSignalSDK"]')) {
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  
  window.OneSignalDeferred.push(async function(OneSignal: any) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true, // For development
        notifyButton: {
          enable: false, // We handle subscription prompts manually
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false, // We prompt manually after login
                text: {
                  actionMessage: "¿Quieres recibir notificaciones de nuevos eventos y proyectos?",
                  acceptButton: "Sí, activar",
                  cancelButton: "Ahora no",
                },
                delay: {
                  pageViews: 1,
                  timeDelay: 5,
                },
              },
            ],
          },
        },
      });
      
      isInitialized = true;
      console.log("[OneSignal] Initialized successfully");
    } catch (error) {
      console.error("[OneSignal] Initialization error:", error);
    }
  });
}

export async function promptForPushPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !window.OneSignal) {
    console.warn("[OneSignal] SDK not loaded");
    return false;
  }

  try {
    const permission = await window.OneSignal.Notifications.requestPermission();
    console.log("[OneSignal] Permission result:", permission);
    return permission;
  } catch (error) {
    console.error("[OneSignal] Permission request error:", error);
    return false;
  }
}

export async function setExternalUserId(userId: string): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) {
    console.warn("[OneSignal] SDK not loaded");
    return;
  }

  try {
    await window.OneSignal.login(userId);
    console.log("[OneSignal] User linked:", userId);
  } catch (error) {
    console.error("[OneSignal] Error linking user:", error);
  }
}

export async function removeExternalUserId(): Promise<void> {
  if (typeof window === "undefined" || !window.OneSignal) return;

  try {
    await window.OneSignal.logout();
    console.log("[OneSignal] User unlinked");
  } catch (error) {
    console.error("[OneSignal] Error unlinking user:", error);
  }
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

export async function isSubscribed(): Promise<boolean> {
  if (typeof window === "undefined" || !window.OneSignal) return false;

  try {
    const isPushEnabled = await window.OneSignal.User.PushSubscription.optedIn;
    return isPushEnabled;
  } catch {
    return false;
  }
}
