import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
}

interface MigrationProgress {
  current: number;
  total: number;
  percentage: number;
}

interface UseCotizacionMigrationReturn {
  isRunning: boolean;
  progress: MigrationProgress | null;
  stats: MigrationStats | null;
  runMigration: () => Promise<MigrationStats>;
  checkPendingCount: () => Promise<number>;
}

const BATCH_SIZE = 50;

/**
 * Extract personal_item_id from file_path pattern: .../personal-<ID>-adjuntos/...
 */
const extractPersonalItemIdFromPath = (filePath: string): string | null => {
  if (!filePath) return null;
  const match = filePath.match(/personal-([^/]+)-adjuntos/);
  return match ? match[1] : null;
};

export function useCotizacionMigration(): UseCotizacionMigrationReturn {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [stats, setStats] = useState<MigrationStats | null>(null);

  const checkPendingCount = useCallback(async (): Promise<number> => {
    const { count, error } = await supabase
      .from("supplier_cotizacion_history")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .or("migrated.is.null,migrated.eq.false")
      .is("personal_item_id", null);

    if (error) {
      console.error("Error checking pending count:", error);
      return 0;
    }
    return count || 0;
  }, []);

  const runMigration = useCallback(async (): Promise<MigrationStats> => {
    if (isRunning) {
      return { total: 0, migrated: 0, skipped: 0, errors: 0, errorDetails: [] };
    }

    setIsRunning(true);
    setProgress({ current: 0, total: 0, percentage: 0 });

    const finalStats: MigrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [],
    };

    try {
      // Get all non-migrated records that need personal_item_id
      const { data: pendingRecords, error: fetchError } = await supabase
        .from("supplier_cotizacion_history")
        .select("id, file_path, personal_item_id, migrated")
        .is("deleted_at", null)
        .or("migrated.is.null,migrated.eq.false");

      if (fetchError) {
        throw new Error(`Error fetching records: ${fetchError.message}`);
      }

      const records = pendingRecords || [];
      finalStats.total = records.length;
      setProgress({ current: 0, total: records.length, percentage: 0 });

      // Process in batches
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        for (const record of batch) {
          try {
            // Check if already has personal_item_id
            if (record.personal_item_id) {
              // Just mark as migrated
              const { error: updateError } = await supabase
                .from("supplier_cotizacion_history")
                .update({
                  migrated: true,
                  migrated_at: new Date().toISOString(),
                })
                .eq("id", record.id);

              if (updateError) {
                finalStats.errors++;
                finalStats.errorDetails.push(`${record.id}: ${updateError.message}`);
              } else {
                finalStats.skipped++;
              }
              continue;
            }

            // Extract personal_item_id from file_path
            const extractedId = extractPersonalItemIdFromPath(record.file_path);

            if (!extractedId) {
              // Cannot extract, mark as migrated but log
              const { error: updateError } = await supabase
                .from("supplier_cotizacion_history")
                .update({
                  migrated: true,
                  migrated_at: new Date().toISOString(),
                })
                .eq("id", record.id);

              if (updateError) {
                finalStats.errors++;
                finalStats.errorDetails.push(`${record.id}: ${updateError.message}`);
              } else {
                finalStats.skipped++;
              }
              continue;
            }

            // Update with extracted personal_item_id
            const { error: updateError } = await supabase
              .from("supplier_cotizacion_history")
              .update({
                personal_item_id: extractedId,
                migrated: true,
                migrated_at: new Date().toISOString(),
              })
              .eq("id", record.id);

            if (updateError) {
              finalStats.errors++;
              finalStats.errorDetails.push(`${record.id}: ${updateError.message}`);
            } else {
              finalStats.migrated++;
            }
          } catch (err) {
            finalStats.errors++;
            finalStats.errorDetails.push(`${record.id}: ${String(err)}`);
          }
        }

        // Update progress
        const current = Math.min(i + batch.length, records.length);
        setProgress({
          current,
          total: records.length,
          percentage: Math.round((current / records.length) * 100),
        });

        // Small delay between batches to avoid overwhelming
        if (i + BATCH_SIZE < records.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Log to audit
      if (user) {
        await supabase.from("user_audit_log").insert({
          actor_id: user.id,
          actor_email: user.email || "unknown",
          action: "migration_cotizacion_history",
          panel: "historial-cotizaciones",
          details: {
            total: finalStats.total,
            migrated: finalStats.migrated,
            skipped: finalStats.skipped,
            errors: finalStats.errors,
            errorSample: finalStats.errorDetails.slice(0, 5),
          },
        });
      }

      setStats(finalStats);
      return finalStats;
    } catch (error) {
      console.error("Migration error:", error);
      finalStats.errors++;
      finalStats.errorDetails.push(String(error));
      setStats(finalStats);
      return finalStats;
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, user]);

  return {
    isRunning,
    progress,
    stats,
    runMigration,
    checkPendingCount,
  };
}
