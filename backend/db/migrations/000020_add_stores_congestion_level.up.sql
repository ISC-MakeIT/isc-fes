ALTER TABLE stores
ADD COLUMN congestion_level INTEGER NOT NULL DEFAULT 1
    CONSTRAINT stores_congestion_level_check CHECK (congestion_level IN (1, 2, 3));
