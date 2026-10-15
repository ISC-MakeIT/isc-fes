import { GuestOrderSync } from "@/features/sync-guest-orders";
import { GuestFooter } from "./_ui/guest-footer";
import { GuestHeader } from "./_ui/guest-header";

export default function GuestPageLayout(props: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GuestOrderSync />
      <GuestHeader />
      <main className="flex-1">{props.children}</main>
      <GuestFooter />
    </div>
  );
}
