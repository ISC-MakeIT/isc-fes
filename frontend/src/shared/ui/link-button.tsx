import Link from "next/link";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";
import { actionButtonStyles } from "./action-button";
import { VariantProps } from "class-variance-authority";

type LinkButtonProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
  };

export function LinkButton({
  variant = "default",
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={cn(
        buttonVariants({ variant: variant }),
        actionButtonStyles(),
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
