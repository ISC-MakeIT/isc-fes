import { googleLoginUrl } from "@/shared/config";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/ui/button";
import { DotText } from "@/shared/ui/dot-text";
import { LinkButton } from "@/shared/ui/link-button";

type LoginButtonProps = {
  redirectTo?: string;
};

export function LoginButton({ redirectTo }: LoginButtonProps) {
  console.log(googleLoginUrl(redirectTo));
  return (
    <LinkButton
      href={googleLoginUrl(redirectTo)}
      className={cn(buttonVariants({ size: "lg" }), "h-16 px-8 text-2xl")}
    >
      <DotText>ログイン</DotText>
    </LinkButton>
  );
}
