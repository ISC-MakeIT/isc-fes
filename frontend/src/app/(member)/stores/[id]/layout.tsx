import { SidebarProvider } from "@/shared/ui/sidebar";

export default async function StoreManagerLayout(
  props: LayoutProps<"/stores/[id]">,
) {
  return (
    <SidebarProvider defaultOpen={false}>{props.children}</SidebarProvider>
  );
}
