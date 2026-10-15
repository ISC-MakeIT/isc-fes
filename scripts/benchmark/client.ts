import type { Config } from "./config";
import { Recorder } from "./stats";

export type Cart = { version: number; items: { id: string; menuId: string; quantity: number; toppings: { toppingId: string }[] }[] };
export type Order = { id: string; version: number; status: string };
export type Guest = { cookie: string; busy: boolean; sockets: OrderSocket[] };
export type Fetcher = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => ReturnType<typeof fetch>;
export const newGuest = (): Guest => ({ cookie: "", busy: false, sockets: [] });

export function guestCookie(headers: Headers, previous: string): string {
  for (const cookie of headers.getSetCookie()) {
    const pair = cookie.split(";", 1)[0]!;
    if (pair.startsWith("isc_fes_guest_session=")) return pair;
  }
  return previous;
}
export function staffCookie(value: string | undefined): string {
  if (!value || !/^isc_fes_account_session=[^;\s\r\n]+$/.test(value)) {
    throw new Error("Staff cookie env must contain only isc_fes_account_session=<token>");
  }
  return value;
}
export function cart(value: unknown): Cart {
  const c = value as Cart | null;
  if (!c || !Number.isInteger(c.version) || c.version < 1 || !Array.isArray(c.items)) throw new Error("invalid cart response");
  for (const item of c.items) {
    if (typeof item.id !== "string" || typeof item.menuId !== "string" || !Number.isInteger(item.quantity) || !Array.isArray(item.toppings) || item.toppings.some(t => typeof t.toppingId !== "string")) throw new Error("invalid cart item");
  }
  return c;
}
// codeがnullなら注文可能。注文できない理由はAPIのenumで返る。
export function checkoutable(value: unknown): { code: string | null } {
  const v = value as { code?: unknown } | null;
  if (!v || (v.code !== null && typeof v.code !== "string")) throw new Error("invalid checkoutable response");
  return { code: v.code };
}
export function order(value: unknown): Order {
  const o = value as Order | null;
  if (!o || typeof o.id !== "string" || !Number.isInteger(o.version) || o.version < 1 || !["pending", "ready", "completed", "cancelled"].includes(o.status)) throw new Error("invalid order response");
  return o;
}
export function list(value: unknown): unknown[] {
  const l = value as { data?: unknown[] } | null;
  if (!l || !Array.isArray(l.data)) throw new Error("invalid list response");
  return l.data;
}
export function changedOrders(value: unknown): { changedOrderId: string; orders: Order[] } {
  const v = value as { type?: string; data?: { changedOrderId?: string; orders?: unknown[] } } | null;
  if (v?.type !== "orders.changed" || typeof v.data?.changedOrderId !== "string" || !Array.isArray(v.data.orders)) throw new Error("invalid orders.changed message");
  return { changedOrderId: v.data.changedOrderId, orders: v.data.orders.map(order) };
}

// WSの注文一覧はpending/readyだけを含む。completed/cancelledになった注文は一覧から外れるため、
// changedOrderIdが一致し、一覧に残っていないことを到達とみなす。
export function isExpectedChange(changed: { changedOrderId: string; orders: Order[] }, expected: { id: string; version: number; status: string }): boolean {
  if (changed.changedOrderId !== expected.id) return false;
  if (expected.status === "completed" || expected.status === "cancelled") return changed.orders.every(o => o.id !== expected.id);
  return changed.orders.some(o => o.id === expected.id && o.version === expected.version && o.status === expected.status);
}

export class Api {
  constructor(private config: Config, private stop: AbortSignal, private fetcher: Fetcher = fetch) {}
  async request<T>(r: Recorder, label: string, path: string, options: {
    method?: string; body?: unknown; guest?: Guest; staff?: string; statuses?: number[]; decode: (value: unknown) => T;
  }): Promise<T> {
    const started = performance.now();
    let status = "transport_error", bytes = 0;
    try {
      const headers = new Headers({ Origin: this.config.origin, Accept: "application/json" });
      const cookie = options.staff ?? options.guest?.cookie;
      if (cookie) headers.set("Cookie", cookie);
      if (options.body !== undefined) headers.set("Content-Type", "application/json");
      const response = await this.fetcher(this.config.baseUrl + path, {
        method: options.method ?? "GET", headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: "error", signal: AbortSignal.any([this.stop, AbortSignal.timeout(this.config.requestTimeoutMs)]),
      });
      status = String(response.status);
      if (options.guest) options.guest.cookie = guestCookie(response.headers, options.guest.cookie);
      const text = await response.text(); // Latency includes body transfer, not just headers.
      bytes = Buffer.byteLength(text);
      if (!(options.statuses ?? [200]).includes(response.status)) throw new Error("HTTP failure");
      status = `${response.status}:invalid_body`;
      const value = options.decode(JSON.parse(text));
      r.record(label, performance.now() - started, true, String(response.status), bytes);
      return value;
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") status = "timeout";
      if (this.stop.aborted) status = "aborted";
      r.record(label, performance.now() - started, false, status, bytes);
      // Never emit fetch errors, response bodies, or cookies in reports.
      throw new Error(`${label} failed (${status})`);
    }
  }
}

