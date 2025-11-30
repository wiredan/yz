CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT,
  kyc_verified INTEGER DEFAULT 0,
  kyc_status TEXT DEFAULT 'pending',
  legal_name TEXT,
  can_change_name INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  balance_cents INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USDT'
);

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT,
  description TEXT,
  quantity INTEGER,
  price_cents INTEGER,
  currency TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  listing_id TEXT,
  buyer_id TEXT,
  seller_id TEXT,
  quantity INTEGER,
  total_cents INTEGER,
  currency TEXT,
  status TEXT DEFAULT 'created',   -- created, paid, shipped, delivered, dispute, released, refunded
  escrow_hold INTEGER DEFAULT 1,
  tracking_number TEXT,
  shipping_status TEXT DEFAULT 'pending',  -- pending, shipped, in_transit, delivered
  dispute_status TEXT DEFAULT 'none',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE escrow (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  buyer_id TEXT,
  seller_id TEXT,
  amount_cents INTEGER,
  status TEXT DEFAULT 'held', -- held, released, refunded, dispute
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  action TEXT,
  payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);