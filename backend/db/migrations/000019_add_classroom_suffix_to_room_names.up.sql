UPDATE rooms
SET name = name || '教室'
WHERE name ~ '^(50[1-9]|60[1-8]|707)$';
