-- Apply to the existing DB database after d1/schema.sql. No new database required.
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  env TEXT NOT NULL CHECK (env IN ('production', 'preview', 'dev')),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  message TEXT CHECK (message IS NULL OR length(message) <= 500)
);
CREATE INDEX IF NOT EXISTS idx_feedback_env_created ON feedback(env, created_at);
-- Optional campaign context saved before checkout; no emails or IPs here.
CREATE TABLE IF NOT EXISTS checkout_attribution (
  order_id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attribution TEXT NOT NULL
);
