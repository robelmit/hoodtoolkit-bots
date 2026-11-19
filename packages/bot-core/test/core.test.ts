import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CardLimiter,
  DASH,
  JsonFileStore,
  MemoryStore,
  SendSlots,
  ago,
  buttonsFor,
  checksText,
  detectAddress,
  escapeDiscord,
  escapeMarkdownV2,
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtQuote,
  fmtTokenAmount,
  fmtUsd,
  fromBaseUnits,
  fmtShort,
  linkTemplates,
  parseButtons,
  parseLinkRow,
  parseUsd,
  shortAddr,
  telegramEntities,
  toDiscord,
  toMarkdownV2,
  toPlain,
  toText,
  tokenCard,
  trendingCard,
  txUrl,
  type BuyBotConfig,
  type Line,
  type TokenView,
} from '../src';

const MINT = '0x97720cc1daa1ffbfa9d68f3081b2389c5dd9d67d';
const EXPLORER = 'https://robinhoodchain.blockscout.com';

describe('format', () => {
  it('prints dollars at every size, and unknown as a dash', () => {
    expect(fmtUsd(1.234)).toBe('$1.23');
    expect(fmtUsd(12_345)).toBe('$12.3K');
    expect(fmtUsd(4_560_000)).toBe('$4.56M');
    expect(fmtUsd(1_200_000_000)).toBe('$1.2B');
    expect(fmtUsd(0)).toBe('$0.00');
    expect(fmtUsd(-5)).toBe('-$5.00');
    expect(fmtUsd(null)).toBe(DASH);
    expect(fmtUsd(Number.NaN)).toBe(DASH);
  });

  it('prints small prices with a zero count', () => {
    expect(fmtPrice(0.0000044460552501)).toBe('$0.0₅4446');
    expect(fmtPrice(0.00002)).toBe('$0.0₄2');
    expect(fmtPrice(0.0002)).toBe('$0.0₃2');
    expect(fmtPrice(0.0123456)).toBe('$0.012346');
    expect(fmtPrice(1.5)).toBe('$1.5');
    expect(fmtPrice(12_345.6)).toBe('$12,346');
    expect(fmtPrice(undefined)).toBe(DASH);
  });

  it('prints percentages, counts and ages', () => {
    expect(fmtPct(12.34)).toBe('+12.3%');
    expect(fmtPct(-3)).toBe('-3%');
    expect(fmtPct(0)).toBe('0%');
    expect(fmtPct(null)).toBe(DASH);
    expect(fmtNum(1_234)).toBe('1,234');
    expect(fmtNum(20_000)).toBe('20K');
    expect(fmtNum(null)).toBe(DASH);
    expect(ago(1_000, 46_000)).toBe('45s');
    expect(ago(0, 7_200_000 + 1)).toBe(DASH);
    expect(ago(1, 7_200_001)).toBe('2h');
  });

  it('converts base units exactly and refuses what it cannot read', () => {
    expect(fromBaseUnits('1500000', 6)).toBe('1.5');
    expect(fromBaseUnits('123456789012345678901234567890', 18)).toBe('123456789012.34567890123456789');
    expect(fromBaseUnits('5', 0)).toBe('5');
    expect(fromBaseUnits('1.5', 6)).toBeNull();
    expect(fromBaseUnits('100', null)).toBeNull();
    expect(fmtTokenAmount('30877697777999', 6)).toBe('30.88M');
    expect(fmtTokenAmount('500', 6)).toBe('0.0005');
    expect(fmtTokenAmount('500', null)).toBe(DASH);
    expect(fmtQuote('4200000000000000', 18, 'ETH')).toBe('0.0042 ETH');
    expect(fmtQuote('25000000', 6, 'USDG')).toBe('25 USDG');
    expect(fmtQuote('1234567890000', 6, 'USDG')).toBe('1234567.89 USDG');
    expect(fmtQuote('5', 18, null)).toBe('0');
    // The same base units at unknown decimals are not a number anyone should read.
    expect(fmtQuote('25000000', null, 'USDG')).toBe(DASH);
    expect(fmtQuote('abc', 18, 'ETH')).toBe(DASH);
    expect(shortAddr(MINT)).toBe('0x97…d67d');
  });
});

