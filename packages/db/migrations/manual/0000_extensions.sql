-- 0000_extensions.sql — required Postgres extensions (idempotent).
-- Run FIRST (before the generated table migration, which uses the vector type).
-- gen_random_uuid() is Postgres-16 core, so no pgcrypto is needed.
CREATE EXTENSION IF NOT EXISTS vector;
