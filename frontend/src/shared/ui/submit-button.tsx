import { ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { DotText } from "./dot-text";
import { cva } from "class-variance-authority";

export const actionButtonStyles = cva(
  "h-auto rounded-sm px-8 py-3 text-2xl shadow-[3px_3px_0_#9683DC]",
);

type SubmitButtonProps = ComponentProps<typeof Button> & {
  isDot?: boolean;
};

// TODO: 名前をActionButtonにして、isDotをデフォルトでfalseにして、呼び出し側で<SubmitButton isDot >だけで付与できるようにする
export function SubmitButton({
  isDot = true,
  className,
  children,
  ...props
}: SubmitButtonProps) {
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
