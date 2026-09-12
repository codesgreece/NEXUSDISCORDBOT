# NEXUS | DEVELOPMENT — Discord Bot

Professional management bot for the **NEXUS | DEVELOPMENT** Discord server.

Built with **Node.js**, **TypeScript**, **discord.js v14**, **Express**, and a **React** dashboard.

---

## Features

- `/setup` — one-command server bootstrap (roles, categories, channels, permissions, embeds)
- Idempotent setup (safe to run more than once)
- Ticket system with category buttons
- Staff-only channels
- Logging to `📝・logs`
- **Web Dashboard (Phase 1)** — Discord OAuth login, server selection, overview stats, activity feed

---

## Prerequisites

- Node.js **18+**
- A Discord application & bot from the [Discord Developer Portal](https://discord.com/developers/applications)
- Administrator permission on your Discord server
- Build tools for `better-sqlite3` (Windows: usual VS Build Tools if compile is needed)

---

## 1. Install dependencies

```bash
npm install
npm install --prefix dashboard
```

---

## 2. Create your `.env` file

Copy the example file:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

The project also includes an empty `.env` you can fill in directly.

---

## 3. Add `DISCORD_TOKEN`

1. Open [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your application
3. Go to **Bot**
4. Click **Reset Token** / **Copy** to get the bot token
5. Paste it into `.env`:

```env
DISCORD_TOKEN=paste_your_token_here
```

Never commit this value. `.env` is already listed in `.gitignore`.

---

## 4. Add `CLIENT_ID`

1. In the Developer Portal, open your application
2. Go to **General Information**
3. Copy the **Application ID** (this is the Client ID)
4. Paste it into `.env`:

```env
CLIENT_ID=your_application_id
```

---

## 5. Find and add `GUILD_ID`

1. Open Discord → **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click your server icon (**NEXUS | DEVELOPMENT**)
3. Click **Copy Server ID**
4. Paste it into `.env`:

```env
GUILD_ID=your_server_id
```

---

## 6. Invite the bot

Generate an invite URL with at least these scopes/permissions:

- Scopes: `bot`, `applications.commands`
- Permissions: **Administrator** (recommended for `/setup`), or Manage Channels + Manage Roles + Send Messages + Embed Links + Manage Messages

In the Developer Portal → **Bot**, also enable:

- **Server Members Intent**

Example URL pattern:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your Application ID.

---

## 7. Run in development

```bash
npm run dev
```

This starts:

- Discord bot + Express API on `http://localhost:3001`
- React dashboard (Vite) on `http://localhost:5173`

Slash commands are registered automatically on startup for your guild.

### Dashboard OAuth setup

1. Developer Portal → **OAuth2** → **Client Secret** → copy into `DISCORD_CLIENT_SECRET`
2. Add redirect URL: `http://localhost:3001/api/auth/callback`
3. Set `DISCORD_CLIENT_ID` (usually same as `CLIENT_ID`)
4. Set a random `SESSION_SECRET`
5. Open `http://localhost:5173` → **Login with Discord**

Phase 1 includes login, server picker, sidebar layout, and dashboard home. Editors & management panels come next.

---

## 8. Use `/setup`

1. Open your Discord server
2. Make sure you have the **Administrator** permission
3. Run:

```
/setup
```

The bot will:

1. Verify your permissions and the bot’s permissions
2. Create all roles
3. Create all categories and channels
4. Apply staff-only permissions
5. Post welcome, rules, services, pricing, and ticket panel embeds
6. Report progress and completion

You can run `/setup` again safely — existing roles/channels/embeds are skipped or synced.

---

## Production

### Production (bot + API + UI together) — Render

Vercel cannot run the Discord bot. Deploy **everything** with Docker on Render:

1. Push this repo → [Render](https://render.com) → **New** → **Blueprint** → select this repo (`render.yaml`)
2. Fill env vars: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
3. After deploy, copy the service URL (e.g. `https://nexus-discord-bot.onrender.com`)
4. Set:
   - `DASHBOARD_ORIGIN=https://YOUR-SERVICE.onrender.com`
   - `DISCORD_REDIRECT_URI=https://YOUR-SERVICE.onrender.com/api/auth/callback`
5. Discord Developer Portal → OAuth2 → add that redirect URL
6. Open the Render URL → **Login with Discord**

Local production build:

```bash
npm run build
npm start
```

Optional: register slash commands only:

```bash
npm run register
```

### Vercel (frontend only)

`vercel.json` still builds the static dashboard. For login on Vercel you must also run the API on Render and set `VITE_API_BASE_URL` + `CROSS_ORIGIN_DASHBOARD=true`. Prefer the Render URL above — it serves UI + API + bot on one origin.
---

## Ticket system

In `🎫・create-ticket`, members can open tickets via buttons:

| Button | Channel name pattern |
|--------|----------------------|
| 🌐 Website | `ticket-website-username` |
| 🤖 Discord Bot | `ticket-bot-username` |
| 💰 Pricing | `ticket-pricing-username` |
| 🛠️ Support | `ticket-support-username` |
| 🤝 Partnership | `ticket-partnership-username` |

- Only the ticket author and staff roles can see the channel
- One open ticket per user
- **Close Ticket** removes the user’s access (keeps the channel)
- **Delete Ticket** asks for confirmation (staff only)

---

## Staff access

Staff channels under `🔒 STAFF` are visible only to:

- 👑 Owner
- 🛡️ Administrator
- 🔨 Developer
- 🎨 Designer
- 💼 Manager
- 🧪 Tester

---

## Security

- Token is read only from `process.env.DISCORD_TOKEN`
- Missing token stops the process with a clear error
- Token is never printed to logs
- `.env` is gitignored

---

## Project structure

```
src/                    # Discord bot + Express API
dashboard/              # React + Vite frontend (deployed to Vercel)
vercel.json             # Vercel build config for the dashboard
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Bot + API + Vite dashboard |
| `npm run dev:bot` | Bot/API only |
| `npm run dev:web` | Frontend only |
| `npm run build` | Compile backend + build frontend |
| `npm start` | Run production backend (serves built UI) |
| `npm run register` | Deploy slash commands only |
