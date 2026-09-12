# Development mode: zero automatic bot actions

## Behavior
The bot stays connected and **only** executes:

- Slash commands
- Buttons / selects / modals
- Code we explicitly change via Cursor

`AUTOMATIC_BOT_ACTIONS_ENABLED = false` in `src/config/botRuntime.ts`.

## Disabled (code kept)
- Ready Discord mutations / presence / activity logging
- AutoMod on `messageCreate`
- Welcome / leave on member join/remove
- No cron / setInterval workers / background sync loops found

## Still manual
`/control` `/channels` `/roles` `/member` `/moderation` `/welcome` `/stats` `/backup` `/security` `/sync` `/shop` `/shop-admin` `/content` `/sync-shop` + all Control/Shop buttons

## Build
`npm run build` — success
