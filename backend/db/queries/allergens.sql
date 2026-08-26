-- name: GetAllergens :many
SELECT *
FROM allergens;

-- name: GetStoreAllergensByStoreIDs :many
SELECT
    store_allergens.store_id,
    allergens.id,
    allergens.name
FROM allergens
INNER JOIN store_allergens
    ON allergens.id = store_allergens.allergen_id
WHERE store_allergens.store_id = ANY(sqlc.arg(store_ids)::uuid[])
ORDER BY store_allergens.store_id ASC, allergens.name ASC, allergens.id ASC;
