"use client";

import { AspectRatio } from "@/shared/ui/aspect-ratio";
import Image from "next/image";
import { useEffect, useState } from "react";

type PreviewImageProps =
  | {
      imageFile: File | undefined;
      imagePath?: never;
    }
  | { imageFile?: never; imagePath: string };

// TODO: メニュー登録画面でも使いそうなので、aspect比とか変えられるようにリファクタする
export function PreviewImage({ imageFile, imagePath }: PreviewImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const previewUrl = imagePath ?? objectUrl;

  useEffect(() => {
    if (!imageFile) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setObjectUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [imageFile]);

  return (
    <AspectRatio
      ratio={16 / 9}
      className="bg-muted overflow-hidden rounded-md border border-dashed"
    >
      {previewUrl && (
        <Image
          fill
          className="absolute inset-0 h-full w-full object-cover"
          src={previewUrl}
          alt="店舗写真プレビュー"
        />
      )}
    </AspectRatio>
  );
}
