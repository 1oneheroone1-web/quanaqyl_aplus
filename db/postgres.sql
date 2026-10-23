-- Application storage for a new PostgreSQL deployment. The original drizzle/
-- migrations remain as SQLite regression fixtures; do not apply them here.
CREATE TABLE profiles (
  user_id text PRIMARY KEY, data text NOT NULL, photo_key text, updated_at bigint NOT NULL
);
CREATE TABLE attempts (
  user_id text NOT NULL, id text NOT NULL, data text NOT NULL, created_at bigint NOT NULL,
  PRIMARY KEY (user_id,id)
);
CREATE TABLE awards (
  user_id text NOT NULL, key text NOT NULL, amount integer NOT NULL, created_at bigint NOT NULL,
  PRIMARY KEY (user_id,key)
);
CREATE TABLE pauses (
  user_id text NOT NULL, id text NOT NULL, start bigint NOT NULL, "end" bigint,
  PRIMARY KEY (user_id,id)
);
CREATE TABLE shop_purchases (
  user_id text NOT NULL, id text NOT NULL, product_id text NOT NULL,
  quantity integer NOT NULL, unit_price integer NOT NULL, total integer NOT NULL, created_at bigint NOT NULL,
  PRIMARY KEY (user_id,id),
  CONSTRAINT shop_quantity_range CHECK (quantity BETWEEN 1 AND 10),
  CONSTRAINT shop_positive_price CHECK (unit_price > 0),
  CONSTRAINT shop_total_matches CHECK (total = quantity * unit_price)
);
CREATE INDEX shop_purchases_user_date ON shop_purchases (user_id,created_at);
CREATE TABLE focus_timers (
  user_id text PRIMARY KEY, data text NOT NULL, revision integer NOT NULL, request_id text NOT NULL
);
CREATE TABLE focus_sessions (
  user_id text NOT NULL, id text NOT NULL, started_at bigint NOT NULL, ended_at bigint NOT NULL,
  planned_ms bigint NOT NULL, focus_ms bigint NOT NULL, completed integer NOT NULL,
  PRIMARY KEY (user_id,id),
  CONSTRAINT focus_valid_duration CHECK (focus_ms > 0 AND focus_ms <= planned_ms AND planned_ms BETWEEN 60000 AND 7200000),
  CONSTRAINT focus_valid_dates CHECK (ended_at >= started_at AND focus_ms <= ended_at - started_at),
  CONSTRAINT focus_valid_completion CHECK (completed IN (0,1) AND (completed = 0 OR focus_ms = planned_ms))
);
CREATE INDEX focus_sessions_user_date ON focus_sessions (user_id,ended_at);
CREATE TABLE photos (
  user_id text PRIMARY KEY, content_type text NOT NULL, bytes bytea NOT NULL, updated_at bigint NOT NULL,
  CONSTRAINT photo_size CHECK (octet_length(bytes) BETWEEN 1 AND 2097152),
  CONSTRAINT photo_content_type CHECK (content_type IN ('image/png','image/jpeg','image/webp'))
);
