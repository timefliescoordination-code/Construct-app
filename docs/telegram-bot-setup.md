# Telegram expense bot setup

Site engineers can submit expenses from Telegram after a **one-time link** from the Engineer dashboard (no sign-in on each expense).

## 1. Create the bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the **bot token** and **username**.

## 2. Environment variables (Vercel / `.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from BotFather |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Yes | Bot username without `@` |
| `TELEGRAM_WEBHOOK_SECRET` | Recommended | Random string; Telegram sends it as `X-Telegram-Bot-Api-Secret-Token` |
| `NEXT_PUBLIC_APP_URL` | For webhook setup | Production URL, e.g. `https://your-app.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Already required; bot writes via service role |

## 3. Database migration

Run in Supabase SQL Editor (or apply migration `20260601120000_telegram_bot.sql`):

- `telegram_accounts` — linked Telegram ↔ profile
- `telegram_link_codes` — one-time 15-minute link codes
- `telegram_sessions` — conversation state

## 4. Register webhook (after deploy)

Sign in as **admin**, then:

```bash
curl -X POST "https://YOUR_APP.vercel.app/api/telegram/set-webhook" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json" \
  -d "{\"baseUrl\":\"https://YOUR_APP.vercel.app\"}"
```

Or use the browser while logged in as admin (POST from devtools).

## 5. Engineer flow

1. Sign in to the web app once → **Engineer** dashboard → **Connect Telegram**.
2. Generate a 6-character code (valid 15 minutes).
3. In Telegram, open your bot and send: `/link AB12CD`
4. Submit expenses:
   - `/expense` — step-by-step
   - Quick (single project): `2500 Materials Cement 50 bags`
   - Optional bill photo after submit

Expenses are created as **pending** for PM approval, same as the web app.

## Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome |
| `/link CODE` | Link account |
| `/expense` | New expense wizard |
| `/unlink` | Disconnect Telegram |
| `/help` | Help |
| `/skip` | Skip receipt upload |