type Waiter = { id: string; version: number; status: string; finish: (ok: boolean, reason: string) => void };
export type SocketTransport = Pick<Bun.WebSocket, "onmessage" | "onerror" | "onclose" | "terminate">;
export type SocketFactory = (url: URL, options: Bun.WebSocketOptions) => SocketTransport;
export class OrderSocket {
  private socket: SocketTransport | undefined;
  private intentional = false;
  private abortConnect: (() => void) | undefined;
  private waiters = new Set<Waiter>();
  ready = false;
  constructor(private config: Config, private guest: Guest, private current: () => Recorder, private gauge: (delta: number) => void,
    private factory: SocketFactory = (url, options) => new WebSocket(url, options)) {}
  async connect(): Promise<void> {
    const r = this.current(), started = performance.now();
    const endpoint = new URL("/ws/orders", this.config.baseUrl);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (ok: boolean, reason: string) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        this.abortConnect = undefined;
        r.record("ws.ready", performance.now() - started, ok, reason);
        if (ok) resolve(); else { this.close(); reject(new Error(`WS ready failed (${reason})`)); }
      };
      const timer = setTimeout(() => finish(false, "timeout"), this.config.requestTimeoutMs);
      this.abortConnect = () => finish(false, "client_stopped");
      try {
        this.socket = this.factory(endpoint, { headers: { Origin: this.config.origin, Cookie: this.guest.cookie } });
        this.socket.onmessage = event => {
          if (this.intentional) return;
          const active = this.current();
          try {
            if (typeof event.data !== "string") throw new Error("expected text message");
            active.wsMessages++; active.wsBytes += Buffer.byteLength(event.data);
            const value = JSON.parse(event.data);
            if (!this.ready) {
              if (value.type !== "connection.ready" || !Array.isArray(value.data?.orders)) throw new Error("expected connection.ready");
              value.data.orders.forEach(order);
              this.ready = true; this.gauge(1); finish(true, "ready");
              return;
            }
            const changed = changedOrders(value);
            for (const waiter of this.waiters) {
              if (isExpectedChange(changed, waiter)) waiter.finish(true, "received");
            }
          } catch {
            active.wsProtocolErrors++;
            finish(false, "protocol_error");
            this.close();
          }
        };
        this.socket.onerror = () => finish(false, "handshake_or_transport_error");
        this.socket.onclose = event => {
          if (this.ready) { this.ready = false; this.gauge(-1); }
          if (!this.intentional) {
            const active = this.current(), code = String(event.code);
            active.wsUnexpectedCloses[code] = (active.wsUnexpectedCloses[code] ?? 0) + 1;
          }
          for (const waiter of this.waiters) waiter.finish(false, "socket_closed");
          finish(false, `close_${event.code}`);
        };
      } catch { finish(false, "constructor_error"); }
    });
  }
  expect(r: Recorder, id: string, version: number, status: string): { done: Promise<boolean>; cancel: () => void } {
    const started = performance.now();
    let cancel = () => {};
    const done = new Promise<boolean>(resolve => {
      let settled = false;
      const waiter: Waiter = { id, version, status, finish: (ok, reason) => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.waiters.delete(waiter);
        r.record("ws.notification", performance.now() - started, ok, reason);
        resolve(ok);
      } };
      const timer = setTimeout(() => waiter.finish(false, "timeout"), this.config.notificationTimeoutMs);
      cancel = () => waiter.finish(false, "update_failed");
      this.waiters.add(waiter);
      if (!this.ready) waiter.finish(false, "socket_not_ready");
    });
    return { done, cancel: () => cancel() };
  }
  close(): void {
    if (this.intentional) return;
    this.intentional = true;
    this.abortConnect?.();
    if (this.ready) { this.ready = false; this.gauge(-1); }
    for (const waiter of this.waiters) waiter.finish(false, "client_stopped");
    // Bun's terminate releases connecting sockets too; no hanging close handshake at shutdown.
    this.socket?.terminate();
  }
}
