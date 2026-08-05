import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

const LOGIN_PAGE_URL = "/login";

/**
 * ログイン必須のページにアクセスしてきた人を弾く用のLayout
 */
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionCookie = (await cookies()).get("isc_fes_account_session");

  if (!sessionCookie) redirect(LOGIN_PAGE_URL);

  return children;
}
