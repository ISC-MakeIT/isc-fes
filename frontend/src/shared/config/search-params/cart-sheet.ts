import { createSerializer, inferParserType, parseAsBoolean } from "nuqs/server";

export const guestStoreDetailParsers = {
  isOpenCart: parseAsBoolean.withDefault(false),
};

export type GuestStoreDetailSearchParams = Partial<
  inferParserType<typeof guestStoreDetailParsers>
>;

export const serializeGuestStoreDetail = createSerializer(
  guestStoreDetailParsers,
);
