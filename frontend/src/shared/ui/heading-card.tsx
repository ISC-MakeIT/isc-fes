import { Card } from "@/shared/ui/card";
import { DotText } from "@/shared/ui/dot-text";
import { ComponentProps } from "react";
import { cn } from "../lib/utils";

type HeadingCardProps = ComponentProps<typeof Card>;

export function HeadingCard({
  children,
  className,
  ...props
}: HeadingCardProps) {
  return (
    <Card
      className={cn(
        "bg-primary mx-auto rounded-sm px-6 py-2 text-center text-2xl text-white shadow-[7px_7px_0_rgb(254,218,62)]",
        className,
      )}
      {...props}
    >
      <h1>
        <DotText>{children}</DotText>
      </h1>
    </Card>
  );
}
