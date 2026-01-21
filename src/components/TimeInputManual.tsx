import { useState, useEffect, useRef } from "react";
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
  const parsed = parseTime(value);
  
  // Local state for free typing
  const [localHours, setLocalHours] = useState(parsed.hours);
  const [localMinutes, setLocalMinutes] = useState(parsed.minutes);
  const [period, setPeriod] = useState(parsed.period);
  
  // Track if user is actively editing (focused)
  const [isFocused, setIsFocused] = useState(false);
  
  // Track if we made the change internally to avoid re-sync loops
  const isInternalChange = useRef(false);

  // Only sync from parent when NOT focused and change is external
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (!isFocused) {
      const newParsed = parseTime(value);
      setLocalHours(newParsed.hours);
      setLocalMinutes(newParsed.minutes);
      setPeriod(newParsed.period);
    }
  }, [value, isFocused]);

  const commitChange = (newHours: string, newMinutes: string, newPeriod: string) => {
    // Mark as internal change to prevent useEffect re-sync
    isInternalChange.current = true;
    
    // Parse and normalize hours (1-12)
    let h = parseInt(newHours) || 12;
    if (h === 0) h = 12;
    else if (h > 12) h = h % 12 || 12;
    
    // Parse and normalize minutes (0-59)
    let m = parseInt(newMinutes) || 0;
    if (m > 59) m = 59;
    
    // Convert to 24h for storage
    let h24 = h;
    if (newPeriod === "PM" && h !== 12) h24 = h + 12;
    if (newPeriod === "AM" && h === 12) h24 = 0;
    
    const formatted = `${h24.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    onChange(formatted);
    
    // Update local display
    setLocalHours(h.toString().padStart(2, "0"));
    setLocalMinutes(m.toString().padStart(2, "0"));
  };

  const handleHoursInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing - only filter non-numeric
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setLocalHours(val);
  };

  const handleMinutesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow free typing - only filter non-numeric
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setLocalMinutes(val);
  };

  const handleHoursFocus = () => setIsFocused(true);
  const handleMinutesFocus = () => setIsFocused(true);

  const handleHoursBlur = () => {
    setIsFocused(false);
    // Normalize on blur
    commitChange(localHours, localMinutes, period);
  };

  const handleMinutesBlur = () => {
    setIsFocused(false);
    // Normalize on blur
    commitChange(localHours, localMinutes, period);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    commitChange(localHours, localMinutes, newPeriod);
  };

  return (
    <div className={`space-y-1 ${className || ""}`}>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <div className="flex items-center gap-1">
        <Input
          type="text"
          inputMode="numeric"
          value={localHours}
          onChange={handleHoursInput}
          onFocus={handleHoursFocus}
          onBlur={handleHoursBlur}
          className="w-11 text-center px-1 h-9"
          placeholder="HH"
          maxLength={2}
        />
        <span className="text-muted-foreground font-medium">:</span>
        <Input
          type="text"
          inputMode="numeric"
          value={localMinutes}
          onChange={handleMinutesInput}
          onFocus={handleMinutesFocus}
          onBlur={handleMinutesBlur}
          className="w-11 text-center px-1 h-9"
          placeholder="MM"
          maxLength={2}
        />
        <Select
          value={period}
          onValueChange={handlePeriodChange}
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
