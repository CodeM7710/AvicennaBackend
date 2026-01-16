// flows/analytics.js
import { supabase } from "../lib/supabase-client.js";

/**
 * Update analytics counters for a flow.
 * - total_requests
 * - success / errors
 * - last_request
 * - daily (last 30 days)
 * - monthly
 */
export async function appendFlowAnalytics(flowId, status) {
  console.log("[appendFlowAnalytics] flowId:", flowId, "status:", status);

  if (!flowId) {
    console.warn("[appendFlowAnalytics] No flowId provided, skipping analytics");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("flows")
      .select("analytics")
      .eq("id", flowId)
      .single();

    if (error) {
      console.error("[appendFlowAnalytics] Failed to fetch analytics:", error);
      return;
    }

    const analytics = data.analytics || {
      total_requests: 0,
      success: 0,
      errors: 0,
      last_request: null,
      daily: {},
      monthly: {},
    };

    // === Core counters ===
    analytics.total_requests += 1;

    if (status >= 200 && status < 400) {
      analytics.success += 1;
    } else {
      analytics.errors += 1;
    }

    analytics.last_request = new Date().toISOString();

    // === Daily aggregates (last 30 days) ===
    const dayKey = analytics.last_request.slice(0, 10); // YYYY-MM-DD
    analytics.daily[dayKey] = (analytics.daily[dayKey] || 0) + 1;

    const dailyKeys = Object.keys(analytics.daily).sort();
    if (dailyKeys.length > 30) {
      const toDelete = dailyKeys.slice(0, dailyKeys.length - 30);
      for (const key of toDelete) delete analytics.daily[key];
    }

    // === Monthly aggregates ===
    const monthKey = analytics.last_request.slice(0, 7); // YYYY-MM
    analytics.monthly[monthKey] = (analytics.monthly[monthKey] || 0) + 1;

    const { error: updateErr } = await supabase
      .from("flows")
      .update({ analytics })
      .eq("id", flowId);

    if (updateErr) {
      console.error("[appendFlowAnalytics] Failed to update analytics:", updateErr);
    } else {
      console.log("[appendFlowAnalytics] Analytics updated");
    }
  } catch (err) {
    console.error("[appendFlowAnalytics] crashed:", err);
  }
}
