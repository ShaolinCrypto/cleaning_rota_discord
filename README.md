# Cleaning Rota & Leeds Bins Discord Bot

A Discord bot built with **discord.js v14** and **TypeScript** that manages a weekly cleaning rota and shows upcoming Leeds bin collection dates.

## Features

### Cleaning rota

- Slash commands for task and rota management
- Weekly rotational assignment with persisted rotation index
- Assignment embeds posted to a configured channel
- Status workflow: Assigned → Accepted → Complete (or Not Complete by admins)
- CSV export via `/report`
- MySQL persistence with automatic schema creation on startup

### Leeds bins

- `/bins` — upcoming Leeds bin collection dates via [bins.felixyeung.com](https://bins.felixyeung.com)
- `/ping` — simple connectivity check (rota or bin channel)
- `/health` — database connectivity and table status (rota or bin channel)

## Requirements

- Node.js 22+
- A Discord application with a bot token
- A MySQL database (Northflank MySQL addon recommended for production)
- Administrator permissions in your guild for management commands

## Setup

1. **Clone and install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in the values (see table below).

3. **Register slash commands (optional locally)**

   Commands are registered automatically each time the bot starts (including in Docker/Northflank).

   To register without starting the bot:

   ```bash
   npm run register-commands
   ```

   Commands are registered **globally** (no `GUILD_ID` required). Global commands can take up to an hour to propagate after the first registration.

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

   The bot connects via the Discord gateway (not webhooks). No HTTP port is required. On startup it registers slash commands, connects to MySQL, creates tables if needed, then connects to Discord.

### Northflank MySQL setup

A mounted filesystem volume is **not** a MySQL database. Use a Northflank **MySQL addon**:

1. Open your Northflank **project**
2. Click **Create New** → **Addon**
3. Choose **MySQL**
4. Note the addon connection details (host, port, database, username, password)
5. Link the addon secrets to your bot **service** as environment variables (see below)
6. Deploy the bot service — tables are created automatically on first startup

Verify with `/health` in your rota or bin channel after deploy.

### Environment variables

| Variable | Description |
| --- | --- |
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | Application client ID |
| `ROTA_CHANNEL_ID` | Channel for rota slash commands and weekly assignment posts |
| `BIN_CHANNEL_ID` | Channel where `/bins` can be used |
| `DB_HOST` | MySQL host (Northflank addon internal hostname, e.g. `mysql-addon`) |
| `DB_PORT` | MySQL port (default `3306`) |
| `DB_NAME` | MySQL database name |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `PREMISES_ID` | Leeds premises ID for `/bins` (via bins.felixyeung.com) |

## Slash Commands

### Cleaning rota (admin; use in `ROTA_CHANNEL_ID` only)

| Command | Description | Permissions |
| --- | --- | --- |
| `/task create` | Create a cleaning task (modal form) | Admin |
| `/task edit task_id` | Edit a task (pre-filled modal form) | Admin |
| `/task manage` | Manage tasks with buttons and select menu | Admin |
| `/task remove task_id` | Deactivate a task | Admin |
| `/task list` | List all tasks | Admin |
| `/rota add user` | Add a user to the rota | Admin |
| `/rota remove user` | Remove a user from the rota | Admin |
| `/rota list` | List rota users | Admin |
| `/rota build` | Generate and post this week's assignments now | Admin |
| `/report` | Download CSV assignment history | Admin |

### Leeds bins & diagnostics

| Command | Description | Channels |
| --- | --- | --- |
| `/bins` | Show upcoming Leeds bin collection dates | `BIN_CHANNEL_ID` only |
| `/ping` | Test bot responsiveness | Rota or bin channel |
| `/health` | Check MySQL connectivity and table row counts | Rota or bin channel |

`/bins` requires `PREMISES_ID` and fetches data from:

`https://bins.felixyeung.com/api/jobs?premises=<PREMISES_ID>`

Rota commands (`/task`, `/rota`, `/report`) only work in `ROTA_CHANNEL_ID`.

## Weekly Schedule

Assignments are posted automatically by a cron scheduler. Admins can also run `/rota build` in `ROTA_CHANNEL_ID` to generate and post the current week's rota immediately (for example after changing rota users or tasks). If assignments already exist for this week, `/rota build` replaces them.

To change when assignments run, edit `WEEKLY_ASSIGNMENT_CRON` in `src/config.ts`:

```ts
// Default: every Monday at 09:00 (Europe/London)
export const WEEKLY_ASSIGNMENT_CRON = '0 9 * * 1';
export const TIMEZONE = 'Europe/London';
```

Cron format: `minute hour day-of-month month day-of-week`

## Assignment Workflow

1. The scheduler creates one assignment per rota user (up to the number of active tasks).
2. Each assignment is posted as an embed in `ROTA_CHANNEL_ID`.
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
  services/                # Business logic (rota, bins, reports, health)
  db/                      # MySQL connection and schema
  types/                   # Shared TypeScript types
  utils/                   # Permissions, embeds, bin formatting
```

## Bot Permissions

Ensure the bot has these permissions in your guild, rota channel, and bin channel:

- View Channels
- Send Messages
- Embed Links
- Use Application Commands

Admin and assignment button checks use the member data included with each interaction (no privileged intents required).

## CSV Report Format

The `/report` command returns a file with columns:

```
date,task assigned,user id,username,completion status
```

User ID values are Discord snowflakes. Usernames are resolved from Discord when the report is generated.

## Error Handling

The bot handles common failure cases including:

- No rota users or active tasks
- Unequal user/task counts
- Duplicate rota users
- Wrong channel for rota or bin commands
- Missing or inaccessible rota channel
- MySQL connection failures
- Permission failures on commands and buttons
- Database errors

## License

MIT
