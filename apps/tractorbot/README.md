# tractorbot

![tractorbot](./docs/banner.png)

Telegram bot that listens to a group chat and turns configured keywords into freshly Gemini-generated **collectible monkey cards**. **claude** and **claudio** generate a monkey driving a tractor; **ludita**, **luditas**, **luddite**, and **luddites** generate a monkey opposing technology or modern advances. Every generation is a dark-fantasy trading card with a rolled rarity, a unique name, and is filed in the triggering user's collection.

## What it does

- **Listens to every text message** in one configured group.
- **Trigger words** are grouped by image theme, case-insensitive and whole-word only. **Tractor triggers** default to `claude,claudio`; **luddite triggers** default to `ludita,luditas,luddite,luddites`.
- **Each generation is a Magic-style card.** Three independent rolls, all weighted toward the common end:
  - **Border colour** (5 tiers): common→gray, magic→blue, rare→yellow, legendary→orange, unique→purple. The border tier also escalates the **monkey's stature** (ordinary monkey → mythic commander) and the **scene grandeur**.
  - **Surface finish** (3 tiers): normal (matte), rugged (weathered), shiny (foil) — independent of the border, so a `gray shiny` is possible.
  - **Card type** (4 kinds, rarer than monkeys): `monkey` (~70%, a creature with power/toughness), `weapon` (~14%, an equipment artifact), `artifact` (~10%), `land` (~6%). Non-monkey types depict the object in the monkey world and use the right stat block (weapons get an equip bonus; artifacts/lands have no P/T).
- **Full card data first.** A Gemini text model invents the whole card — name, type line, cost, a rules ability, an italic flavour line, and (for creatures) power/toughness — in Spanish dark-fantasy / dark-humour, deduped against your existing cards. The image prompt then renders *that* card on a fixed Magic-style template with one consistent house art style, so the art matches the card and rarity.
- **Whatever else you wrote alongside the trigger word feeds the card** — `claude un buen john deere` folds the John Deere in; `ludita contra los patinetes electricos` steers the luddite card. Empty messages generate fully at random.
- **Reply** with the card photo, captioned in a flashy multi-line style (`<type>✦ <name> ✦<type>` then `<border emoji> <rarity>  <surface emoji> <finish>`), and **save it** to the triggering user's collection (Telegram `file_id` + full metadata in a Google Sheet).
- **`/collection @user`** re-sends that user's cards as media-group albums, rarest first.
- **Cooldown** (default 60 s) keeps spam contained when the chat is hot.

## Commands

- `/collection <@username>` — show a user's card collection. A username is required (Telegram can't resolve a handle to an id, so cards are matched by the stored username).

## Telegram privacy setting — read this

For tractorbot to read ordinary group chatter (not just commands), BotFather privacy must be **OFF**:

1. Message [@BotFather](https://t.me/BotFather) → `/setprivacy` → pick this bot → **Disable**.
2. If the bot was already in the group, remove and re-add it so the change takes effect.

(This is the opposite of ciclobot, which keeps privacy ON.)

## Setup

You need:

- A Telegram bot token (BotFather → `/newbot`).
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- The numeric `CHAT_ID` of the target group (same trick as ciclobot's README — open `https://api.telegram.org/bot<TOKEN>/getUpdates`).

### Env vars

| Name | Required | Default | Notes |
| --- | --- | --- | --- |
| `BOT_TOKEN` | yes | — | BotFather token. |
| `GEMINI_API_KEY` | yes | — | AI Studio key (used for both image and naming). |
| `CHAT_ID` | yes | — | Negative numeric ID of the target group. |
| `SHEET_ID` | yes | — | Google Sheet that holds the `cards` tab. Its own spreadsheet. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | yes | — | Service-account JSON with Editor access on that sheet. |
| `TRACTOR_TRIGGER_WORDS` | no | `claude,claudio` | Comma-separated tractor-image triggers. Case-insensitive, whole-word. |
| `LUDDITE_TRIGGER_WORDS` | no | `ludita,luditas,luddite,luddites` | Comma-separated luddite-image triggers. Case-insensitive, whole-word. |
| `COOLDOWN_SECONDS` | no | `60` | Minimum seconds between successful generations. |
| `GEMINI_MODEL` | no | `gemini-2.5-flash-image` | Image model. Override only if Google renames it. |
| `GEMINI_TEXT_MODEL` | no | `gemini-2.5-flash` | Text model used to name cards. |
| `FORCE_BORDER` | no | — | Dev only: pin the border tier (`common`/`magic`/`rare`/`legendary`/`unique`) instead of rolling. |
| `FORCE_SURFACE` | no | — | Dev only: pin the surface finish (`normal`/`rugged`/`shiny`). |

### Sheet

One tab, `cards`, columns: `card_id`, `user_id`, `username`, `first_name`, `name`, `card_type`, `type_line`, `cost`, `rules_text`, `flavor_text`, `power`, `toughness`, `border`, `surface`, `theme`, `file_id`, `generated_at`. Append-only — one row per generated card. Share the spreadsheet with the service-account email (Editor).

## Deploy

Add tractorbot as a **second service inside the same Railway project as ciclobot** (so logs and billing stay together). One-time setup in the new service's **Settings**:

1. **Source** → the same GitHub repo.
2. **Config-as-Code** → set the config file path to `/apps/tractorbot/railway.toml`. That file pins the Dockerfile path, the restart policy, and zero-overlap deploys (Telegram allows only one consumer of `getUpdates` per token).

Railway does **not** support a single root `railway.toml` covering multiple services — each service needs its own Config-as-Code path pointing at its own file under `apps/<bot>/railway.toml`.

## Local dev

```
pnpm install
pnpm -F tractorbot dev
```

Tractorbot will fail fast if any required env var is missing.

## Image QA

The card-structure prompt is tuned to render a real framed card ~99% of the time. A dev-only harness scores that empirically:

```
GEMINI_API_KEY=… pnpm -F tractorbot qa:cards [reps]
```

It generates a reproducible matrix across every border/surface/theme, asks a Gemini vision grader whether each image is a single framed card with the expected border colour and surface finish, and reports the pass rate (target ≥95% per dimension). It never touches Telegram or the sheet.

## Architecture notes

- Same strict-TS + zod conventions as ciclobot. No `as`, no `!`, no `any`.
- **Persistence**: a single Google Sheet (`cards` tab) tracks every generated card by Telegram `file_id`. The bot fails fast if `SHEET_ID` / `GOOGLE_SERVICE_ACCOUNT_JSON` are missing.
- Pipeline per trigger: roll rarity → dedup names → name+concept (Gemini text, local fallback) → render card prompt → generate image → reply → append card.
- The Gemini clients are thin REST wrappers; every response is zod-parsed before use.
