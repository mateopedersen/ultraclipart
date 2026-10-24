-- Public artwork is stored only after the creator explicitly publishes it.
-- Daily abuse counters survive deletion for seven days; compact deleted ids
-- remain to prevent URL revival (hard-capped at 10,000 lifetime publications).
-- No raw IPs, prompts, or plaintext capability tokens are stored.
CREATE TABLE IF NOT EXISTS public_shares (
  id TEXT PRIMARY KEY CHECK(length(id)=32),
  title TEXT NOT NULL CHECK(length(title)<=100),
  image BLOB,
  image_bytes INTEGER NOT NULL CHECK(image_bytes>=0 AND image_bytes<=393216),
  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 2048),
  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 2048),
  created INTEGER NOT NULL,
  day TEXT NOT NULL,
  visitor TEXT,
  network TEXT,
  delete_hash TEXT,
  deleted_at INTEGER,
  CHECK((deleted_at IS NULL AND image IS NOT NULL AND length(image)=image_bytes AND image_bytes>0 AND delete_hash IS NOT NULL AND length(delete_hash)=64)
    OR (deleted_at IS NOT NULL AND image IS NULL AND image_bytes=0 AND delete_hash IS NULL AND title=''))
);
CREATE INDEX IF NOT EXISTS public_shares_active ON public_shares(deleted_at,image_bytes);
CREATE INDEX IF NOT EXISTS public_shares_day ON public_shares(day);
CREATE INDEX IF NOT EXISTS public_shares_visitor ON public_shares(day,visitor);
CREATE INDEX IF NOT EXISTS public_shares_network ON public_shares(day,network);
CREATE INDEX IF NOT EXISTS public_shares_created ON public_shares(created);
