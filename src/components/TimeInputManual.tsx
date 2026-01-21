import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeInputManualProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

// Parse existing value (expected format: "HH:MM" in 24h)
const parseTime = (timeStr: string) => {
  if (!timeStr) return { hours: "09", minutes: "00", period: "AM" };
  const [h, m] = timeStr.split(":");
  let hours = parseInt(h) || 0;
  const minutes = m || "00";
  const period = hours >= 12 ? "PM" : "AM";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return { 
    hours: hours.toString().padStart(2, "0"), 
    minutes: minutes.padStart(2, "0"), 
    period 
  };
};

export function TimeInputManual({ 
  value, 
  onChange, 
  label,
  className 
}: TimeInputManualProps) {
  const { hours, minutes, period } = parseTime(value);

  const handleChange = (newHours: string, newMinutes: string, newPeriod: string) => {
    let h = parseInt(newHours) || 0;
    if (newPeriod === "PM" && h !== 12) h += 12;
    if (newPeriod === "AM" && h === 12) h = 0;
    const formatted = `${h.toString().padStart(2, "0")}:${newMinutes.padStart(2, "0")}`;
    onChange(formatted);
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any numeric input, then normalize
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    
    if (val === "") {
      // Empty input - keep showing current value, don't block
      return;
    }
    
    let num = parseInt(val) || 0;
    
    // Normalize to 1-12 range
    if (num === 0) {
      num = 12;
    } else if (num > 12) {
      // If user types 13+, auto-convert (e.g., 15 -> 3)
      num = num % 12 || 12;
    }
    
    handleChange(num.toString().padStart(2, "0"), minutes, period);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    
    if (val === "") {
      // Empty input - default to 00
      handleChange(hours, "00", period);
      return;
    }
    
    let num = parseInt(val) || 0;
    
    // Cap at 59
    if (num > 59) {
      num = 59;
    }
    
    handleChange(hours, num.toString().padStart(2, "0"), period);
  };

  return (
    <div className={`space-y-1 ${className || ""}`}>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-1">
        <Input
          type="text"
          inputMode="numeric"
          value={hours}
          onChange={handleHoursChange}
          onBlur={(e) => {
            // On blur, ensure we have a valid value
            const val = e.target.value.replace(/\D/g, "");
            if (val === "" || parseInt(val) === 0) {
              handleChange("12", minutes, period);
            }
          }}
          className="w-11 text-center px-1 h-9"
          placeholder="HH"
          maxLength={2}
        />
        <span className="text-muted-foreground font-medium">:</span>
        <Input
          type="text"
          inputMode="numeric"
          value={minutes}
          onChange={handleMinutesChange}
          onBlur={(e) => {
            // On blur, ensure we have a valid value
            const val = e.target.value.replace(/\D/g, "");
            if (val === "") {
              handleChange(hours, "00", period);
            }
          }}
          className="w-11 text-center px-1 h-9"
          placeholder="MM"
          maxLength={2}
        />
        <Select
          value={period}
          onValueChange={(newPeriod) => handleChange(hours, minutes, newPeriod)}
        >
          <SelectTrigger className="w-[70px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

