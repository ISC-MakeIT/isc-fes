import Link from "next/link";
import { ComponentProps } from "react";

type AppLinkProps = ComponentProps<typeof Link> & {
  disabled?: boolean;
};

export function AppLink({ children, disabled, ...props }: AppLinkProps) {
  if (disabled) {
    return <span aria-disabled>{children}</span>;
  }

  return <Link {...props}>{children}</Link>;
}
