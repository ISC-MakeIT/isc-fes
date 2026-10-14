import { Room } from "@/entities/room";
import { StoreDescription, StoreName } from "@/entities/store";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model";

export const CreateStoreForm = v.object({
  name: StoreName,
  description: StoreDescription,
  room: v.optional(Room),
  allergenIds: v.array(v.string()),
  // Inputの初期値用にundefinedを許容する
  image: v.optional(UploadImage),
  orderEnabled: v.boolean(),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;

export const CreateStoreInput = v.object({
  name: StoreName,
  room: Room,
  description: StoreDescription,
  allergenIds: v.array(v.string()),
  image: UploadImage,
  orderEnabled: v.boolean(),
});
export type CreateStoreInput = v.InferOutput<typeof CreateStoreInput>;
