import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { promptForPushPermission, isPushSupported, isSubscribed } from "@/lib/onesignal";
import { useAuth } from "@/contexts/AuthContext";

const PROMPT_DISMISSED_KEY = "bbm_notification_prompt_dismissed";
const PROMPT_DELAY = 3000; // Show after 3 seconds

export function NotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const checkAndShow = async () => {
      // Check if already dismissed
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (dismissed) {
        console.log("[NotificationPrompt] Already dismissed");
        return;
      }

      // Check if push is supported
      const supported = await isPushSupported();
      if (!supported) {
        console.log("[NotificationPrompt] Push not supported");
        return;
      }

      // Check if already subscribed
      const subscribed = await isSubscribed();
      if (subscribed) {
        console.log("[NotificationPrompt] Already subscribed");
        return;
      }

      // Show prompt after delay
      setTimeout(() => {
        console.log("[NotificationPrompt] Showing prompt");
        setShow(true);
      }, PROMPT_DELAY);
    };

    checkAndShow();
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const granted = await promptForPushPermission();
      console.log("[NotificationPrompt] Permission result:", granted);
      if (granted) {
        setShow(false);
        localStorage.setItem(PROMPT_DISMISSED_KEY, "accepted");
      }
    } catch (error) {
      console.error("[NotificationPrompt] Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(PROMPT_DISMISSED_KEY, "dismissed");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm z-50 animate-in slide-in-from-bottom-5 duration-300">
      <Card className="bg-card border-primary/20 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">Activar notificaciones</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Recibe alertas cuando se creen, eliminen o restauren eventos.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleEnable}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Activando..." : "Activar"}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
