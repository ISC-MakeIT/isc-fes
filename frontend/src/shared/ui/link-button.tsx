import Link from "next/link";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { Button, buttonVariants } from "./button";
import { actionButtonStyles } from "./action-button";
import { VariantProps } from "class-variance-authority";

type LinkButtonProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    disabled?: boolean;
  };

export function LinkButton({
  variant = "default",
  className,
  children,
  disabled,
  ...linkProps
}: LinkButtonProps) {
  const styles = cn(
    buttonVariants({ variant: variant }),
    actionButtonStyles(),
    className,
  );

  if (disabled) {
    return (
      <Button type="button" disabled aria-disabled="true" className={styles}>
        {children}
      </Button>
    );
  }

  return (
    <Link className={styles} {...linkProps}>
      {children}
    </Link>
  );
}
