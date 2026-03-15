import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

export default async function Home() {
  const session = await auth();
  redirect(session?.user?.id ? "/dashboard" : "/login");
}
