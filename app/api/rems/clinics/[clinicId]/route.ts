import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { upsertEnrollmentSchema } from "@/server/services/rems/rems.schemas";
import { getClinicRemsOverview, upsertClinicEnrollment } from "@/server/services/rems/rems.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const { clinicId } = await params;
    const url = new URL(req.url);
    const remsProgramId = url.searchParams.get("remsProgramId") ?? undefined;

    return getClinicRemsOverview({ actorUserId: userId }, clinicId, { remsProgramId });
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const { clinicId } = await params;
    const json = await req.json();
    const parsed = upsertEnrollmentSchema.parse(json);

    return upsertClinicEnrollment(
      { actorUserId: userId, clinicId },
      clinicId,
      {
        remsProgramId: parsed.remsProgramId,
        status: parsed.status,
        enrolledAt: parsed.enrolledAt ? new Date(parsed.enrolledAt) : null,
        expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
        lastReviewedAt: parsed.lastReviewedAt ? new Date(parsed.lastReviewedAt) : null,
        notes: parsed.notes ?? null,
      },
    );
  });
}

