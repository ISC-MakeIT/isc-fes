import { SESSION_COOKIE_NAME } from "@/shared/config/cookies";
import { LOGIN_URL } from "@/shared/config/urls";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * ログイン必須のページにアクセスしてきた人を弾く用のLayout
 * TTFBが伸びる関係でここではsessionだけを見た楽観的なアクセス制限を行っている
 */
export default async function MemberLayout(props: LayoutProps<"/">) {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME);

  if (!sessionCookie) redirect(LOGIN_URL);

  return props.children;
}
