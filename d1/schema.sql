-- Cloudflare D1 Database Schema for DevSnapKit (devsnapkit.com)
-- Execute this in Cloudflare Dashboard -> Workers & Pages -> D1 -> Console
-- Or via CLI: npx wrangler d1 execute devsnapkit-db --file=./d1/schema.sql

-- 1. Events Table: Page Views, Feature Usage, User Interaction
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,          -- 'page_view', 'export_image', 'copy_image', 'pro_modal_open', 'checkout_click'
  session_id TEXT NOT NULL,          -- Anonymous browser session ID
  path TEXT DEFAULT '/',
  referrer TEXT,
  country TEXT,                      -- CF-IPCountry header (e.g. US, JP, CN, DE)
  device_type TEXT,                  -- 'desktop' | 'mobile' | 'tablet'
  browser TEXT,
  metadata TEXT,                     -- JSON payload for extra context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Orders Table: PayPal Transactions & Pro Licenses
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,     -- PayPal Order ID (e.g. 5XY892...)
  txn_id TEXT,                       -- PayPal Capture Transaction ID
  payer_email TEXT,                  -- Payer email
  amount TEXT NOT NULL DEFAULT '1.00',
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL,              -- 'COMPLETED', 'PENDING', 'REFUNDED'
  license_key TEXT,                  -- Cryptographic Pro License Key
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  raw_payload TEXT
);

-- Indexes for lightning fast analytics
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(payer_email);
