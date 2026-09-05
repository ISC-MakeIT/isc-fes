BEGIN;

CREATE TABLE rooms (
    name VARCHAR(50) PRIMARY KEY,
    sort_order SMALLINT NOT NULL CHECK (sort_order >= 0)
);

-- 外部キーを追加する前に、既存店舗の教室をマスタへ移行する。
INSERT INTO rooms (name, sort_order)
SELECT
    room,
    (ROW_NUMBER() OVER (ORDER BY room) - 1)::SMALLINT
FROM (
    SELECT DISTINCT room
    FROM stores
) AS existing_rooms;

ALTER TABLE stores
    ADD CONSTRAINT stores_room_fkey
    FOREIGN KEY (room)
    REFERENCES rooms(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

COMMIT;
