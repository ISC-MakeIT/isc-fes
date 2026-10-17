import { Temporal } from "temporal-polyfill-lite";

import { createScheduledEvent } from "../lib/create-scheduled-event";
import type { FestivalDates, ScheduledEvent } from "../model/types";
import KaraokeBanner from "./banner2026/karaoke.jpg";
import EntanBanner from "./banner2026/entan.png";
import FreesiaBanner from "./banner2026/freesia.png";
import IwasakiDown from "./banner2026/iwasaking-down.png";

export const currentEventDates = {
  day1: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 24,
    },
    {
      overflow: "reject",
    },
  ),
  day2: Temporal.PlainDate.from(
    {
      year: 2026,
      month: 10,
      day: 25,
    },
    {
      overflow: "reject",
    },
  ),
} as const satisfies FestivalDates;

export const currentScheduledEvents = [
  createScheduledEvent({
    name: "Freesia ダンスステージ",
    bannerSrc: FreesiaBanner,
    description:
      "アイドルが大好きなメンバーで活動しているコピーダンスサークルです！可愛く元気いっぱいのパフォーマンスで、皆さんに笑顔と楽しさをお届けします。ぜひ私たちのステージをご覧ください♡",
    room: "8Fステージ",
    date: currentEventDates.day1,
    startTime: {
      hour: 10,
      minute: 15,
    },
    endTime: {
      hour: 10,
      minute: 45,
    },
  }),
  createScheduledEvent({
    name: "IWASKING DOWN",
    bannerSrc: IwasakiDown,
    description:
      "力が欲しいか、なら、奪い取れ。勝ち抜き腕相撲、開幕。ルールはシンプル。腕相撲で勝つだけ。最後まで勝ち残れるのは、たった一人だけ",
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
    name: "Freesia ダンスステージ",
    bannerSrc: FreesiaBanner,
    description:
      "アイドルが大好きなメンバーで活動しているコピーダンスサークルです！可愛く元気いっぱいのパフォーマンスで、皆さんに笑顔と楽しさをお届けします。ぜひ私たちのステージをご覧ください♡",
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
    name: "カラオケ大会",
    bannerSrc: KaraokeBanner,
    description: `今年の学園祭で、参加者の歌声が響く！〜大狂乱,お祭り騒ぎのカラオケ大会〜が開催決定！あなたの声援と共に、学園祭の一番熱いステージを一緒に作り上げましょう！`,
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
    name: "男女装コンテスト",
    // TODO: バナー素材もらったら入れる
    bannerSrc: undefined,
    description:
      "皆様大変お待たせしました！三角チョコパイに続き男女装コンテストの時期です！今年の男女装コンテスト昨年とは一風変わった！？かもしれないです！一度足を運んでみてください！！",
    room: "8Fステージ",
    date: currentEventDates.day2,
    startTime: {
      hour: 13,
    },
    endTime: {
      hour: 14,
    },
  }),
  createScheduledEvent({
    name: "演奏技術探求会",
    bannerSrc: EntanBanner,
    description:
      "音楽と熱気に含まれる学園祭ライブ！個性あふれるバンドが集結し、迫力のサウンドと心踊るステージをお届けします。",
    room: "608教室",
    date: currentEventDates.day2,
    // TODO: 時間が決まったら設定する
    startTime: {
      hour: 0,
    },
    endTime: {
      hour: 0,
    },
  }),
] satisfies ScheduledEvent[];
