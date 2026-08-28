import { ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { DotText } from "./dot-text";
import { cva } from "class-variance-authority";

export const actionButtonStyles = cva(
  "h-auto rounded-sm px-8 py-3 text-2xl shadow-[3px_3px_0_#9683DC]",
);

type ActionButtonProps = ComponentProps<typeof Button> & {
  isDot?: boolean;
};

export function ActionButton({
  isDot = true,
  className,
  children,
  ...props
}: ActionButtonProps) {
  const textStyle = cva("inline-flex items-center gap-2");
  return (
    <Button
      variant="secondary"
      className={cn(actionButtonStyles(), className)}
      {...props}
    >
      {isDot ? (
        <DotText className={textStyle()}>{children}</DotText>
      ) : (
        <span className={textStyle()}>{children}</span>
      )}
    </Button>
  );
}
