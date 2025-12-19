import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface CardField {
  key: string;
  label: string;
  render?: (item: unknown) => ReactNode;
  /** Priority: 1 = title, 2 = subtitle, 3 = badge, 4+ = secondary info */
  priority?: number;
  /** If true, this field renders as a badge/chip */
  isBadge?: boolean;
  /** If true, always show even if empty */
  alwaysShow?: boolean;
}

interface MobileCardViewProps<T extends { id: string }> {
  data: T[];
  fields: CardField[];
  onCardClick?: (item: T) => void;
  className?: string;
  highlightedId?: string;
  /** Key for the main title field */
  titleKey: string;
  /** Key for secondary subtitle */
  subtitleKey?: string;
  /** Key for status/badge display */
  badgeKey?: string;
  /** Custom card renderer for full control */
  renderCard?: (item: T, index: number) => ReactNode;
  /** Additional actions to show on each card */
  renderActions?: (item: T, index: number) => ReactNode;
}

/**
 * MobileCardView - Renders data as touch-friendly cards for mobile
 * 
 * Each row becomes a card with:
 * - Title (main identifier)
 * - Subtitle (secondary info)
 * - Badge/Status
 * - Expandable details
 */
export function MobileCardView<T extends { id: string }>({
  data,
  fields,
  onCardClick,
  className,
  highlightedId,
  titleKey,
  subtitleKey,
  badgeKey,
  renderCard,
  renderActions,
}: MobileCardViewProps<T>) {
  const getFieldValue = (item: T, key: string): unknown => {
    return (item as Record<string, unknown>)[key];
  };

  const renderFieldValue = (item: T, field: CardField): ReactNode => {
    if (field.render) {
      return field.render(item);
    }
    const value = getFieldValue(item, field.key);
    return value?.toString() || "-";
  };

  // Separate fields by priority
  const titleField = fields.find(f => f.key === titleKey);
  const subtitleField = subtitleKey ? fields.find(f => f.key === subtitleKey) : undefined;
  const badgeField = badgeKey ? fields.find(f => f.key === badgeKey) : undefined;
  const secondaryFields = fields.filter(f => 
    f.key !== titleKey && 
    f.key !== subtitleKey && 
    f.key !== badgeKey
  );

  if (data.length === 0) {
    return (
      <div className="mobile-card-empty">
        <p className="text-muted-foreground text-sm text-center py-8">
          No hay datos disponibles
        </p>
      </div>
    );
  }

  return (
    <div className={cn("mobile-card-container", className)}>
      {data.map((item, index) => {
        if (renderCard) {
          return (
            <div key={item.id} className="mobile-card-wrapper">
              {renderCard(item, index)}
            </div>
          );
        }

        return (
          <div
            key={item.id}
            className={cn(
              "mobile-card",
              onCardClick && "mobile-card-clickable",
              highlightedId === item.id && "mobile-card-highlighted"
            )}
            onClick={() => onCardClick?.(item)}
          >
            {/* Header: Title + Badge */}
            <div className="mobile-card-header">
              <div className="mobile-card-title-group">
                {titleField && (
                  <h3 className="mobile-card-title">
                    {renderFieldValue(item, titleField)}
                  </h3>
                )}
                {subtitleField && (
                  <p className="mobile-card-subtitle">
                    {renderFieldValue(item, subtitleField)}
                  </p>
                )}
              </div>
              
              <div className="mobile-card-badge-area">
                {badgeField && (
                  <div className="mobile-card-badge">
                    {renderFieldValue(item, badgeField)}
                  </div>
                )}
                {onCardClick && (
                  <ChevronRight className="mobile-card-chevron" />
                )}
              </div>
            </div>

            {/* Body: Secondary fields in grid */}
            {secondaryFields.length > 0 && (
              <div className="mobile-card-body">
                {secondaryFields.slice(0, 6).map((field) => {
                  const value = getFieldValue(item, field.key);
                  if (!field.alwaysShow && (value === null || value === undefined || value === "")) {
                    return null;
                  }
                  
                  return (
                    <div key={field.key} className="mobile-card-field">
                      <span className="mobile-card-field-label">{field.label}</span>
                      <span className="mobile-card-field-value">
                        {renderFieldValue(item, field)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            {renderActions && (
              <div className="mobile-card-actions">
                {renderActions(item, index)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
