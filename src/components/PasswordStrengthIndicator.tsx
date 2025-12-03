import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordRequirement {
  label: string;
  met: boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
}

export const validatePassword = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
};

export const isPasswordValid = (password: string): boolean => {
  const validation = validatePassword(password);
  return Object.values(validation).every(Boolean);
};

const PasswordStrengthIndicator = ({ password }: PasswordStrengthIndicatorProps) => {
  const validation = validatePassword(password);

  const requirements: PasswordRequirement[] = [
    { label: "Mínimo 8 caracteres", met: validation.minLength },
    { label: "Una letra mayúscula", met: validation.hasUppercase },
    { label: "Una letra minúscula", met: validation.hasLowercase },
    { label: "Un número", met: validation.hasNumber },
    { label: "Un carácter especial (!@#$%^&*)", met: validation.hasSpecial },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const strengthPercentage = (metCount / requirements.length) * 100;

  const getStrengthColor = () => {
    if (strengthPercentage <= 20) return "bg-destructive";
    if (strengthPercentage <= 40) return "bg-orange-500";
    if (strengthPercentage <= 60) return "bg-yellow-500";
    if (strengthPercentage <= 80) return "bg-blue-500";
    return "bg-green-500";
  };

  const getStrengthLabel = () => {
    if (strengthPercentage <= 20) return "Muy débil";
    if (strengthPercentage <= 40) return "Débil";
    if (strengthPercentage <= 60) return "Regular";
    if (strengthPercentage <= 80) return "Buena";
    return "Fuerte";
  };

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Fortaleza:</span>
          <span className={cn(
            "font-medium",
            strengthPercentage === 100 ? "text-green-500" : "text-muted-foreground"
          )}>
            {getStrengthLabel()}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", getStrengthColor())}
            style={{ width: `${strengthPercentage}%` }}
          />
        </div>
      </div>

      {/* Requirements list */}
      <ul className="space-y-1">
        {requirements.map((req, index) => (
          <li
            key={index}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors duration-200",
              req.met ? "text-green-500" : "text-muted-foreground"
            )}
          >
            {req.met ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" />
            )}
            {req.label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordStrengthIndicator;
