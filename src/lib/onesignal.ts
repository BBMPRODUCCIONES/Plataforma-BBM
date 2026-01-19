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
let sdkReady = false;

/**
 * Helper that ensures OneSignal SDK is loaded before executing callback
 * Uses OneSignalDeferred to queue actions until SDK is ready
 */
function withOneSignal<T>(callback: (OneSignal: any) => Promise<T> | T): Promise<T> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window not available"));
      return;
    }

    // If SDK is already ready, use it directly
    if (sdkReady && window.OneSignal) {
      try {
        const result = callback(window.OneSignal);
        if (result instanceof Promise) {
          result.then(resolve).catch(reject);
        } else {
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
      return;
    }

    // Queue the action for when SDK is ready
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        const result = await callback(OneSignal);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  });
}

export async function initOneSignal(): Promise<void> {
  if (isInitialized) {
    console.log("[OneSignal] Already initialized, skipping");
    return;
  }
  if (typeof window === "undefined") return;

  console.log("[OneSignal] Starting initialization...");

  // Load the OneSignal SDK script if not already loaded
  if (!document.querySelector('script[src*="OneSignalSDK"]')) {
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);
    console.log("[OneSignal] SDK script added to page");
  }

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  
  window.OneSignalDeferred.push(async function(OneSignal: any) {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: "/" },
        serviceWorkerPath: "/OneSignalSDKWorker.js",
        notifyButton: {
          enable: false,
        },
        promptOptions: {
          slidedown: {
            prompts: [
              {
                type: "push",
                autoPrompt: false,
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
      sdkReady = true;
      console.log("[OneSignal] Initialized successfully");
      
      // Log current subscription status
      const permission = await OneSignal.Notifications.permission;
      const optedIn = OneSignal.User?.PushSubscription?.optedIn;
      console.log("[OneSignal] Current state - Permission:", permission, "OptedIn:", optedIn);
      
    } catch (error) {
      console.error("[OneSignal] Initialization error:", error);
    }
  });
}

export async function promptForPushPermission(): Promise<boolean> {
  console.log("[OneSignal] Requesting push permission...");
  
  try {
    const result = await withOneSignal(async (OneSignal) => {
      // First check current permission status
      const currentPermission = await OneSignal.Notifications.permission;
      console.log("[OneSignal] Current permission before request:", currentPermission);
      
      // If already denied, we can't prompt again - browser blocks it
      if (currentPermission === false) {
        console.log("[OneSignal] Permission was previously denied by user");
        return false;
      }
      
      // Request permission
      const granted = await OneSignal.Notifications.requestPermission();
      console.log("[OneSignal] Permission request result:", granted);
      
      // If permission granted, ensure user is opted in
      if (granted === true) {
        try {
          // Opt in the user to push notifications
          await OneSignal.User.PushSubscription.optIn();
          console.log("[OneSignal] User opted in to push notifications");
          
          // Verify subscription
          const optedIn = OneSignal.User.PushSubscription.optedIn;
          console.log("[OneSignal] Subscription confirmed:", optedIn);
          
          return optedIn === true;
        } catch (optInError) {
          console.error("[OneSignal] Error opting in:", optInError);
          return false;
        }
      }
      
      return false;
    });
    
    return result;
  } catch (error) {
    console.error("[OneSignal] Permission request error:", error);
    return false;
  }
}

export async function setExternalUserId(userId: string): Promise<void> {
  console.log("[OneSignal] Linking user:", userId);
  
  try {
    await withOneSignal(async (OneSignal) => {
      await OneSignal.login(userId);
      console.log("[OneSignal] User linked successfully:", userId);
    });
  } catch (error) {
    console.error("[OneSignal] Error linking user:", error);
  }
}

export async function removeExternalUserId(): Promise<void> {
  console.log("[OneSignal] Unlinking user...");
  
  try {
    await withOneSignal(async (OneSignal) => {
      await OneSignal.logout();
      console.log("[OneSignal] User unlinked successfully");
    });
  } catch (error) {
    console.error("[OneSignal] Error unlinking user:", error);
  }
}

export async function isPushSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

export async function isSubscribed(): Promise<boolean> {
  try {
    const result = await withOneSignal(async (OneSignal) => {
      const optedIn = OneSignal.User?.PushSubscription?.optedIn;
      console.log("[OneSignal] isSubscribed check:", optedIn);
      return optedIn === true;
    });
    return result;
  } catch (error) {
    console.error("[OneSignal] Error checking subscription:", error);
    return false;
  }
}

export async function getPermissionStatus(): Promise<"granted" | "denied" | "default"> {
  try {
    const result = await withOneSignal(async (OneSignal) => {
      const permission = await OneSignal.Notifications.permission;
      console.log("[OneSignal] Permission status:", permission);
      
      if (permission === true) return "granted";
      if (permission === false) return "denied";
      return "default";
    });
    return result;
  } catch (error) {
    console.error("[OneSignal] Error getting permission:", error);
    // Fallback to native API
    if (typeof Notification !== "undefined") {
      return Notification.permission;
    }
    return "default";
  }
}

export async function getPushStatus(): Promise<{
  supported: boolean;
  permission: "granted" | "denied" | "default";
  subscribed: boolean;
}> {
  const supported = await isPushSupported();
  const permission = await getPermissionStatus();
  const subscribed = await isSubscribed();
  
  console.log("[OneSignal] Full push status:", { supported, permission, subscribed });
  
  return { supported, permission, subscribed };
}

export async function getDetailedPushStatus(): Promise<{
  supported: boolean;
  permission: "granted" | "denied" | "default";
  subscribed: boolean;
  userId: string | null;
  pushToken: string | null;
}> {
  const supported = await isPushSupported();
  
  let permission: "granted" | "denied" | "default" = "default";
  let subscribed = false;
  let userId: string | null = null;
  let pushToken: string | null = null;
  
  try {
    const result = await withOneSignal(async (OneSignal) => {
      const perm = await OneSignal.Notifications.permission;
      const optedIn = OneSignal.User?.PushSubscription?.optedIn === true;
      const extId = OneSignal.User?.externalId || null;
      const token = OneSignal.User?.PushSubscription?.id || null;
      
      return {
        permission: perm === true ? "granted" : perm === false ? "denied" : "default",
        subscribed: optedIn,
        userId: extId,
        pushToken: token,
      };
    });
    
    permission = result.permission as "granted" | "denied" | "default";
    subscribed = result.subscribed;
    userId = result.userId;
    pushToken = result.pushToken;
  } catch (error) {
    console.error("[OneSignal] Error getting detailed status:", error);
    // Fallback to native API for permission
    if (typeof Notification !== "undefined") {
      permission = Notification.permission;
    }
  }
  
  console.log("[OneSignal] Detailed push status:", { supported, permission, subscribed, userId, pushToken });
  
  return { supported, permission, subscribed, userId, pushToken };
}

export async function activatePushNotifications(): Promise<boolean> {
  console.log("[OneSignal] Activating push notifications...");
  
  try {
    // First ensure OneSignal is initialized
    if (!isInitialized) {
      await initOneSignal();
      // Give it a moment to fully initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const result = await withOneSignal(async (OneSignal) => {
      // Check current permission
      const currentPermission = await OneSignal.Notifications.permission;
      console.log("[OneSignal] Current permission:", currentPermission);
      
      // If already denied by browser, cannot proceed
      if (currentPermission === false) {
        console.log("[OneSignal] Permission denied by browser - user must enable in settings");
        return false;
      }
      
      // Request permission if not granted
      if (currentPermission !== true) {
        console.log("[OneSignal] Requesting permission...");
        const granted = await OneSignal.Notifications.requestPermission();
        console.log("[OneSignal] Permission granted:", granted);
        
        if (granted !== true) {
          return false;
        }
      }
      
      // Opt in to push
      console.log("[OneSignal] Opting in to push...");
      await OneSignal.User.PushSubscription.optIn();
      
      // Verify subscription
      const optedIn = OneSignal.User.PushSubscription.optedIn;
      const pushId = OneSignal.User.PushSubscription.id;
      console.log("[OneSignal] Subscription status - OptedIn:", optedIn, "PushId:", pushId);
      
      return optedIn === true;
    });
    
    return result;
  } catch (error) {
    console.error("[OneSignal] Error activating push:", error);
    return false;
  }
}
