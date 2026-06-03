# Site engineer — connect Telegram (simple guide)

Share this with site engineers. No technical knowledge needed.

## What they need

- A phone with **Telegram** installed
- Their **normal login** for the VRA Homes website (engineer account)
- **2 minutes** for one-time setup

## Where to go on the website

1. Open the construction app in the phone browser (or computer once).
2. **Log in** with the email/password your office gave you.
3. In the **left sidebar**, under **Integrations**, tap **Telegram**.
4. Follow the steps on that page to link your phone (one time).

**Admins** use the same page. After linking, the Telegram bot shows **Project**, **Company**, and **Personal** expense buttons.

If a site engineer sees no projects, ask admin to assign them to a project in **Edit project → Staff Assignment**.

## One-time connection (on phone)

1. Tap **Get link code** on the website.
2. Tap **Open Telegram bot** (opens the company bot).
3. Tap **Copy message for Telegram** on the website.
4. In Telegram, **paste** in the chat with the bot and **Send**.
5. Bot replies: **“Linked successfully…”** — done forever on this phone.

**Alternative:** After step 1, type only the 6 letters/numbers shown (e.g. `A3F92B`) in the bot chat.

## Daily use (no website login)

1. Open Telegram → open the VRA bot.
2. Send an expense, for example:
   - `/expense` and follow the questions, **or**
   - One line: `2500 Materials Cement 50 bags`
3. Optional: send a photo of the bill when asked.
4. PM approves in the office app — same as before.

## Help text for engineers

| Problem | What to do |
|---------|------------|
| No “Connect Telegram” card | Log in as engineer; ask admin to enable bot on server |
| Code expired | Tap **Get a new code** (valid 15 minutes) |
| Bot does not reply | Tell admin — webhook may need setup |
| “No projects assigned” | Admin must assign engineer to project in app |

## For admin / PM

- Create engineer user in **User Management** (role: engineer).
- Assign engineer to projects in **Edit project**.
- Bot username is set in Vercel as `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
- Engineers only use **Engineer dashboard** for linking — not Admin dashboard.
