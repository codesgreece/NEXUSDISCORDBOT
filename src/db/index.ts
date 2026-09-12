import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { config } from '../config';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = config.databaseUrl;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS guild_configs (
      guild_id TEXT PRIMARY KEY,
      tickets_enabled INTEGER NOT NULL DEFAULT 1,
      ticket_category_id TEXT,
      log_channel_id TEXT,
      staff_role_ids TEXT NOT NULL DEFAULT '[]',
      ticket_types TEXT NOT NULL DEFAULT '[]',
      welcome_message_id TEXT,
      rules_message_id TEXT,
      services_message_id TEXT,
      pricing_message_id TEXT,
      ticket_panel_message_id TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      action TEXT NOT NULL,
      user_id TEXT,
      user_tag TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_guild_created
      ON activity_logs (guild_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expired INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions (expired);

    CREATE TABLE IF NOT EXISTS shop_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      price REAL,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_orders (
      id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal REAL,
      total REAL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      ticket_channel_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_emoji TEXT NOT NULL DEFAULT '',
      unit_price REAL,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total REAL,
      FOREIGN KEY (order_id) REFERENCES shop_orders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_shop_orders_guild
      ON shop_orders (guild_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_orders_user
      ON shop_orders (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_shop_order_items_order
      ON shop_order_items (order_id);

    CREATE TABLE IF NOT EXISTS shop_categories (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '',
      channel_name TEXT NOT NULL,
      shop_visible INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS content_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      page_key TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      discord_channel_id TEXT,
      discord_message_id TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE (guild_id, page_key)
    );

    CREATE TABLE IF NOT EXISTS shop_guild_sync (
      guild_id TEXT NOT NULL,
      category_key TEXT NOT NULL,
      channel_id TEXT,
      header_message_id TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (guild_id, category_key)
    );
  `);

  ensureShopProductColumns(database);
  seedShopCategories(database);
  seedShopProducts(database);
  backfillProductCategories(database);
}

function tableColumns(database: Database.Database, table: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function ensureShopProductColumns(database: Database.Database): void {
  const cols = tableColumns(database, 'shop_products');
  const alters: string[] = [];
  if (!cols.has('slug')) alters.push(`ALTER TABLE shop_products ADD COLUMN slug TEXT`);
  if (!cols.has('category')) alters.push(`ALTER TABLE shop_products ADD COLUMN category TEXT NOT NULL DEFAULT 'DISCORD_BOTS'`);
  if (!cols.has('image_url')) alters.push(`ALTER TABLE shop_products ADD COLUMN image_url TEXT`);
  if (!cols.has('discord_channel_id')) alters.push(`ALTER TABLE shop_products ADD COLUMN discord_channel_id TEXT`);
  if (!cols.has('discord_message_id')) alters.push(`ALTER TABLE shop_products ADD COLUMN discord_message_id TEXT`);
  for (const sql of alters) database.exec(sql);
  database.exec(`CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products (category, sort_order)`);
}

function seedShopCategories(database: Database.Database): void {
  const now = new Date().toISOString();
  const upsert = database.prepare(`
    INSERT INTO shop_categories
      (key, name, emoji, channel_name, shop_visible, sort_order, active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      name = excluded.name,
      emoji = excluded.emoji,
      channel_name = excluded.channel_name,
      shop_visible = excluded.shop_visible,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const categories: Array<{
    key: string;
    name: string;
    emoji: string;
    channel: string;
    shop: number;
    sort: number;
  }> = [
    { key: 'DISCORD_BOTS', name: 'Discord Bots', emoji: '🤖', channel: '🤖・bots', shop: 1, sort: 1 },
    { key: 'WEBSITES', name: 'Websites', emoji: '🌐', channel: '🖥️・websites', shop: 1, sort: 2 },
    { key: 'DESIGNS', name: 'Designs', emoji: '🎨', channel: '🎨・designs', shop: 1, sort: 3 },
    { key: 'SERVICES', name: 'Services', emoji: '⚙️', channel: '💼・services', shop: 1, sort: 4 },
    { key: 'DIGITAL_PRODUCTS', name: 'Digital Products', emoji: '📦', channel: '📁・portfolio', shop: 1, sort: 5 },
    { key: 'PROJECTS', name: 'Projects', emoji: '🚀', channel: '🚀・projects', shop: 0, sort: 10 },
    { key: 'REVIEWS', name: 'Reviews', emoji: '⭐', channel: '⭐・reviews', shop: 0, sort: 11 },
    { key: 'PORTFOLIO', name: 'Portfolio', emoji: '📁', channel: '📁・portfolio', shop: 0, sort: 12 },
    { key: 'BOT_SERVICES', name: 'Bot Services', emoji: '⚙️', channel: '⚙️・bot-services', shop: 0, sort: 13 },
    { key: 'FEATURES', name: 'Bot Features', emoji: '🧩', channel: '🧩・features', shop: 0, sort: 14 },
    { key: 'BOT_PROJECTS', name: 'Bot Projects', emoji: '🚀', channel: '🚀・bot-projects', shop: 0, sort: 15 },
    { key: 'BOT_REVIEWS', name: 'Bot Reviews', emoji: '⭐', channel: '⭐・bot-reviews', shop: 0, sort: 16 },
  ];

  const tx = database.transaction(() => {
    for (const c of categories) {
      upsert.run(c.key, c.name, c.emoji, c.channel, c.shop, c.sort, now, now);
    }
  });
  tx();
}

function backfillProductCategories(database: Database.Database): void {
  database
    .prepare(
      `UPDATE shop_products
       SET category = 'DISCORD_BOTS'
       WHERE category IS NULL OR category = ''`,
    )
    .run();
  database
    .prepare(
      `UPDATE shop_products
       SET slug = lower(replace(id, '_', '-'))
       WHERE slug IS NULL OR slug = ''`,
    )
    .run();
}

function seedShopProducts(database: Database.Database): void {
  const now = new Date().toISOString();
  const upsert = database.prepare(`
    INSERT INTO shop_products
      (id, name, slug, emoji, description, price, category, image_url, active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'DISCORD_BOTS', NULL, 1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      emoji = excluded.emoji,
      description = excluded.description,
      price = excluded.price,
      category = 'DISCORD_BOTS',
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);

  const products: Array<{
    id: string;
    name: string;
    emoji: string;
    description: string;
    price: number | null;
    sort: number;
  }> = [
    {
      id: 'ticket-bot',
      name: 'Ticket Bot',
      emoji: '🎫',
      description: 'Tickets, categories, transcripts, staff permissions',
      price: 3.99,
      sort: 1,
    },
    {
      id: 'advanced-moderation',
      name: 'Advanced Moderation',
      emoji: '🛡️',
      description: 'Anti-spam, anti-raid, warnings, bans, automod',
      price: 5.99,
      sort: 2,
    },
    {
      id: 'welcome-bot',
      name: 'Welcome Bot',
      emoji: '👋',
      description: 'Welcome messages, cards, roles, onboarding',
      price: 2.99,
      sort: 3,
    },
    {
      id: 'giveaway-bot',
      name: 'Giveaway Bot',
      emoji: '🎁',
      description: 'Giveaways, winners, requirements, reroll',
      price: 2.99,
      sort: 4,
    },
    {
      id: 'server-stats',
      name: 'Server Stats',
      emoji: '📊',
      description: 'Members, boosts, activity, channels, statistics',
      price: 3.49,
      sort: 5,
    },
    {
      id: 'leveling-bot',
      name: 'Leveling Bot',
      emoji: '⭐',
      description: 'XP, levels, ranks, rewards, leaderboard',
      price: 3.99,
      sort: 6,
    },
    {
      id: 'economy-bot',
      name: 'Economy Bot',
      emoji: '💰',
      description: 'Coins, daily rewards, shop, inventory, leaderboard',
      price: 5.99,
      sort: 7,
    },
    {
      id: 'music-bot',
      name: 'Music Bot',
      emoji: '🎵',
      description: 'Music player, queue, playlists',
      price: 4.99,
      sort: 8,
    },
    {
      id: 'verification-bot',
      name: 'Verification Bot',
      emoji: '🔗',
      description: 'Verification, buttons, role assignment',
      price: 2.99,
      sort: 9,
    },
    {
      id: 'ai-bot',
      name: 'AI Bot',
      emoji: '🤖',
      description: 'AI chat, server assistant, custom commands',
      price: 7.99,
      sort: 10,
    },
    {
      id: 'notification-bot',
      name: 'Notification Bot',
      emoji: '📢',
      description: 'YouTube/Twitch/TikTok/social notifications',
      price: 4.99,
      sort: 11,
    },
    {
      id: 'discord-shop-bot',
      name: 'Discord Shop Bot',
      emoji: '🏪',
      description: 'Products, orders, payments, automatic delivery',
      price: 7.99,
      sort: 12,
    },
    {
      id: 'gaming-bot',
      name: 'Gaming Bot',
      emoji: '🎮',
      description: 'Stats, profiles, game APIs, leaderboards',
      price: 6.99,
      sort: 13,
    },
    {
      id: 'tournament-bot',
      name: 'Tournament Bot',
      emoji: '🏆',
      description: 'Brackets, teams, matches, scores',
      price: 6.99,
      sort: 14,
    },
    {
      id: 'application-bot',
      name: 'Application Bot',
      emoji: '📋',
      description: 'Staff applications, forms, review system',
      price: null,
      sort: 15,
    },
  ];

  const tx = database.transaction(() => {
    for (const p of products) {
      upsert.run(
        p.id,
        p.name,
        p.id,
        p.emoji,
        p.description,
        p.price,
        p.sort,
        now,
        now,
      );
    }
  });
  tx();
  console.log(`[DB] Upserted ${products.length} Discord Bot shop products`);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
