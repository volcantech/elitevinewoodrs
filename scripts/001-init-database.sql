-- Initialize all database tables for Elite Vinewood RS

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price INTEGER NOT NULL,
  trunk_weight INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  seats INTEGER NOT NULL,
  particularity VARCHAR(100),
  page_catalog INTEGER,
  manufacturer VARCHAR(255),
  realname VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Particularities table
CREATE TABLE IF NOT EXISTS particularities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  access_key VARCHAR(255) NOT NULL,
  unique_id VARCHAR UNIQUE,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  unique_id VARCHAR(36) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  total_price INTEGER NOT NULL,
  validated_by VARCHAR(100),
  validated_at TIMESTAMP,
  client_ip VARCHAR(45),
  cancellation_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL,
  vehicle_name VARCHAR(255) NOT NULL,
  vehicle_category VARCHAR(100) NOT NULL,
  vehicle_price INTEGER NOT NULL,
  vehicle_image_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  content TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Banned unique IDs table
CREATE TABLE IF NOT EXISTS banned_unique_ids (
  id SERIAL PRIMARY KEY,
  unique_id VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT,
  banned_by VARCHAR(255),
  banned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  admin_username VARCHAR(255),
  admin_unique_id VARCHAR(255),
  admin_ip VARCHAR(45),
  action VARCHAR(50),
  resource_type VARCHAR(50),
  resource_name VARCHAR(500),
  description TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER,
  admin_username VARCHAR(255),
  action VARCHAR(50),
  resource_type VARCHAR(50),
  resource_id INTEGER,
  description TEXT,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_unique_id ON orders (unique_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_banned_unique_ids ON banned_unique_ids (unique_id);

-- Insert default categories
INSERT INTO categories (name) VALUES 
  ('Compacts'), ('Coupes'), ('Motos'), ('Muscle'), ('Off Road'), 
  ('SUVs'), ('Sedans'), ('Sports'), ('Sports classics'), ('Super'), ('Vans')
ON CONFLICT (name) DO NOTHING;

-- Insert default particularities
INSERT INTO particularities (name) VALUES 
  ('Aucune'), ('Les plus rapides'), ('Drift'), 
  ('Suspension hydraulique'), ('Karting'), ('Électrique')
ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: admin123)
INSERT INTO admin_users (username, access_key, permissions)
VALUES (
  'AK', 
  '$2b$10$GRf/hKpg1Lxo330H6wlDTONsG35ZavgM1HX3nI9T22YOtPIAgJ6ea',
  '{"vehicles":true,"orders":true,"users":true,"settings":true,"moderation":true}'::jsonb
)
ON CONFLICT (username) DO NOTHING;
