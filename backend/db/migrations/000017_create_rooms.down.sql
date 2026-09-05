BEGIN;

ALTER TABLE stores
    DROP CONSTRAINT stores_room_fkey;

DROP TABLE rooms;

COMMIT;
