UPDATE rooms
SET name = left(name, 3)
WHERE name ~ '^(50[1-9]|60[1-8]|707)教室$';
