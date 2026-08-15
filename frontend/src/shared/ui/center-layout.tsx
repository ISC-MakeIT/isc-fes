import { ComponentProps } from "react";
import { cn } from "../lib/utils";

type CenterlayoutProops = ComponentProps<"div"> & {
  className?: string;
};

export function CenterLayout({
  className,
  children,
  ...props
}: CenterlayoutProops) {
  return (
    <div
      className={cn(
        "mx-auto my-8 grid max-w-lg place-content-center space-y-8 px-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
