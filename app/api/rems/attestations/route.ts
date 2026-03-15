import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
import { withRouteErrorHandling } from "@/lib/utils/route";
import { createAttestationSchema } from "@/server/services/rems/rems.schemas";
import { createAttestation } from "@/server/services/rems/rems.service";

export async function POST(req: NextRequest) {
  return withRouteErrorHandling(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const json = await req.json();
    const parsed = createAttestationSchema.parse(json);

    return createAttestation(
      { actorUserId: userId, clinicId: parsed.clinicId },
      {
        remsProgramId: parsed.remsProgramId,
        clinicId: parsed.clinicId,
        providerId: parsed.providerId ?? null,
        remsRequirementId: parsed.remsRequirementId ?? null,
        title: parsed.title,
        notes: parsed.notes ?? null,
        attestedAt: parsed.attestedAt ? new Date(parsed.attestedAt) : null,
      },
    );
  });
}

