import { StoreDescription, StoreName, StoreRoom } from "@/entities/store";
import { v } from "@/shared/lib/valibot";
import { UploadImage } from "@/shared/model/upload-image";

export const CreateStoreForm = v.object({
  name: StoreName,
  description: StoreDescription,
  room: StoreRoom,
  // Inputの初期値用にundefinedを許容する
  image: v.optional(UploadImage),
});

export type CreateStoreForm = v.InferOutput<typeof CreateStoreForm>;
