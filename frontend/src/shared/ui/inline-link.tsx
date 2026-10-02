import Link from "next/link";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";

type InlineLinkProps = ComponentProps<typeof Link>;

export const inlineStyle =
  "text-link underline decoration-1 underline-offset-3";

export function InlineLink({ href, children, className }: InlineLinkProps) {
  return (
    <Link href={href} className={cn(inlineStyle, className)}>
      {children}
    </Link>
  );
}
