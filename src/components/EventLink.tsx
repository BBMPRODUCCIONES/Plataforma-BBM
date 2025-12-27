import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface EventLinkProps {
  eventId: string;
  eventName: string;
  isDeleted?: boolean;
  variant?: "text" | "badge" | "chip";
  className?: string;
  /** Optional source identifier for tracking where the navigation came from */
  source?: string;
}

/**
 * Universal clickable event link component.
 * Redirects to Panel Operaciones with the event highlighted.
 * Automatically resets filters to ensure the event is visible.
 */
export const EventLink = ({
  eventId,
  eventName,
  isDeleted = false,
  variant = "text",
  className,
  source = "link",
}: EventLinkProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Navigate to Panel Operaciones with eventId, eventName and source as query params
    const params = new URLSearchParams({
      eventId,
      eventName,
      source,
    });
    navigate(`/panel-operaciones?${params.toString()}`);
  };

  if (variant === "badge" || variant === "chip") {
    return (
      <Badge
        variant={isDeleted ? "destructive" : "secondary"}
        className={cn(
          "cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
          isDeleted && "bg-destructive/20 text-destructive hover:bg-destructive/30",
          className
        )}
        onClick={handleClick}
      >
        {eventName}
      </Badge>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "text-left font-medium transition-colors hover:text-primary hover:underline underline-offset-2 cursor-pointer touch-manipulation min-h-[32px] inline-flex items-center",
        isDeleted && "text-destructive",
        className
      )}
      data-event-link={eventId}
    >
      {eventName}
    </button>
  );
};
