"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@/shared/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientaion=vertical]:w-px data-[orientaion=vertical]:self-stretch data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
        className,
      )}
      {...props}
    />
  );
}

export { Separator };
