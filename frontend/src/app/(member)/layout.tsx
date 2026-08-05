import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";
import { LOGIN_URL } from "@/shared/config/urls";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

/**
 * ログイン必須のページにアクセスしてきた人を弾く用のLayout
 */
export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME);

  if (!sessionCookie) redirect(LOGIN_URL);

  return children;
}
