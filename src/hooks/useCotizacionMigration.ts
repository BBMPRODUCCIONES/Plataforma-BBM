import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PersonalItem } from "@/types";

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  feedbackUpdated: number;
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
    // Count records that need migration (personal_item_id extraction or feedback backfill)
    const { count, error } = await supabase
      .from("supplier_cotizacion_history")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .or("migrated.is.null,migrated.eq.false");

    if (error) {
      console.error("Error checking pending count:", error);
      return 0;
    }
    return count || 0;
  }, []);

  const runMigration = useCallback(async (): Promise<MigrationStats> => {
    if (isRunning) {
      return { total: 0, migrated: 0, skipped: 0, errors: 0, feedbackUpdated: 0, errorDetails: [] };
    }

    setIsRunning(true);
    setProgress({ current: 0, total: 0, percentage: 0 });

    const finalStats: MigrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      feedbackUpdated: 0,
      errorDetails: [],
    };

    try {
      // Get all non-migrated records
      const { data: pendingRecords, error: fetchError } = await supabase
        .from("supplier_cotizacion_history")
        .select("id, file_path, personal_item_id, migrated, evento_id, feedback")
        .is("deleted_at", null)
        .or("migrated.is.null,migrated.eq.false");

      if (fetchError) {
        throw new Error(`Error fetching records: ${fetchError.message}`);
      }

      const records = pendingRecords || [];
      finalStats.total = records.length;
      setProgress({ current: 0, total: records.length, percentage: 0 });

      // Fetch all projects to get Personal feedback
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, personal")
        .eq("is_deleted", false);

      if (projectsError) {
        console.error("Error fetching projects for feedback backfill:", projectsError);
      }

      // Build a map of project personal items for quick lookup
      const personalFeedbackMap = new Map<string, string>();
      if (projectsData) {
        for (const project of projectsData) {
          const personal = project.personal as unknown as PersonalItem[] | null;
          if (personal && Array.isArray(personal)) {
            for (const item of personal) {
              if (item.feedback && (item.tipoPersonal === 'Proveedor' || item.tipoPersonal === 'Transporte')) {
                // Key: projectId-personalItemId
                personalFeedbackMap.set(`${project.id}-${item.id}`, item.feedback);
              }
            }
          }
        }
      }

      // Process in batches
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        
        for (const record of batch) {
          try {
            // Determine personal_item_id
            let personalItemId = record.personal_item_id;
            if (!personalItemId) {
              personalItemId = extractPersonalItemIdFromPath(record.file_path);
            }

            // Check if we need to backfill feedback
            let feedbackToSet = record.feedback || "";
            if (!feedbackToSet && personalItemId && record.evento_id) {
              const key = `${record.evento_id}-${personalItemId}`;
              feedbackToSet = personalFeedbackMap.get(key) || "";
            }

            // Prepare update data
            const updateData: Record<string, any> = {
              migrated: true,
              migrated_at: new Date().toISOString(),
            };

            // Add personal_item_id if extracted and not already set
            if (personalItemId && !record.personal_item_id) {
              updateData.personal_item_id = personalItemId;
            }

            // Add feedback if backfilling
            if (feedbackToSet && !record.feedback) {
              updateData.feedback = feedbackToSet;
              finalStats.feedbackUpdated++;
            }

            const { error: updateError } = await supabase
              .from("supplier_cotizacion_history")
              .update(updateData)
              .eq("id", record.id);

            if (updateError) {
              finalStats.errors++;
              finalStats.errorDetails.push(`${record.id}: ${updateError.message}`);
            } else if (record.personal_item_id && record.feedback) {
              finalStats.skipped++;
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
            feedbackUpdated: finalStats.feedbackUpdated,
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
