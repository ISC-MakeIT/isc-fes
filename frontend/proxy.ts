import { ACCOUNT_SESSION_COOKIE_NAME, loginUrl } from "@/shared/config";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const hasAccountSession = request.cookies.has(ACCOUNT_SESSION_COOKIE_NAME);

  if (hasAccountSession) {
    return NextResponse.next();
  }

  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const destination = new URL(loginUrl(redirectTo), request.url);

  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/member/:path*"],
};
