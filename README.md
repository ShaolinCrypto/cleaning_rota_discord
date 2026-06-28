# Cleaning Rota & Leeds Bins Discord Bot

A Discord bot built with **discord.js v14** and **TypeScript** that manages a weekly cleaning rota and shows upcoming Leeds bin collection dates.

## Features

### Cleaning rota

- Slash commands for task and rota management
- Weekly rotational assignment with persisted rotation index
- Assignment embeds posted to a configured channel
- Status workflow: Assigned → Accepted → Complete (or Not Complete by admins)
- CSV export via `/report`
- SQLite persistence with automatic schema creation on startup (via Node.js built-in `node:sqlite`)

### Leeds bins

- `/bins` — upcoming Leeds bin collection dates via [bins.felixyeung.com](https://bins.felixyeung.com)
- `/binping` — simple connectivity check
## Requirements

- Node.js 22+ (uses the built-in `node:sqlite` module)
- A Discord application with a bot token
- Administrator permissions in your guild for management commands

## Setup

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the values:

   | Variable | Description |
   | --- | --- |
   | `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
   | `CLIENT_ID` | Application client ID |
   | `GUILD_ID` | Guild ID where commands are registered |
   | `ASSIGNMENT_CHANNEL_ID` | Channel ID for weekly assignment posts |
   | `DATABASE_PATH` | Path to SQLite database file (default: `./data/rota.db`) |
   | `PREMISES_ID` | Leeds premises ID for `/bins` (preferred) |
   | `UPRN` | Fallback premises identifier if `PREMISES_ID` is not set |
3. **Register slash commands**

   ```bash
   npm run register-commands
   ```

4. **Run the bot**

   Development (watch mode):

   ```bash
   npm run dev
   ```

   Production:

   ```bash
   npm run build
   npm start
   ```

   Docker (e.g. Northflank):

   ```bash
   docker build -t cleaning-rota-bot .
   docker run --env-file .env cleaning-rota-bot
   ```

   The bot connects via the Discord gateway (not webhooks). No HTTP port is required.

## Slash Commands

### Cleaning rota (admin unless noted)

| Command | Description | Permissions |
| --- | --- | --- |
| `/task create title description` | Create a cleaning task | Admin |
| `/task edit task_id title description` | Edit a task | Admin |
| `/task remove task_id` | Deactivate a task | Admin |
| `/task list` | List all tasks | Admin |
| `/rota add user` | Add a user to the rota | Admin |
| `/rota remove user` | Remove a user from the rota | Admin |
| `/rota list` | List rota users | Admin |
| `/report` | Download CSV assignment history | Admin |

### Leeds bins

| Command | Description | Permissions |
| --- | --- | --- |
| `/bins` | Show upcoming Leeds bin collection dates | Everyone |
| `/binping` | Test bot responsiveness | Everyone |

`/bins` uses `PREMISES_ID` first, then falls back to `UPRN`. Data is fetched from:

`https://bins.felixyeung.com/api/jobs?premises=<PREMISES_ID_OR_UPRN>`

## Weekly Schedule

Assignments are posted automatically by a cron scheduler.

To change when assignments run, edit `WEEKLY_ASSIGNMENT_CRON` in `src/config.ts`:

```ts
// Default: every Monday at 09:00 (Europe/London)
export const WEEKLY_ASSIGNMENT_CRON = '0 9 * * 1';
export const TIMEZONE = 'Europe/London';
```

Cron format: `minute hour day-of-month month day-of-week`

## Assignment Workflow

1. The scheduler creates one assignment per rota user (up to the number of active tasks).
2. Each assignment is posted as an embed in `ASSIGNMENT_CHANNEL_ID`.
3. The assigned user clicks **Accept**, then **Confirm Complete**.
4. Admins can click **Not Complete** to reject an incomplete assignment.
5. Embed status and buttons update after each action.

## Rotation Logic

- Rota users and active tasks are ordered by ID.
- Each week, users receive tasks starting from a persisted rotation index.
- The rotation index advances by the number of assignments created, so restarts do not reset fairness.
- If there are more users than tasks (or vice versa), assignments are created up to the smaller count and a warning is logged.

## Project Structure

```
src/
  index.ts                 # Bot entry point
  register-commands.ts     # Slash command registration script
  config.ts                # Environment and scheduler config
  commands/                # Slash command handlers (rota + bins)
  events/                  # Discord event handlers
  services/                # Business logic (rota, bins, reports)
  db/                      # SQLite initialization
  types/                   # Shared TypeScript types
  utils/                   # Permissions, embeds, bin formatting
```

## Bot Permissions

Ensure the bot has these permissions in your guild and assignment channel:

- View Channels
- Send Messages
- Embed Links
- Use Application Commands

`Guild Members` intent is enabled for member lookups when rendering embeds.

## CSV Report Format

The `/report` command returns a file with columns:

```
date,task assigned,user,completion status
```

User values are Discord user IDs.

## Error Handling

The bot handles common failure cases including:

- No rota users or active tasks
- Unequal user/task counts
- Duplicate rota users
- Missing or inaccessible assignment channel
- Permission failures on commands and buttons
- Database errors

## License

MIT
