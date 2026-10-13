import { cn } from "@/shared/lib/utils";

type SharpCorneredTriangleIconProps = {
  className?: string;
};

// lucideに角張った三角形がないので自作
export function SharpCorneredTriangleIcon({
  className,
}: SharpCorneredTriangleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("text-foreground size-4 shrink-0", className)}
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="4,2 22,12 4,22" />
    </svg>
  );
}
