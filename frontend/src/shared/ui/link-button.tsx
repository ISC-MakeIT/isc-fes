import Link from "next/link";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { buttonVariants } from "./button";

type LinkButtonProps = ComponentProps<typeof Link> & {
  children: React.ReactNode;
};

export function LinkButton({ className, children, ...props }: LinkButtonProps) {
  return (
    <Link
      className={cn(buttonVariants(), className, "hover:cursor-pointer")}
      {...props}
    >
      {children}
    </Link>
  );
}
