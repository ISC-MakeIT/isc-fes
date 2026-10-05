import { fetchCurrentAccount } from "@/entities/account";
import { AccountRole } from "@/entities/account";
import { loginUrl, storeListUrl } from "@/shared/config";
import { AppSidebarLayout } from "@/widgets/app-sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout(props: LayoutProps<"/admin">) {
  const currentAccount = await fetchCurrentAccount();

  if (!currentAccount) redirect(loginUrl());

  if (currentAccount.role !== AccountRole.Admin) {
    redirect(storeListUrl());
  }

  return (
    <AppSidebarLayout sidebar={{ variant: "admin" }}>
      {props.children}
    </AppSidebarLayout>
  );
}
