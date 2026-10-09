"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";
import Image from "next/image";
import UpperLeft from "./assets/upper-left.svg";
import UpperRight from "./assets/upper-right.svg";
import LowerLeft from "./assets/lower-left.svg";
import LowerRight from "./assets/lower-right.svg";
import HeadingCenter from "./assets/heading-center.svg";
import HeadingLeft from "./assets/heading-left.svg";
import HeadingRight from "./assets/heading-right.svg";
import FooterLeft from "./assets/footer-left.svg";
import FooterRight from "./assets/footer-right.svg";
import { OrderItem } from "@/entities/order";
import { formatYen } from "@/shared/lib/formatYen";
import { PlusIcon } from "lucide-react";

type ReceiptProps = {
  orderId: string;
};

export function Receipt({ orderId }: ReceiptProps) {
  const { data: order } = useSuspenseQuery(fetchOrderByidQueryOptions(orderId));

  const createdDate = order.createdAt.toLocaleDateString("ja-JP");
  const createdTime = order.createdAt.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border-foreground w-full space-y-4 border p-4">
      <section className="flex flex-row justify-between gap-2">
        <Image src={UpperLeft} alt="" />
        <div className="flex w-full flex-col">
          <span className="border-primary w-full border-t-2" />
          <div className="flex flex-row justify-center gap-3 p-3">
            <Image src={HeadingLeft} alt="" className="relative top-3" />
            <Image src={HeadingCenter} alt="" />
            <Image src={HeadingRight} alt="" className="relative top-3" />
          </div>
        </div>
        <Image src={UpperRight} alt="" />
      </section>

      <section className="border-primary flex flex-col items-center gap-2 border-x-2 px-4">
        <h2>{order.storeName}</h2>
        <div className="flex items-center gap-2 text-2xl font-bold">
          <p>注文番号</p>
          <p className="text-4xl">{order.displayNumber}</p>
        </div>

        <ul className="w-full">
          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} />
          ))}
        </ul>

        <p className="ml-auto text-[1.375rem] font-bold">
          計　{formatYen(order.totalAmount)}
        </p>

        <p className="mt-4 ml-auto">{`${createdDate}　${createdTime}`}</p>
      </section>

      <section className="flex flex-row gap-2">
        <Image src={LowerLeft} alt="" />
        <div className="flex w-full flex-col justify-end">
          <div className="flex flex-row justify-between">
            <Image
              src={FooterLeft}
              alt=""
              className="relative -top-7 right-9"
            />
            <Image
              src={FooterRight}
              alt=""
              className="relative -top-7 left-9"
            />
          </div>
          <span className="border-primary w-full border-b-2" />
        </div>
        <Image src={LowerRight} alt="" />
      </section>
    </div>
  );
}

type OrderItemRow = {
  item: OrderItem;
};

function OrderItemRow({ item }: OrderItemRow) {
  const unitPriceWithTopping =
    item.unitPrice +
    item.toppings.reduce((total, topping) => total + topping.unitPrice, 0);

  return (
    <li className="border-foreground flex flex-row justify-between gap-6 border-b py-4 text-lg font-semibold">
      <div className="w-full">
        <div>
          <p>{item.menuName}</p>
          {item.toppings.map((topping) => (
            <div
              key={topping.toppingId}
              className="flex flex-row items-start gap-2 pt-2 pl-10 text-base"
            >
              <PlusIcon size={24} className="shrink-0" />
              <p>{topping.toppingName}</p>
            </div>
          ))}
        </div>
        <div className="ml-full gap-2 space-x-2 text-right">
          <span>{formatYen(unitPriceWithTopping)}</span>
          <span>×</span>
          <span>{item.quantity}</span>
        </div>
      </div>

      <p className="mt-auto">
        {formatYen(unitPriceWithTopping * item.quantity)}
      </p>
    </li>
  );
}
