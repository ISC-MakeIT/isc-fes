import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const baseUrl = location.origin;

  const sessionCookie = (await cookies()).get("isc_fes_account_session");
  if (!sessionCookie && location.pathname !== "/login")
    redirect("/login" + baseUrl);

  return children;
}
