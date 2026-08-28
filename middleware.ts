import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Supabase auth cookie (sb-*-auth-token)
  const hasAuth = request.cookies.getAll().some(
    (c) => c.name.includes("-auth-token") && c.value.length > 10
  );

  // Not logged in and not on login/auth/payslip page → redirect to login
  if (!hasAuth && !pathname.startsWith("/login") && !pathname.startsWith("/auth") && !pathname.startsWith("/payslip") && !pathname.startsWith("/contract") && !pathname.startsWith("/api/payslip-view") && !pathname.startsWith("/api/contract-view") && !pathname.startsWith("/api/contract-sign")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged in but on login page → redirect to home
  if (hasAuth && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Pass pathname as header for layout detection
  const response = NextResponse.next();
  response.headers.set("x-next-url", pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
