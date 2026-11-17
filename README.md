# hoodtoolkit-bots

Self-hosted community bots for tokens on Robinhood Chain launchpads, from the team behind the Hexa trading terminal. They read the launch feed, never trade, and hold no keys.

| Piece | What it does |
|---|---|
| [telegram-bot](apps/telegram-bot) | A token card for a pasted address or `/ca`, `/trending`, and a buy bot a group's admins set up with `/track` |
| [discord-bot](apps/discord-bot) | The same as slash commands and embeds, with every mention switched off |
| [`@hoodtoolkit/bot-core`](packages/bot-core) | The shared half, with no bot library inside: a reader for the feed, cards, the buy-bot engine, rate limits, stores, and renderers for both platforms |

The bots read the stream of [hoodtoolkit-feed](https://github.com/robelmit/hoodtoolkit-feed). `docker-compose.yml` runs the feed, Redis and the bots together.

```bash
npx @hoodtoolkit/feed | pnpm --filter example-feed-console start   # what a bot would post, as plain text
```

## Principles

- **Nothing here signs, sends or holds a key.**
- **Unknown is never zero.** A value that could not be read stays `null`.
- **Read, never assume.** Pons sets the graduation threshold and the paired asset per launch, and pairs tokens with ETH, a 6-decimal dollar coin, or tokenized stocks.
- **No API key needed.** Everything runs against a Robinhood Chain RPC endpoint you choose.

## Develop

Node 22.13 or newer and pnpm to work on the repository; the published packages run on Node 20 or newer.

```bash
pnpm install
pnpm check        # build, typecheck, test, lint
```

## The hoodtoolkit family

| Repository | What it holds |
|---|---|
| [hoodtoolkit-sdk](https://github.com/robelmit/hoodtoolkit-sdk) | The Pons SDK and the shared EVM client |
| [hoodtoolkit-feed](https://github.com/robelmit/hoodtoolkit-feed) | The launch feed: launches, curve trades and graduations as a stream of events |
| **hoodtoolkit-bots** (this one) | Telegram and Discord community bots |
| [hoodtoolkit-agents](https://github.com/robelmit/hoodtoolkit-agents) | A read-only MCP server for AI agents, and an HTTP API |

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute and [SECURITY.md](SECURITY.md) to report a vulnerability.

## Licence

[MIT](LICENSE)
