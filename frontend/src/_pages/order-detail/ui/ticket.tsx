"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchOrderByidQueryOptions } from "../api/fetch-order-by-id";
import Image from "next/image";
import TicketSvg from "./assets/ticket.svg";

type TicketProps = {
  orderId: string;
};

export function Ticket({ orderId }: TicketProps) {
  const { data: order } = useSuspenseQuery(fetchOrderByidQueryOptions(orderId));
  return (
    <div className="relative">
      <Image src={TicketSvg} alt="" />
      <span className="absolute inset-0 -left-24 flex place-items-center justify-center text-[2.5rem] font-extrabold">
        {order.displayNumber}
      </span>
    </div>
  );
}
