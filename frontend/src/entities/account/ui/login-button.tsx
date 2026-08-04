import { API_BASE_URL } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";

const GOOGLE_LOGIN_ENDPOINT = API_BASE_URL + "/auth/google/login";

export function LoginButton() {
  return (
    <a href={GOOGLE_LOGIN_ENDPOINT}>
      <Button>Googleでログイン</Button>
    </a>
  );
}
