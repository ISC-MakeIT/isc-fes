import { ComponentProps } from "react";
import { AspectRatio } from "./aspect-ratio";
import Image from "next/image";
import { cn } from "../lib/utils";

type AspectRatioImageProps = ComponentProps<typeof AspectRatio> & {
  src: string;
  alt: string;
};

export function AspectRatioImage({
  ratio,
  src,
  alt,
  className,
}: AspectRatioImageProps) {
  return (
    <AspectRatio ratio={ratio} className={cn("overflow-hidden", className)}>
      <Image src={src} alt={alt} className="object-cover" fill />
    </AspectRatio>
  );
}
