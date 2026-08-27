export const homeUrl = () => "/";
export const loginUrl = () => "/login";

// 店舗ページ
export const storeListUrl = () => "/member/stores";
export const registerStoreUrl = () => "/member/stores/register";
export const storeHomeUrl = (id: string) => `/member/stores/${id}`;
export const storeKitchenUrl = (id: string) => `/member/stores/${id}/kitchen`;
export const storePickupUrl = (id: string) => `/member/stores/${id}/pickup`;
export const storeCallUrl = (id: string) => `/member/stores/${id}/call`;
export const storeMenusUrl = (id: string) => `/member/stores/${id}/menus`;

// 管理者ページ
export const storeApplicationsUrl = () => "/admin/store-applications";
