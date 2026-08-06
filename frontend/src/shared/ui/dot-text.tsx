import { DotGothic16 } from "next/font/google";

import { cn } from "../lib/utils";
import React from "react";

const dotGothic16 = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export function DotText({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn(dotGothic16.className, className)} {...props} />;
}
