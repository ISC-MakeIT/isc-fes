import { Card } from "@/shared/ui/card";
import { Allergen } from "../model/types";
import { ComponentProps } from "react";
import { cn } from "@/shared/lib/utils";
import { cva } from "class-variance-authority";

export const allergenBadgeVariants = cva(
  "border-allergen-card rounded-sm border-2 py-2 text-center",
);

type AllergenCardProps = {
  allergen: Allergen;
} & ComponentProps<typeof Card>;

export function AllergenBadge({
  allergen,
  className,
  ...props
}: AllergenCardProps) {
  return (
    <Card className={cn(allergenBadgeVariants(), className)} {...props}>
      {allergen.name}
    </Card>
  );
}
