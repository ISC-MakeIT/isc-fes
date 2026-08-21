import { getAccount } from "@/entities/account/index.server";
import { loginUrl, storeListUrl } from "@/shared/config";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const currentAccount = await getAccount();

  if (!currentAccount) redirect(loginUrl());

  if (currentAccount.role !== "admin") {
    redirect(storeListUrl());
  }

  return <SidebarProvider>{props.children}</SidebarProvider>;
}
