import { ComponentProps } from "react";
import { cn } from "../lib/utils";
import { DotText } from "./dot-text";

type MaskProps = ComponentProps<"div"> & {
  active: boolean;
  label?: string;
};

export function Mask({
  active,
  label,
  children,
  className,
  ...props
}: MaskProps) {
  if (!active) return <>{children}</>;

  return (
    <div className={cn("relative overflow-hidden", className)} {...props}>
      <div aria-hidden className="pointer-events-none opacity-60">
        {children}
      </div>
      <div className="bg-primary/70 absolute inset-0 flex items-center justify-center">
        <DotText className="text-xl text-white">{label}</DotText>
      </div>
    </div>
  );
}
