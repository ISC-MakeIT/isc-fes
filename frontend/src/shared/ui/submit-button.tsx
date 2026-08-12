import { ComponentProps } from "react";
import { Button } from "./button";
import { cn } from "../lib/utils";
import { DotText } from "./dot-text";

export function SubmitButton({
  className,
  children,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="secondary"
      className={cn("px-8 py-7 text-2xl shadow-[3px_3px_0_#9683DC]", className)}
      {...props}
    >
      <DotText className="">{children}</DotText>
    </Button>
  );
}
