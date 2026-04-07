-- Remove name uniqueness constraint entirely from users table
-- Names can repeat within the same place (multi-tenant, same-name allowed)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_place_unique;
