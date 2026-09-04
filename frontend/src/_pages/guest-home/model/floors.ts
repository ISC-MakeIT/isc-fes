import floor1Image from "../assets/floor-1f.svg";
import floor5Image from "../assets/floor-5f.svg";
import floor6Image from "../assets/floor-6f.svg";
import floor7Image from "../assets/floor-7f.svg";
import floor8Image from "../assets/floor-8f.svg";
import type { StaticImageData } from "next/image";

export type Floor = {
  number: number;
  label: string;
  image: StaticImageData;
};

export const floors: Floor[] = [
  { number: 8, label: "８階", image: floor8Image },
  { number: 7, label: "７階", image: floor7Image },
  { number: 6, label: "６階", image: floor6Image },
  { number: 5, label: "５階", image: floor5Image },
  { number: 1, label: "１階", image: floor1Image },
] as const;
