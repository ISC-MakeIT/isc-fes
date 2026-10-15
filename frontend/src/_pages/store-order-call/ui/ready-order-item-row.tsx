import { OrderItem } from "@/entities/order";
import { formatYen } from "@/shared/lib/formatYen";
import { PlusIcon } from "lucide-react";

type ReadyOrderItemRowProps = {
  item: OrderItem;
};

export function ReadyOrderItemRow({ item }: ReadyOrderItemRowProps) {
  const unitPriceWithToppings =
    item.unitPrice +
    item.toppings.reduce((total, topping) => total + topping.unitPrice, 0);

  const itemTotalAmount = unitPriceWithToppings * item.quantity;

  return (
    <div className="border-foreground flex flex-col gap-2 border-b pb-2">
      <div>
        <h3 className="font-semibold">{item.menuName}</h3>
        {item.toppings.map((topping) => (
          <p
            key={topping.toppingId}
            className="flex flex-row gap-2 pt-1 pl-4 text-sm"
          >
            <PlusIcon className="size-4.5 shrink-0" />
            <span>{topping.toppingName}</span>
          </p>
        ))}
      </div>
      <div className="mr-5 ml-auto flex flex-row gap-4 font-semibold">
        <p className="space-x-1">
          <span>{unitPriceWithToppings}</span>
          <span>×</span>
          <span>{item.quantity}</span>
        </p>
        <p>{formatYen(itemTotalAmount)}</p>
      </div>
    </div>
  );
}
