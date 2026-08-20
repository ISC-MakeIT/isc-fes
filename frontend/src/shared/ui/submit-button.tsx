import { ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { DotText } from "./dot-text";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  isDot?: boolean;
};

export function SubmitButton({
  isDot = true,
  className,
  children,
  ...props
}: SubmitButtonProps) {
  const textStyle = "inline-flex items-center gap-2 whitespace-nowrap";
  return (
    <Button
      variant="secondary"
      className={cn(
        "h-auto rounded-sm px-8 py-3 text-2xl shadow-[3px_3px_0_#9683DC]",
        className,
      )}
      {...props}
    >
      {isDot ? (
        <DotText className={textStyle}>{children}</DotText>
      ) : (
        <span className={textStyle}>{children}</span>
      )}
    </Button>
  );
}
