import { fetchCurrentAccount } from "@/entities/account";
import { AccountRole } from "@/entities/account/model/types";
import { loginUrl, storeListUrl } from "@/shared/config";
import { SidebarProvider } from "@/shared/ui/sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const currentAccount = await fetchCurrentAccount();

  if (!currentAccount) redirect(loginUrl());

  if (currentAccount.role !== AccountRole.Admin) {
    redirect(storeListUrl());
  }

  return <SidebarProvider>{props.children}</SidebarProvider>;
}
