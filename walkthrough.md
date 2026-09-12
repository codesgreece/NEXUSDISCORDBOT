# Central Content + Discord Shop System

## What shipped
One shared SQLite catalog for Dashboard + Discord. Products sync into **existing** channels (e.g. all Discord bots in `🤖・bots`) — **no per-product channels**, edit-or-create by stored message ID (no duplicates).

## Admin (Discord only after setup)
- `/content` → Content Manager (Products / Sync / …)
- `/shop-admin` → Product management
- `/sync-shop` → Full shop sync into mapped channels

## Users
- `/shop` → category → products
- **Αγορά** on product embeds → confirm → order + purchase ticket

## Mapping
Configurable in `src/config/contentMapping.ts` + `shop_categories` table (e.g. `DISCORD_BOTS` → `🤖・bots`).

## Proof notes
- Bot registers: `setup`, `content`, `shop`, `shop-admin`, `sync-shop`
- Seeded **15** Discord Bot products into DB (Application Bot = Τιμή σύντομα)
- Dashboard **Προϊόντα** shares the same DB + **Sync Discord** button
