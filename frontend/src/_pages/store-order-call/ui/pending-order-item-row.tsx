import { OrderItem } from "@/entities/order";
import { PlusIcon } from "lucide-react";

type PendingOrderItemRowProps = {
  item: OrderItem;
};

export function PendingOrderItemRow({ item }: PendingOrderItemRowProps) {
  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-col">
        <h3 className="text-base font-semibold">{item.menuName}</h3>
        {item.toppings.map((topping) => (
          <p
            key={topping.toppingId}
            className="flex flex-row gap-2 pt-2 pl-4 text-sm"
          >
            <PlusIcon className="size-4 shrink-0" />
            {topping.toppingName}
          </p>
        ))}
      </div>

      <p className="shrink-0 text-base font-semibold">：{item.quantity}個</p>
    </div>
  );
}
