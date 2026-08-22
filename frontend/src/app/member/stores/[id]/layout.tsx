import { SidebarProvider } from "@/shared/ui/sidebar";

export default function StoreManagerLayout(
  props: LayoutProps<"/member/stores/[id]">,
) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "10rem",
        } as React.CSSProperties
      }
      defaultOpen={false}
    >
      {props.children}
    </SidebarProvider>
  );
}
