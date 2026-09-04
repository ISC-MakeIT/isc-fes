"use client";

import { HeadingCard } from "@/shared/ui/heading-card";
import Image from "next/image";
import { useState } from "react";
import { floors } from "../model/floors";
import { DotText } from "@/shared/ui/dot-text";
import { cn } from "@/shared/lib/utils";

export function FloorGuide() {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(
    floors.at(-1)?.number ?? null,
  );
  return (
    <section className="flex flex-col items-center gap-16 pt-8 pb-16">
      <HeadingCard className="px-14 py-2">フロアガイド</HeadingCard>
      <div className="flex flex-col items-center gap-6">
        <p className="text-lg">
          <DotText>フロアを選択してください</DotText>
        </p>
        <ul className="flex flex-col">
          {floors.map((floor) => (
            <li
              className="flex flex-row items-center gap-14"
              key={floor.number}
            >
              <div className="space-x-4">
                <span
                  className={cn(
                    "text-2xl",
                    selectedFloor !== floor.number && "opacity-0",
                  )}
                >
                  ▶︎
                </span>
                <label
                  htmlFor={floor.number.toString()}
                  className="cursor-pointer text-xl underline underline-offset-4"
                >
                  <DotText>{floor.label}</DotText>
                </label>
              </div>
              <button
                id={floor.number.toString()}
                className={cn(
                  "h-[2.8293rem] cursor-pointer transition-transform",
                  selectedFloor === floor.number &&
                    "-translate-x-5 translate-y-3",
                )}
                style={{ zIndex: floor.number }}
                onClick={() => setSelectedFloor(floor.number)}
              >
                <Image src={floor.image} alt={"フロア"} className="w-33.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
