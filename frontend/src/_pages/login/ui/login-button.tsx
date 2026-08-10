import { API_BASE_URL } from "@/shared/config";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { DotText } from "@/shared/ui/dot-text";
import { LinkButton } from "@/shared/ui/link-button";

const GOOGLE_LOGIN_ENDPOINT = API_BASE_URL + "/auth/google/login";

export function LoginButton() {
  return (
    <LinkButton
      href={GOOGLE_LOGIN_ENDPOINT}
      className={cn(buttonVariants({ size: "lg" }), "h-16 px-8 text-2xl")}
    >
      <DotText>ログイン</DotText>
    </LinkButton>
  );
}
