import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  analyzeClinicOnboardingReadiness,
  identifyOnboardingBlockers,
} from "@/server/services/ai/kal-onboarding-analysis.service";
import { kalOnboardingAnalysisSchema } from "@/server/services/ai/kal.schemas";

export async function GET(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();
    const url = new URL(req.url);
    const parsed = kalOnboardingAnalysisSchema.parse({
      organizationId: url.searchParams.get("organizationId") ?? undefined,
      clinicId: url.searchParams.get("clinicId") ?? undefined,
    });
    const ctx = { actorUserId: userId, organizationId: parsed.organizationId, clinicId: parsed.clinicId };
    const [readiness, blockers] = await Promise.all([
      analyzeClinicOnboardingReadiness(ctx, parsed),
      identifyOnboardingBlockers(ctx, parsed),
    ]);
    return { readiness, blockers };
  });
}
