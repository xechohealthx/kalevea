import { NextRequest } from "next/server";

import { requireAuthenticatedUserId } from "@/lib/auth/current-user";
import { withRouteErrorHandling } from "@/lib/utils/route";
import {
  updateOnboardingTask,
  updateOnboardingTaskSchema,
} from "@/server/services/onboarding/onboarding.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  return withRouteErrorHandling(async () => {
    const userId = await requireAuthenticatedUserId();

    const { taskId } = await params;
    const json = await req.json();
    const input = updateOnboardingTaskSchema.parse(json);
    return updateOnboardingTask({ actorUserId: userId }, taskId, input);
  });
}

