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

**Important:** Redeploy after the Telegram commit (`7ac6c37` or later). A 404 on `/api/telegram/set-webhook` usually means production does not include that route yet.

### Option A — Directly via Telegram (no app API; recommended)

Replace `YOUR_TOKEN`, `YOUR_APP`, and `YOUR_SECRET`:

```text
https://api.telegram.org/botYOUR_TOKEN/setWebhook?url=https://YOUR_APP.vercel.app/api/telegram/webhook&secret_token=YOUR_SECRET
```

Open that URL in the browser. You should see JSON: `{"ok":true,...}`.

### Option B — App API (admin must be signed in)

Sign in as **admin** on the same site, then in the browser console:

```javascript
fetch('/api/telegram/set-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ baseUrl: 'https://YOUR_APP.vercel.app' }),
}).then((r) => r.json()).then(console.log)
```

If you get HTML or 404, use Option A and confirm the latest code is deployed.

## 5. Linking (engineer, PM, or admin)

1. Sign in to the web app once → **Integrations** → **Telegram**.
2. Generate a 6-character code (valid 15 minutes).
3. In Telegram, open your bot and send: `/link AB12CD`
4. Submit expenses from the bot menu (see role below).

### Site engineer / PM

- `/expense` — step-by-step **project** expense
- Quick (single project): `2500 Materials Cement 50 bags`
- Optional bill photo after submit
- Engineer entries are **pending** for PM approval

### Admin

After linking, the Telegram menu offers:

- **Project expense** — same flow as engineers (saved as **approved**)
- **Company expense** — overhead (saved to `company_expenses`)
- **Personal expense** — private (saved to `personal_expenses`)

Quick formats:

- Project: `2500 Materials Cement 50 bags`
- Company: `company 5000 Office Rent June rent`
- Personal: `personal 200 Food Lunch meeting`

Company and personal entries do not need PM approval. Run finance migrations if those tables are missing.

## Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome |
| `/link CODE` | Link account |
| `/expense` | New expense wizard |
| `/unlink` | Disconnect Telegram |
| `/help` | Help |
| `/skip` | Skip receipt upload |
