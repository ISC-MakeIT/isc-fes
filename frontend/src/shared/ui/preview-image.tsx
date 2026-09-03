"use client";

import { AspectRatio } from "@/shared/ui/aspect-ratio";
import { ComponentProps, useEffect, useState } from "react";
import { AspectRatioImage } from "./aspect-ratio-image";
import { cn } from "../lib/utils";

type PreviewImageProps =
  | (ComponentProps<typeof AspectRatio> & {
      imageFile: File | undefined;
      imagePath?: never;
      alt: string;
    })
  | (ComponentProps<typeof AspectRatio> & {
      imageFile?: never;
      imagePath: string;
      alt: string;
    });

export function PreviewImage({
  className,
  alt,
  ratio,
  imageFile,
  imagePath,
}: PreviewImageProps) {
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
    <AspectRatioImage
      ratio={ratio}
      src={previewUrl}
      alt={alt}
      className={cn(className)}
    />
  );
}
