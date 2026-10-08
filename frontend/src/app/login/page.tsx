import { LoginView } from "@/_pages/login/";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  const redirectTo =
    typeof query.redirect_to === "string" ? query.redirect_to : undefined;

  return <LoginView redirectTo={redirectTo} />;
}
