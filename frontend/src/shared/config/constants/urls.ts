import { getApiBaseUrl } from "./env";
import {
  MenuEditorTarget,
  serializeMenuEditor,
} from "../search-params/menu-editor";

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
export const storeListUrl = () => "/member/stores";
export const registerStoreUrl = () => "/member/stores/register";
export const storeHomeUrl = (storeId: string) => `/member/stores/${storeId}`;
export const storeEditUrl = (storeId: string) =>
  `/member/stores/${storeId}/edit`;
export const storeKitchenUrl = (storeId: string) =>
  `/member/stores/${storeId}/kitchen`;
export const storePickupUrl = (storeId: string) =>
  `/member/stores/${storeId}/pickup`;
export const storeCallUrl = (storeId: string) =>
  `/member/stores/${storeId}/call`;
export const storeMenusUrl = (storeId: string) =>
  `/member/stores/${storeId}/menus`;
export const storeMenuEditorUrl = (
  storeId: string,
  editorTarget: MenuEditorTarget,
  itemId?: string,
) => serializeMenuEditor(storeMenusUrl(storeId), { editorTarget, itemId });

// 管理者ページ
export const storeApplicationsUrl = () => "/admin/store-applications";

// ゲスト用のページ
export const homeUrl = () => "/";
export const guestStoreDetailUrl = (storeId: string) => `/stores/${storeId}`;
export const eventsUrl = (eventName?: string) =>
  eventName ? `/events#${encodeURIComponent(eventName)}` : "/events";
export const guestMenuDetailUrl = (storeId: string, menuId: string) =>
  `/stores/${storeId}/menus/${menuId}`;
export const guestCheckoutUrl = (storeId: string) =>
  `/stores/${storeId}/checkout`;