describe('parse', () => {
  it('finds an address on its own, in a sentence and in a link, in lower case', () => {
    expect(detectAddress(MINT)).toBe(MINT);
    expect(detectAddress(MINT.toUpperCase().replace('0X', '0x'))).toBe(MINT);
    expect(detectAddress(`anyone looked at ${MINT}?`)).toBe(MINT);
    expect(detectAddress(`(${MINT}),`)).toBe(MINT);
    expect(detectAddress(`${EXPLORER}/token/${MINT}?tab=holders`)).toBe(MINT);
    expect(detectAddress(`https://example.com/swap?outputToken=${MINT}&x=1`)).toBe(MINT);
  });

  it('ignores ordinary words, tickers, amounts, transaction hashes and other chains\' addresses', () => {
    expect(detectAddress('gm everyone, buying $HOOD at 0.5 eth')).toBeNull();
    expect(detectAddress(`0x${'ab'.repeat(32)}`)).toBeNull();
    expect(detectAddress('0x4f833f1e00000000000000000000000000000044')).toBe('0x4f833f1e00000000000000000000000000000044');
    expect(detectAddress('0x4f833f1e0000000000000000000000000000004444')).toBeNull();
    expect(detectAddress('FWFxnxR1Esvv6Ebcntr357ri1mucV5FiKTG1kEiBpump')).toBeNull();
    expect(detectAddress('')).toBeNull();
  });

  it('reads a dollar amount as an admin types it', () => {
    expect(parseUsd('25')).toBe(25);
    expect(parseUsd('$1,000')).toBe(1000);
    expect(parseUsd('2.5k')).toBe(2500);
    expect(parseUsd('1m')).toBe(1_000_000);
    expect(parseUsd('abc')).toBeNull();
    expect(parseUsd('-5')).toBeNull();
    expect(parseUsd('')).toBeNull();
  });
});

describe('links', () => {
  it('defaults to the chain\'s official explorer', () => {
    const links = linkTemplates();
    expect(buttonsFor(links, MINT)).toEqual([{ label: 'Explorer', url: `${EXPLORER}/token/${MINT}` }]);
    expect(txUrl(links, '0xabc')).toBe(`${EXPLORER}/tx/0xabc`);
  });

  it('takes a community\'s own buttons and fills the address in', () => {
    const buttons = parseButtons('Chart|https://example.com/chart/{address}, Trade|https://example.org/t?mint={address}');
    const links = linkTemplates({ buttons });
    expect(buttonsFor(links, 'A B')).toEqual([
      { label: 'Chart', url: 'https://example.com/chart/A%20B' },
      { label: 'Trade', url: 'https://example.org/t?mint=A%20B' },
    ]);
  });

  it('stops at start on a button that is not a labelled https link', () => {
    expect(() => parseButtons('https://example.com/{address}')).toThrow(/Label\|https/);
    expect(() => parseButtons('Chart|http://example.com/{address}')).toThrow(/https/);
    expect(() => parseButtons('Chart|javascript:alert(1)')).toThrow(/https/);
    expect(() => parseButtons('Chart|not a url')).toThrow(/URL/);
    expect(() => parseButtons(Array.from({ length: 6 }, (_, i) => `B${i}|https://example.com/${i}`).join(','))).toThrow(/at most 5/);
    expect(() => linkTemplates({ token: 'ftp://example.com/{address}' })).toThrow(/https/);
    expect(parseButtons('  ')).toEqual([]);
  });
});

describe('rich text', () => {
  const lines: Line[] = [[{ bold: 'A*B_C' }, ' — 1.5% (ok)'], [{ code: 'x`y\\z' }], [{ link: 'tx [1]', url: 'https://example.com/a(b)c' }]];

  it('escapes Telegram MarkdownV2 everywhere it matters', () => {
    expect(toMarkdownV2(lines)).toBe('*A\\*B\\_C* — 1\\.5% \\(ok\\)\n`x\\`y\\\\z`\n[tx \\[1\\]](https://example.com/a(b\\)c)');
    expect(escapeMarkdownV2('a.b-c!')).toBe('a\\.b\\-c\\!');
  });

  it('escapes Discord markdown and defuses mentions', () => {
    expect(toDiscord([[{ bold: '@everyone *hi*' }], [{ link: 'x', url: 'https://example.com/a b>c' }], [{ code: 'a`b' }]])).toBe('**@​everyone \\*hi\\***\n[x](<https://example.com/abc>)\n`ab`');
    expect(escapeDiscord('[a](b)')).toBe('\\[a\\]\\(b\\)');
  });

  it('falls back to plain text', () => {
    expect(toPlain(lines)).toBe('A*B_C — 1.5% (ok)\nx`y\\z\ntx [1] (https://example.com/a(b)c)');
  });
});

