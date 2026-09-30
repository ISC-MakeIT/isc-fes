import { ComponentProps } from "react";
import { AspectRatio } from "./aspect-ratio";
import Image, { type ImageProps } from "next/image";
import { cn } from "../lib/utils";

type AspectRatioImageProps = ComponentProps<typeof AspectRatio> & {
  src?: ImageProps["src"] | null;
  alt: string;
};

export function AspectRatioImage({
  ratio,
  src,
  alt,
  className,
}: AspectRatioImageProps) {
  return (
    <AspectRatio
      ratio={ratio}
      className={cn("bg-muted overflow-hidden", className)}
    >
      {src && <Image src={src} alt={alt} className="object-cover" fill />}
    </AspectRatio>
  );
}
