import { SidebarProvider } from "@/shared/ui/sidebar";

export default async function StoreManagerLayout(
  props: LayoutProps<"/stores/[id]">,
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