describe('cards', () => {
  const token: TokenView = {
    address: MINT,
    symbol: 'ZOP',
    name: 'Zop [new]',
    launchpad: 'pons',
    stage: 'bonding',
    curve: 71.4,
    quote: 'USDG',
    price: 0.0000044460552501,
    mc: 4446.05,
    liqUsd: null,
    holders: null,
    createdAt: 1_000,
    m5: { trades: 3, buys: 2, volumeUsd: 820, priceChangePct: 12.34 },
    lastTradeAt: 60_000,
  };

  it("prints a token card in the traders' order, with unknown figures as dashes", () => {
    const lines = tokenCard(token, linkTemplates(), 61_000);
    expect(toText(lines).split('\n')).toEqual([
      '🧪 Zop [new] [4.4K / +12% 5m] $ZOP/USDG',
      '🪶 Robinhood Chain @ Pons · curve 71%',
      '💰 Price: $0.0₅4446',
      '💎 MC: $4.4K',
      '💧 Liq: —',
      '📈 5M: +12.3% · $820 · 🅑 2 Ⓢ 1',
      '📊 Age: 1m',
      '👥 Holders: —',
      '🔗 EXP · LIVE · X',
      '',
      MINT,
      '♻️ Updated 1970-01-01 00:01 UTC',
    ]);
    expect(toPlain(lines)).toContain(`EXP (${EXPLORER}/token/${MINT})`);
    expect(toPlain(lines)).toContain(`LIVE (https://hoodtoolkit-live.vercel.app/#/token/${MINT})`);
    // Checks are shown only when a source sends them.
    const checked = toText(tokenCard({ ...token, audit: { mintRevoked: true, freezeRevoked: null }, risk: { top10Pct: 31.2, devPct: 3.08 } }, linkTemplates(), 61_000));
    expect(checked).toContain('🛡 mint ✅ · freeze — · top 10 31% · dev 3%');
    expect(toMarkdownV2(lines)).toContain(`🧪 [Zop \\[new\\]](${EXPLORER}/token/${MINT}) *\\[4\\.4K / \\+12% 5m\\]* $ZOP/USDG`);
    expect(toDiscord(lines)).toContain('💎 MC: `$4.4K`');
  });

  it('shows the hour the bot watched, the peak, the rank and the first call when they are known', () => {
    const rich: TokenView = { ...token, mc: 40_000, h1: { buys: 25, sells: 30, volumeUsd: 1_539, priceChangePct: -11.7 }, peak: { mc: 120_000, at: 1_000 } };
    const text = toText(tokenCard(rich, linkTemplates(), 3_601_000, { rank: 4, caller: { by: 'ana', mc: 10_000, at: 1_000 } })).split('\n');
    expect(text[0]).toBe('🧪 Zop [new] [40K / -12% 1h] $ZOP/USDG');
    expect(text[1]).toBe('🪶 Robinhood Chain @ Pons · curve 71% · 🔥 #4');
    expect(text[3]).toBe('💎 MC: $40K ⇨ $120K peak [1h]');
    expect(text[5]).toBe('📈 1H: -11.7% · $1.5K · 🅑 25 Ⓢ 30 · 5M +12.3%');
    expect(text).toContain('🏆 ana @ 10K · 4.0x · 1h');
  });

  it("stays under Telegram's 100 formatting entities with every link filled", () => {
    const row = parseLinkRow(Array.from({ length: 10 }, (_, i) => `L${i}|https://example.com/${i}/{address}`).join(','));
    expect(telegramEntities(tokenCard(token, linkTemplates({ row, holderMap: 'https://example.com/m/{address}' }), 61_000, { rank: 1 }))).toBeLessThan(100);
    expect(fmtShort(12_345_678)).toBe('12.3M');
  });

  it('says nothing about checks the feed did not send', () => {
    expect(checksText({})).toBeNull();
    expect(checksText({ audit: { mintRevoked: false } })).toBe('mint ⚠️ · freeze —');
    expect(checksText({ risk: { rugged: true } })).toBe('mint — · freeze — · rugged ⚠️');
  });

  it('prints the trending list, and says so when nothing traded', () => {
    const text = toPlain(trendingCard([token], linkTemplates()));
    expect(text).toContain('top 1 by 5m volume');
    expect(text).toContain('Trending on Robinhood Chain launchpads');
    expect(text).toContain(`1. ZOP (${EXPLORER}/token/${MINT}) · MC $4.4K · 5m +12.3% · Vol $820 · curve 71%`);
    expect(toPlain(trendingCard([], linkTemplates()))).toContain('Nothing with a dollar volume traded');
  });
});

