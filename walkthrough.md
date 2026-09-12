# Manual category: 🌐 DISCORD SERVERS

## What
Control Center → Channel Manager → **🌐 Create Discord Servers Category**

## Behavior
1. If `🌐 DISCORD SERVERS` exists → ephemeral notice, no duplicate, permissions unchanged
2. If missing → create category only (no channels)
3. Position immediately below `🤖 DISCORD BOTS`
4. Apply category permission overwrites for @everyone / staff-admin / bot

## Not done
- No channels inside the new category
- Not part of `/setup` or automatic sync
- Does not modify `🤖 DISCORD BOTS` or other categories

## Build
`npm run build` — success
