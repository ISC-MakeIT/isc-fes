import { getApiBaseUrl } from "./env";
import {
  MenuEditorTarget,
  serializeMenuEditor,
} from "../search-params/menu-editor";
import {
  GuestStoreDetailSearchParams,
  serializeGuestStoreDetail,
} from "../search-params/cart-sheet";

export const ordersUrl = () => "/orders";
export const loginUrl = (redirectTo?: string) => {
  if (redirectTo === undefined) {
    return "/login";
  }
  const searchParams = new URLSearchParams({
    redirect_to: redirectTo,
  });

  return `/login?${searchParams.toString()}`;
};
export const googleLoginUrl = (redirectTo?: string) => {
  const url = new URL("/auth/google/login", getApiBaseUrl());

  if (redirectTo !== undefined) {
    url.searchParams.set("redirect_to", redirectTo);
  }

  return url.toString();
};
export const storeInvitationsUrl = (invitationId: string) =>
  `/invites/${invitationId}`;

// 店舗ページ
// TODO: 引数名のidをわかりやすい名前にする
export const storeListUrl = () => "/member/stores";
export const registerStoreUrl = () => "/member/stores/register";
export const storeHomeUrl = (id: string) => `/member/stores/${id}`;
export const storeEditUrl = (id: string) => `/member/stores/${id}/edit`;
export const storeKitchenUrl = (id: string) => `/member/stores/${id}/kitchen`;
export const storePickupUrl = (id: string) => `/member/stores/${id}/pickup`;
export const storeCallUrl = (id: string) => `/member/stores/${id}/call`;
export const storeMenusUrl = (id: string) => `/member/stores/${id}/menus`;
export const storeMenuEditorUrl = (
  storeId: string,
  editorTarget: MenuEditorTarget,
  itemId?: string,
) => serializeMenuEditor(storeMenusUrl(storeId), { editorTarget, itemId });

// 管理者ページ
export const storeApplicationsUrl = () => "/admin/store-applications";

// ゲスト用のページ
export const homeUrl = () => "/";
export const guestStoreDetailUrl = (
  storeId: string,
  searchParams?: GuestStoreDetailSearchParams,
) => {
  const pathname = `/stores/${storeId}`;

  return serializeGuestStoreDetail(pathname, searchParams ?? null);
};
export const eventsUrl = (eventName?: string) =>
  eventName ? `/events#${encodeURIComponent(eventName)}` : "/events";
export const guestMenuDetailUrl = (storeId: string, menuId: string) =>
  `/stores/${storeId}/menus/${menuId}`;
export const guestCheckoutUrl = (storeId: string) =>
  `/stores/${storeId}/checkout`;
