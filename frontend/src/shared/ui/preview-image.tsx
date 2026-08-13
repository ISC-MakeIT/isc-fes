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

export function PreviewImage({ imageFile, imagePath }: PreviewImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (imagePath) {
      setPreviewUrl(imagePath);
      return;
    }
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

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
