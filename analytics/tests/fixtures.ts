import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { PoolClient } from "pg";

export const ids = {
  a: "00000000-0000-4000-8000-000000000001",
  b: "00000000-0000-4000-8000-000000000002",
  m1: "00000000-0000-4000-8000-000000000011",
  m2: "00000000-0000-4000-8000-000000000012",
  m3: "00000000-0000-4000-8000-000000000013",
  staff: "00000000-0000-4000-8000-000000000021",
  topping: "00000000-0000-4000-8000-000000000031",
};
export async function migrate(client: PoolClient) {
  const dir = resolve(import.meta.dir, "../../backend/db/migrations");
  for (const name of (await readdir(dir)).filter((n) => n.endsWith(".up.sql")).sort())
    await client.query(await readFile(resolve(dir, name), "utf8"));
}
export async function seed(client: PoolClient) {
  await client.query(`INSERT INTO rooms(name,sort_order) VALUES ('501教室',0);
    INSERT INTO accounts(id,google_sub,email) VALUES ('${ids.staff}','analytics-test','test@example.invalid');
    INSERT INTO stores(id,name,room,description,image_object_key,review_status,created_at,congestion_level) VALUES
      ('${ids.a}','たこ焼き研究所','501教室','','','approved','2026-10-01',3),
      ('${ids.b}','喫茶ひだまり','501教室','','','approved','2026-10-01',1);
    INSERT INTO menus(id,store_id,name,description,unit_price,image_object_key) VALUES
      ('${ids.m1}','${ids.a}','たこ焼き','',300,''),('${ids.m2}','${ids.a}','ラムネ','',200,''),('${ids.m3}','${ids.b}','コーヒー','',500,'');
    INSERT INTO toppings(id,store_id,name,unit_price) VALUES ('${ids.topping}','${ids.a}','チーズ',50);`);
  const orders = [
    { time: "09:30", status: "pending", menu: ids.m1, store: ids.a, price: 300 },
    {
      time: "10:00",
      status: "completed",
      ready: "10:05",
      completed: "10:10",
      menu: ids.m1,
      store: ids.a,
      price: 300,
      quantity: 2,
      topping: true,
      extra: true,
    },
    {
      time: "10:15",
      status: "cancelled",
      ready: "10:25",
      cancelled: "10:40",
      menu: ids.m1,
      store: ids.a,
      price: 300,
    },
    { time: "10:30", status: "ready", ready: "10:35", menu: ids.m2, store: ids.a, price: 200 },
    {
      time: "11:00",
      status: "completed",
      ready: "11:30",
      completed: "11:40",
      menu: ids.m1,
      store: ids.a,
      price: 300,
      face: true,
    },
    { time: "11:30", status: "pending", menu: ids.m1, store: ids.a, price: 300 },
    {
      time: "12:00",
      status: "completed",
      ready: "12:05",
      completed: "12:10",
      menu: ids.m1,
      store: ids.a,
      price: 300,
    },
    {
      time: "10:05",
      status: "completed",
      ready: "10:06",
      completed: "10:07",
      menu: ids.m3,
      store: ids.b,
      price: 500,
    },
  ];
  for (const [i, o] of orders.entries()) {
    const {
      rows: [guest],
    } = await client.query("INSERT INTO guests DEFAULT VALUES RETURNING id");
    const {
      rows: [cart],
    } = await client.query("INSERT INTO carts(guest_id,store_id) VALUES ($1,$2) RETURNING id", [
      guest.id,
      o.store,
    ]);
    const at = (time?: string) => (time ? `2026-10-24T${time}:00+09:00` : null);
    const amount = (o.price + (o.topping ? 50 : 0)) * (o.quantity ?? 1) + (o.extra ? 200 : 0);
    const {
      rows: [order],
    } = await client.query(
      `INSERT INTO orders(store_id,guest_id,status,total_amount,display_number,origin_cart_id,origin_cart_version,limit_exempted_by_account_id,store_name,room_name,created_at,updated_at,ready_at,completed_at,cancelled_at)
      VALUES($1,$2,$3,$4,$5,$6,1,$7,'注文時の店舗名','501教室',$8,$9,$10,$11,$12) RETURNING id`,
      [
        o.store,
        guest.id,
        o.status,
        amount,
        i + 1,
        cart.id,
        o.face ? ids.staff : null,
        at(o.time),
        at(o.completed ?? o.cancelled ?? o.ready ?? o.time),
        at(o.ready),
        at(o.completed),
        at(o.cancelled),
      ],
    );
    const {
      rows: [item],
    } = await client.query(
      "INSERT INTO order_items(order_id,store_id,menu_id,menu_name,unit_price,quantity) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        order.id,
        o.store,
        o.menu,
        o.menu === ids.m3 ? "コーヒー" : o.menu === ids.m2 ? "ラムネ" : "たこ焼き",
        o.price,
        o.quantity ?? 1,
      ],
    );
    if (o.topping)
      await client.query(
        "INSERT INTO order_item_toppings(order_item_id,store_id,topping_id,topping_name,unit_price) VALUES ($1,$2,$3,$4,50)",
        [item.id, o.store, ids.topping, "チーズ"],
      );
    if (o.extra)
      await client.query(
        "INSERT INTO order_items(order_id,store_id,menu_id,menu_name,unit_price,quantity) VALUES ($1,$2,$3,$4,200,1)",
        [order.id, o.store, ids.m2, "ラムネ"],
      );
  }
  for (const [time, level] of [
    ["09:00", 1],
    ["10:15", 3],
    ["10:45", 2],
  ] as const) {
    await client.query(
      `INSERT INTO activity_log(occurred_at,event_type,store_id,subject_type,subject_id,actor_account_id,payload) VALUES($1,'store.updated',$2,'store',$2,$3,$4)`,
      [`2026-10-24T${time}:00+09:00`, ids.a, ids.staff, { after: { congestion_level: level } }],
    );
  }
}
