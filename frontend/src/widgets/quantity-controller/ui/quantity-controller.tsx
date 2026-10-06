import { Button } from "@/shared/ui/button";
import { MinusIcon, PlusIcon } from "lucide-react";

type QuantityControllerProps = {
  onDecrease: () => void;
  onIncrease: () => void;
  quantity: number;
};

export function QuantityController({
  onDecrease,
  onIncrease,
  quantity,
}: QuantityControllerProps) {
  return (
    <div className="flex w-35.75 min-w-0 flex-row items-center justify-between">
      <Button
        onClick={onDecrease}
        aria-label="数量を減らす"
        variant="tertiary"
        size="icon-xs"
        className="rounded-full"
      >
        <MinusIcon aria-hidden />
      </Button>
      <span className="text-xl font-semibold">{quantity}</span>
      <Button
        variant="tertiary"
        size="icon-xs"
        aria-label="数量を増やす"
        onClick={onIncrease}
        className="rounded-full"
      >
        <PlusIcon aria-hidden />
      </Button>
    </div>
  );
}
