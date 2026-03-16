import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  explainClinicPerformance,
  explainDashboardMetrics,
  explainReimbursementVariance,
  explainUnderpaymentSignal,
} from "@/server/services/ai/kal-explain.service";
import { kalExplainSchema } from "@/server/services/ai/kal.schemas";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const json = await req.json();
    const parsed = kalExplainSchema.parse(json);
    const ctx = { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId };

    if (parsed.target === "clinic_performance" && parsed.clinicId) {
      return explainClinicPerformance(ctx, {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        query: parsed.query,
      });
    }
    if (parsed.target === "reimbursement_variance") {
      return explainReimbursementVariance(ctx, {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        query: parsed.query,
      });
    }
    if (parsed.target === "underpayment_signal") {
      return explainUnderpaymentSignal(ctx, {
        organizationId: parsed.organizationId,
        clinicId: parsed.clinicId,
        signalId: parsed.signalId,
        query: parsed.query,
      });
    }
    return explainDashboardMetrics(ctx, {
      organizationId: parsed.organizationId,
      clinicId: parsed.clinicId,
      query: parsed.query,
    });
  });
}
