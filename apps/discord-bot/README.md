# Discord bot

A self-hosted Discord bot for token communities on Robinhood Chain launchpads (Pons). It reads the [launch feed](https://github.com/robelmit/hoodtoolkit-feed/tree/main/packages/feed) and posts the same cards as the [Telegram bot](../telegram-bot), as embeds:

- **Token card.** `/ca <address>`. The figures sit in grey boxes and the side bar is green when the price rose and red when it fell. **Copy CA** answers with the bare address, only to you; **Refresh** redraws the card in place.
- **Trending.** `/trending` lists the most traded launchpad tokens of the last five minutes.
- **Buy bot.** A server manager runs `/track <address>`; every buy of that token at or above a size is posted in a channel. Busy spells are merged into one post, and the channel is warned when the token's creator sells.

The bot never trades, holds no keys, and asks nobody for a wallet.

## Run it

1. In the [Discord developer portal](https://discord.com/developers/applications), create an application, add a bot, and copy the bot token and the application id.
2. Invite it with the `bot` and `applications.commands` scopes and the **Send Messages** and **Embed Links** permissions.
3. Start the launch feed and pipe it in:

```
QUOTE_PRICES_JSON='{"ETH":3000}' npx @hood-toolkit/feed \
  | DISCORD_BOT_TOKEN=your-token DISCORD_APPLICATION_ID=123456789012345678 pnpm --filter @hood-toolkit/discord-bot start
```

With Redis between them, the feed and the bots run as separate processes: give the feed `SINK=redis` and both sides the same `REDIS_URL`. The `docker-compose.yml` at the repository root runs it that way.

Slash commands are registered when the bot starts. Discord can take a while to show new global commands.

## Commands

| Command | Who | What |
|---|---|---|
| `/ca address` | Anyone | A token card |
| `/trending` | Anyone | The five most traded tokens of the last five minutes, by dollar volume |
| `/track address [channel]` | Manage Server | Turn the buy bot on for a token; buys go to the channel given, or the one the command was run in |
| `/minbuy usd` | Manage Server | The least buy posted (default $25, from 1 to 1,000,000) |
| `/untrack` | Manage Server | Turn the buy bot off |
| `/buybot` | Anyone | The buy bot's settings, shown only to you |
| `/calls` | Anyone | The best calls in this server in the last 7 days |
| `/quote address amount` | Anyone | What a buy of a Pons token gets, read from its curve |
| `/launches mode [min_mc] [launchpad] [channel]` | Manage Server | Post tokens younger than an hour the first time they reach a market cap (default $20K), in a channel |
| `/graduations mode [channel]` | Manage Server | Post tokens that finish their bonding curve, in a channel |
| `/help` | Anyone | What the bot does |

The manager commands are declared with the Manage Server permission, and the permission is checked again when the command runs.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `DISCORD_BOT_TOKEN` | — | Required |
| `DISCORD_APPLICATION_ID` | — | Required |
| `DISCORD_MESSAGE_CONTENT` | `0` | `1` answers a pasted address without a command. It needs the Message Content intent, switched on for the application in the developer portal |
| `FEED` | `redis` when `REDIS_URL` is set, otherwise `stdin` | Where the feed is read from |
| `REDIS_URL` | — | Required with `FEED=redis` |
| `FEED_STREAM_KEY` | `stream:market:robinhood` | The feed's stream |
| `STORE_PATH` | `./data/discord.json` | The file the servers' settings are kept in |
| `SNAPSHOT_PATH` | `./data/feed-snapshot.json` | Where the tokens the bot knows are kept across restarts (saved every five minutes and at shutdown, read at start when less than a day old); `off` for none |
| `HOOD_RPC_URL` | Robinhood Chain's public endpoint | The endpoint `/quote` reads a Pons curve through (the toolkit's own read-only tools, `@hood-toolkit/mcp` 0.2 or later); `off` turns `/quote` off |
| `BOT_BUTTONS` | `Explorer` → Blockscout | Link buttons under cards and buy posts: `Label|https://…{address}`, comma separated, at most five |
| `LINK_ROW` | `EXP` → Blockscout, `LIVE` → the hoodtoolkit Live page, `X` → an X search | The short links inside a card: `CODE|https://…{address}`, comma separated, at most ten, codes up to 12 characters; `off` for none |
| `HOLDER_MAP_URL` | — | A 🫧 holder map link in the card, `https://…{address}`; none by default, as Robinhood Chain has no holder map yet |
| `BOT_POWERED_BY` | — | A credit line for whoever runs the bot, at the end of `/help` and in a card's footer (at most 120 characters), such as `Powered by Example · example.com` |
| `LINK_TOKEN`, `LINK_WALLET`, `LINK_TX` | Blockscout (robinhoodchain.blockscout.com) | Link templates with `{address}` or `{tx}` |

A missing or malformed setting stops the bot at start and says which one.

## How it behaves

- **Nobody is pinged.** Every message is sent with mentions switched off, and outside text is escaped, so a token called `@everyone` is only text.
- **Buy posts.** At most one every ten seconds per server. A buy older than a minute when the bot reads it is skipped. discord.js handles Discord's own rate limits.
- **Calls.** The first card of a token in a server (asked with `/ca` or a pasted address) notes who called it and the market cap then. Later cards credit them ("🏆 ana @ 10K · 4.0x · 2d"), and `/calls` ranks the last week's calls by how far they went. Names are printed as text, never as mentions. At most 300 calls are kept per server, for 30 days.
- **Alerts.** At most one launch alert and one graduation alert a minute per server; an alert that could not go out within three minutes is dropped. A token is posted at most once per server. A dev-sold warning goes out at once, for the token the buy bot tracks.
- **Restarts.** The bot saves the tokens it knows and reads them back at start, so a card works for a token listed before the restart. Window figures and trades are not saved; they come back from the feed.
- **Quotes.** `/quote` asks the same read-only tool the MCP server gives AI agents (`pons_quote`), in the coin the token trades in as the feed says, so it needs the feed to know the token. A server asks at most six a minute and the same thing once in 30 seconds; nothing is signed or sent. Discord is told to wait first, as a read can take longer than the three seconds it allows.
- **A channel that is gone.** If the bot can no longer post in the buy bot's channel, the buy bot is switched off for that server; a manager runs `/track` again.
- **Dollar figures** come from the feed. Give the feed an ETH price, or buys paid in ETH have no dollar value and none is posted. Buys paid in the chain's dollar coin are valued without it.

## Limits

- It knows the tokens the feed has sent since the bot started.
- Settings live in one JSON file; for many servers, implement the `Store` interface of `@hood-toolkit/bot-core` over a database.
- One process, no sharding.
- No holder verification, no roles, no trading.

## Tests

```
pnpm --filter @hood-toolkit/discord-bot test
```

17 tests cover the commands, the buttons, calls, alerts and the embeds as plain functions. The connection to Discord (`src/main.ts`) is type-checked and was not run against the real Discord API in this repository's tests; that needs your own bot token.

## Licence

MIT
