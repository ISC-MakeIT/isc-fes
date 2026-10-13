import { Api, cart, list, order, type Guest, type Order } from "./client";
import type { Config, StoreFixture } from "./config";
import type { Recorder } from "./stats";

export async function pause(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new Error("stopped");
  if (!ms) return;
  await new Promise<void>((resolve, reject) => {
    const stop = () => { clearTimeout(timer); signal.removeEventListener("abort", stop); reject(new Error("stopped")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

export async function workflow(api: Api, c: Config, r: Recorder, guest: Guest, fixture: StoreFixture, staff: string, roll: number, jitter: number, stop: AbortSignal): Promise<void> {
  const store = `/stores/${fixture.storeId}`;
  const get = <T>(label: string, path: string, decode: (v: unknown) => T) => api.request(r, label, path, { guest, decode });
  const think = () => pause(c.thinkTimeMs * (.5 + jitter), stop);
  await get("GET stores", "/stores", list);
  await think();
  await get("GET store", store, v => {
    if (!v || (v as { id?: string }).id !== fixture.storeId) throw new Error("invalid store response");
    return v;
  });
  await get("GET menus", `${store}/menus`, list);
  await get("GET toppings", `${store}/menus/${fixture.menuId}/toppings`, list);
  await get("GET orders", "/orders", list);
  if (roll >= c.cartProbability + c.checkoutProbability) {
    await get("GET rooms", "/rooms", list);
    await get("GET allergens", "/allergens", list);
    return;
  }
  let current = await get("GET cart", `${store}/carts`, cart);
  // Add, change quantity, then remove for cart-only users. Include server item IDs on edits.
  current = await api.request(r, "PUT cart.add", `${store}/carts`, {
    guest, method: "PUT", body: { expectedVersion: current.version, items: [{ menuId: fixture.menuId, quantity: 1, toppingIds: fixture.toppingIds }] }, decode: cart,
  });
  await think();
  current = await api.request(r, "PUT cart.quantity", `${store}/carts`, {
    guest, method: "PUT", body: { expectedVersion: current.version, items: current.items.map(item => ({ id: item.id, menuId: item.menuId, quantity: 2, toppingIds: item.toppings.map(t => t.toppingId) })) }, decode: cart,
  });
  if (roll >= c.checkoutProbability) {
    await api.request(r, "PUT cart.remove", `${store}/carts`, { guest, method: "PUT", body: { expectedVersion: current.version, items: [] }, decode: cart });
    return;
  }
  if (!current.canCheckout) throw new Error("fixture is not checkoutable");
  let created = await api.request(r, "POST order", "/orders", {
    guest, method: "POST", body: { storeId: fixture.storeId, expectedCartVersion: current.version }, statuses: [201], decode: order,
  });
  await get("GET order", `/orders/${created.id}`, order);
  await pause(c.kitchenDelayMs * (.5 + jitter), stop);
  const update = async (previous: Order, status: string) => {
    // Register before PATCH: orders.changed can arrive before the HTTP response.
    const expectations = guest.sockets.map(socket => socket.expect(r, previous.id, previous.version + 1, status));
    let result: Order;
    try {
      result = await api.request(r, `PATCH order.${status}`, `${store}/orders/${previous.id}`, {
        staff, method: "PATCH", body: { expectedVersion: previous.version, status }, decode: v => {
          const next = order(v);
          if (next.id !== previous.id || next.status !== status || next.version !== previous.version + 1) throw new Error("invalid transition response");
          return next;
        },
      });
    } catch (error) { expectations.forEach(e => e.cancel()); throw error; }
    const received = await Promise.all(expectations.map(e => e.done));
    // Complete the lifecycle even if a notification fails, so active-order limits don't poison subsequent requests.
    return { order: result, notificationsOk: received.every(Boolean) };
  };
  const ready = await update(created, "ready");
  created = ready.order;
  await think();
  const completed = await update(created, "completed");
  await api.request(r, "GET kitchen orders", `${store}/orders?statuses=pending&statuses=ready`, { staff, decode: list });
  if (!ready.notificationsOk || !completed.notificationsOk) throw new Error("notification missing");
}
