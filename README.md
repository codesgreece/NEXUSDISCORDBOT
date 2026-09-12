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

### Recommended: single Node host (bot + API + UI)

Build and start on Railway, Render, Fly.io, or any Node 18+ host:

```bash
npm run build
npm start
```

Set production env vars (`DISCORD_*`, `SESSION_SECRET`, `DASHBOARD_ORIGIN`, `DISCORD_REDIRECT_URI`, etc.).  
`npm start` serves the built React dashboard from the same origin as the API.

Optional: register commands without starting the bot:

```bash
npm run register
```

### Vercel dashboard (static UI)

This repo is configured so **Vercel builds only the Vite dashboard** (`vercel.json`).

That fixes a bare project root 404. The Discord bot and Express API **cannot** run on Vercel (long-lived WebSocket + SQLite). Host them on a Node platform, then:

1. In Vercel → Project → Environment Variables, set  
   `VITE_API_BASE_URL=https://your-api-host.example.com`
2. On the API host, set  
   `DASHBOARD_ORIGIN=https://nexusdiscordbot.vercel.app`  
   and add the matching OAuth redirect URL in the Discord Developer Portal
3. Redeploy both sides

If the UI and API share one host, leave `VITE_API_BASE_URL` unset (relative `/api` calls).

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
