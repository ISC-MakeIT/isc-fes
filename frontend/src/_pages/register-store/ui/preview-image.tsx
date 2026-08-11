import { AspectRatio } from "@/shared/ui/aspect-ratio";
import Image from "next/image";
import { useEffect, useState } from "react";

type PreviewImageProps = {
  image: File | undefined;
};

export function PreviewImage({ image }: PreviewImageProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(image);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [image]);

  return (
    <AspectRatio
      ratio={16 / 9}
      className="bg-muted overflow-hidden rounded-md border border-dashed"
    >
      {previewUrl && (
        <Image
          width={0}
          height={0}
          className="absolute inset-0 h-full w-full object-cover"
          src={previewUrl}
          alt="店舗写真プレビュー"
        />
      )}
    </AspectRatio>
  );
}
