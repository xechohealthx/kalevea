import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/clinics",
  "/onboarding",
  "/providers",
  "/support",
  "/training",
  "/documents",
  "/rems",
  "/settings",
];

const PROTECTED_API_PREFIXES = [
  "/api/clinics",
  "/api/onboarding",
  "/api/providers",
  "/api/support",
  "/api/training",
  "/api/documents",
  "/api/rems",
];

function isProtected(pathname: string) {
  return (
    PROTECTED_PAGE_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtected(pathname)) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (token?.userId) return NextResponse.next();

  if (PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clinics/:path*",
    "/onboarding/:path*",
    "/providers/:path*",
    "/support/:path*",
    "/training/:path*",
    "/documents/:path*",
    "/rems/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
};
