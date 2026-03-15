import { NextRequest } from "next/server";

import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/utils";
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
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new AppError("Authentication required", "UNAUTHENTICATED", 401);

    const { taskId } = await params;
    const json = await req.json();
    const input = updateOnboardingTaskSchema.parse(json);
    return updateOnboardingTask({ actorUserId: userId }, taskId, input);
  });
}

