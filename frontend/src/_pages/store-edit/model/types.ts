import { Room } from "@/entities/room";
import { StoreDescription } from "@/entities/store";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model";

export const StoreEditFormValues = v.object({
  room: Room,
  description: StoreDescription,
  allergenIds: v.array(v.string()),
  image: v.optional(UploadImage),
  orderEnabled: v.boolean(),
});

export type StoreEditFormValues = v.InferOutput<typeof StoreEditFormValues>;
