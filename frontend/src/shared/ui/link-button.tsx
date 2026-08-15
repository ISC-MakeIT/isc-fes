import Link from "next/link";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

type LinkButtonProps = ComponentProps<typeof Link> & {
  children?: React.ReactNode;
};

export function LinkButton({ className, children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={cn(
        buttonVariants(),
        "max-w-xs px-8 py-7 text-2xl shadow-[3px_3px_0_#9683DC]",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
