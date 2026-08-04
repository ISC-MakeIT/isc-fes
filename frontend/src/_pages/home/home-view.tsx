import { LoginButton } from "@/entities/user/ui/login-button";
import { client } from "@/shared/api/client";
import { cookies } from "next/headers";

export async function HomeView() {
  const cookieStore = await cookies();
  const { data, error } = await client.GET("/me", {
    headers: { Cookie: cookieStore.toString() },
  });

  return <LoginButton />;
}