describe('limits', () => {
  it('answers an address once in two minutes, and ten cards a minute per community', () => {
    let now = 0;
    const limiter = new CardLimiter(10, 120_000, () => now);
    expect(limiter.allow('g', 'A')).toBe(true);
    expect(limiter.allow('g', 'A')).toBe(false);
    expect(limiter.allow('other', 'A')).toBe(true);
    for (let i = 0; i < 9; i += 1) expect(limiter.allow('g', `T${i}`)).toBe(true);
    expect(limiter.allow('g', 'Eleventh')).toBe(false);
    now = 61_000;
    expect(limiter.allow('g', 'Eleventh')).toBe(true);
    now = 120_001;
    expect(limiter.allow('g', 'A')).toBe(true);
  });

  it('hands out send times inside a chat\'s gap, its minute and the bot\'s own rate', () => {
    const now = 1_000_000;
    const slots = new SendSlots(() => ({ perMinute: 3, gapMs: 1_000, globalPerSecond: 2 }), () => now);
    const take = (chat: string): number => {
      const t = slots.next(chat);
      slots.reserve(chat, t);
      return t - now;
    };
    expect([take('a'), take('a'), take('a')]).toEqual([0, 1_000, 2_000]);
    expect(take('a')).toBe(60_000);
    // Two other chats already hold this second across the bot (a at 0, b at 0): the third waits for the next one.
    expect(take('b')).toBe(0);
    expect(take('c')).toBe(1_000);
  });

  it('holds a chat back for as long as the platform said', () => {
    let now = 0;
    const slots = new SendSlots(() => ({ perMinute: 20, gapMs: 0, globalPerSecond: 30 }), () => now);
    slots.block('a', 5_000);
    expect(slots.next('a')).toBe(5_000);
    expect(slots.next('b')).toBe(0);
    now = 6_000;
    expect(slots.next('a')).toBe(6_000);
  });
});

describe('stores', () => {
  const buyBot: BuyBotConfig = { address: MINT, symbol: 'ZOP', decimals: 6, minUsd: 25, media: { kind: 'photo', fileId: 'file-1' }, channelId: null, setBy: '7', setAt: 5 };

  it('keeps a community, patches it, and lists the ones with a buy bot it is still in', async () => {
    let now = 10;
    const store = new MemoryStore(() => now);
    expect(await store.get('g')).toBeNull();
    expect(await store.upsert('g', { title: 'Group' })).toEqual({ id: 'g', title: 'Group', buyBot: null, alerts: null, calls: [], left: false, updatedAt: 10 });
    now = 20;
    await store.upsert('g', { buyBot });
    expect((await store.get('g'))!.title).toBe('Group');
    expect((await store.withBuyBot()).map((r) => r.id)).toEqual(['g']);
    await store.upsert('g', { left: true });
    expect(await store.withBuyBot()).toEqual([]);
  });

  it('moves a community to its new id', async () => {
    const store = new MemoryStore();
    await store.upsert('old', { title: 'Group', buyBot });
    await store.migrate('old', 'new');
    await store.migrate('missing', 'x');
    expect(await store.get('new')).toMatchObject({ title: 'Group', buyBot, left: false });
    expect(await store.get('old')).toMatchObject({ buyBot: null, left: true });
    expect(await store.get('x')).toBeNull();
  });

  it('writes one JSON file and reads it back, and refuses a file it cannot read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bot-core-'));
    try {
      const path = join(dir, 'nested', 'store.json');
      const store = await JsonFileStore.open(path, () => 42);
      await Promise.all([store.upsert('a', { title: 'A', buyBot }), store.upsert('b', { title: 'B' })]);
      const again = await JsonFileStore.open(path);
      expect(await again.get('a')).toEqual({ id: 'a', title: 'A', buyBot, alerts: null, calls: [], left: false, updatedAt: 42 });
      expect((await again.withBuyBot()).map((r) => r.id)).toEqual(['a']);
      expect(JSON.parse(await readFile(path, 'utf8')).version).toBe(1);

      await writeFile(path, '{"communities":[{"id":"ok"},{"nope":1},{"id":"c","buyBot":{"address":"x"}}]}');
      const loose = await JsonFileStore.open(path);
      expect(await loose.get('ok')).toMatchObject({ id: 'ok', title: null, left: false });
      expect((await loose.get('c'))!.buyBot).toBeNull();

      await writeFile(path, '{broken');
      await expect(JsonFileStore.open(path)).rejects.toThrow(/not JSON/);
      await writeFile(path, '{}');
      await expect(JsonFileStore.open(path)).rejects.toThrow(/communities/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
