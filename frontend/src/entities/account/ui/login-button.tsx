import { API_BASE_URL } from "@/shared/config/env";
import { buttonVariants } from "@/shared/ui/button";
import Link from "next/link";

const GOOGLE_LOGIN_ENDPOINT = API_BASE_URL + "/auth/google/login";

export function LoginButton() {
  return (
    <Link href={GOOGLE_LOGIN_ENDPOINT} className={buttonVariants()}>
      Googleでログイン
    </Link>
  );
}
