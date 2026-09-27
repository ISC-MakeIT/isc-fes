import type { StaticImageData } from "next/image";
import type { Room } from "@/entities/room";
import room501Image from "./assets/501.svg";
import room502Image from "./assets/502.svg";
import room503Image from "./assets/503.svg";
import room504Image from "./assets/504.svg";
import room505Image from "./assets/505.svg";
import room506Image from "./assets/506.svg";
import room507Image from "./assets/507.svg";
import room508Image from "./assets/508.svg";
import room509Image from "./assets/509.svg";
import room601Image from "./assets/601.svg";
import room602Image from "./assets/602.svg";
import room603Image from "./assets/603.svg";
import room605Image from "./assets/605.svg";
import room606Image from "./assets/606.svg";
import room607Image from "./assets/607.svg";
import room608Image from "./assets/608.svg";
import room707Image from "./assets/707.svg";
import iCrossImage from "./assets/iCross.svg";

// TODO: 1Fの画像は出来次第配備
export const roomMapImages = {
  "1F": null,
  "501教室": room501Image,
  "502教室": room502Image,
  "503教室": room503Image,
  "504教室": room504Image,
  "505教室": room505Image,
  "506教室": room506Image,
  "507教室": room507Image,
  "508教室": room508Image,
  "509教室": room509Image,
  "601教室": room601Image,
  "602教室": room602Image,
  "603教室": room603Image,
  "604教室": null,
  "605教室": room605Image,
  "606教室": room606Image,
  "607教室": room607Image,
  "608教室": room608Image,
  "707教室": room707Image,
  iCrossArena: iCrossImage,
  "8Fステージ": null,
} satisfies Record<Room, StaticImageData | null>;
