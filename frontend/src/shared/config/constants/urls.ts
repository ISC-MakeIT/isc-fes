export const homeUrl = () => "/";
export const ordersUrl = () => "/orders";
export const loginUrl = () => "/login";
export const storeInvitationsUrl = (invitationId: string) =>
  `/invites/${invitationId}`;

// 店舗ページ
export const storeListUrl = () => "/member/stores";
export const registerStoreUrl = () => "/member/stores/register";
export const storeHomeUrl = (storeId: string) => `/member/stores/${storeId}`;
export const storeKitchenUrl = (storeId: string) =>
  `/member/stores/${storeId}/kitchen`;
export const storePickupUrl = (storeId: string) =>
  `/member/stores/${storeId}/pickup`;
export const storeCallUrl = (storeId: string) =>
  `/member/stores/${storeId}/call`;
export const storeMenusUrl = (storeId: string) =>
  `/member/stores/${storeId}/menus`;

// 管理者ページ
export const storeApplicationsUrl = () => "/admin/store-applications";
