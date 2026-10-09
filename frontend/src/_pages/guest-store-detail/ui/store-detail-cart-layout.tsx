"use client";

import { cn } from "@/shared/lib/utils";
import { useCartOperation } from "../model/cart-operation-context";
import { CartList } from "./cart-list";

type StoreDetailCartLayoutProps = {
  children: React.ReactNode;
};

export function StoreDetailCartLayout({
  children,
}: StoreDetailCartLayoutProps) {
  const { displayedCartItems } = useCartOperation();
  const hasCartItems = displayedCartItems.length > 0;

  return (
    <div
      className={cn(
        "mx-auto w-full",
        hasCartItems && "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10",
      )}
    >
      {children}
      {hasCartItems && <CartList />}
    </div>
  );
}
