import { Card } from "@/shared/ui/card";
import { DotText } from "@/shared/ui/dot-text";

type HeadingCardProps = {
  children: React.ReactNode;
};

export function HeadingCard({ children }: HeadingCardProps) {
  return (
    <Card className="bg-primary mx-auto rounded-sm px-6 py-2 text-center text-2xl text-white shadow-[7px_7px_0_rgb(254,218,62)]">
      <DotText>
        <h1>{children}</h1>
      </DotText>
    </Card>
  );
}
