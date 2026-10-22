import { FESTIVAL_DATES } from "@/shared/config";

import { createScheduledEvent } from "../lib/create-scheduled-event";
import type { FestivalDates, ScheduledEvent } from "../model/types";
import KaraokeBanner from "./banner2026/karaoke.jpg";
import EntanBanner from "./banner2026/entan.png";
import FreesiaBanner from "./banner2026/freesia.png";
import IwasakiDownBanner from "./banner2026/iwasaking-down.png";
import DanjosouBanner from "./banner2026/danjosou.png";

export const currentEventDates = FESTIVAL_DATES satisfies FestivalDates;

export const currentScheduledEvents = [
  createScheduledEvent({
    name: "Freesia ダンスステージ Day1",
    bannerSrc: FreesiaBanner,
    description: `アイドルが大好きなメンバーで活動しているコピーダンスサークルです！\n可愛く元気いっぱいのパフォーマンスで、皆さんに笑顔と楽しさをお届けします。\nぜひ私たちのステージをご覧ください♡`,
    room: "8Fステージ",
    date: currentEventDates.day1,
    startTime: {
      hour: 11,
      minute: 30,
    },
    endTime: {
      hour: 12,
    },
  }),
  createScheduledEvent({
    name: "IWASKING DOWN",
    bannerSrc: IwasakiDownBanner,
    description:
      "力が欲しいか、なら、奪い取れ。勝ち抜き腕相撲、開幕。\nルールはシンプル。腕相撲で勝つだけ。\n最後まで勝ち残れるのは、たった一人だけ",
    room: "7階ホール",
    date: currentEventDates.day1,
    startTime: {
      hour: 13,
    },
    endTime: {
      hour: 16,
    },
  }),
  createScheduledEvent({
    name: "カラオケ大会",
    bannerSrc: KaraokeBanner,
    description: `今年の学園祭で、参加者の歌声が響く！\n〜大狂乱,お祭り騒ぎのカラオケ大会〜が開催決定！\nあなたの声援と共に、学園祭の一番熱いステージを一緒に作り上げましょう！`,
    room: "707教室",
    date: currentEventDates.day2,
    startTime: {
      hour: 10,
      minute: 30,
    },
    endTime: {
      hour: 13,
      minute: 30,
    },
  }),
  createScheduledEvent({
    name: "Freesia ダンスステージ Day2",
    bannerSrc: FreesiaBanner,
    description:
      "アイドルが大好きなメンバーで活動しているコピーダンスサークルです！\n可愛く元気いっぱいのパフォーマンスで、皆さんに笑顔と楽しさをお届けします。\nぜひ私たちのステージをご覧ください♡",
    room: "8Fステージ",
    date: currentEventDates.day2,
    startTime: {
      hour: 11,
      minute: 30,
    },
    endTime: {
      hour: 12,
    },
  }),
  createScheduledEvent({
    name: "演奏技術探求会",
    bannerSrc: EntanBanner,
    description:
      "音楽と熱気に含まれる学園祭ライブ！\n個性あふれるバンドが集結し、迫力のサウンドと心踊るステージをお届けします。",
    room: "608教室",
    date: currentEventDates.day2,
    startTime: {
      hour: 12,
    },
    endTime: {
      hour: 15,
    },
  }),
  createScheduledEvent({
    name: "男女装コンテスト",
    bannerSrc: DanjosouBanner,
    description:
      "皆様大変お待たせしました！三角チョコパイに続き男女装コンテストの時期です！\n今年の男女装コンテスト昨年とは一風変わった！？かもしれないです！\n一度足を運んでみてください！！",
    room: "8Fステージ",
    date: currentEventDates.day2,
    startTime: {
      hour: 13,
      minute: 30,
    },
    endTime: {
      hour: 16,
    },
  }),
] satisfies ScheduledEvent[];
