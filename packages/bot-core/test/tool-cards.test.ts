/** The cards drawn from the chain tools' answers: a Pons quote here, and the shared cards and command list. */

import { describe, expect, it } from 'vitest';
import { appCard, fmtUnits, holdersCard, linkTemplates, offeredCommands, quoteAmountIn, quoteCard, quoteToolCall, quoteViewOf, toText } from '../src';

const TOKEN = '0x97720cc1daa1ffbfa9d68f3081b2389c5dd9d67d';
const links = linkTemplates();

describe('quote', () => {
  it('puts in the coin the token trades in, exactly, and refuses when the feed does not know it', () => {
    expect(quoteAmountIn('0.05', { quote: 'ETH', quoteDecimals: 18 })).toEqual({ units: '50000000000000000', symbol: 'ETH', decimals: 18 });
    expect(quoteAmountIn('25', { quote: 'USDG', quoteDecimals: 6 })).toEqual({ units: '25000000', symbol: 'USDG', decimals: 6 });
    expect(quoteAmountIn('0.05', null)).toBeNull();
    expect(quoteAmountIn('0.0001', { quote: 'ETH', quoteDecimals: 18 })).toBeNull();
    expect(quoteToolCall(TOKEN, '1')).toEqual({ name: 'pons_quote', args: { token: TOKEN, side: 'buy', amountIn: '1' } });
  });

  it("draws a Pons buy with the curve's fee and creator tax, and warns of a snipe tax and a refund", () => {
    const result = { side: 'buy', amountIn: '50000000000000000', amountOut: '1234567000000000000000000', minAmountOut: '1197530000000000000000000', slippageBps: 300, fee: '500000000000000', creatorTax: '250000000000000', snipeTax: '1000000000000000', refund: '0', pairedWith: { symbol: 'ETH', decimals: 18 } };
    const text = toText(quoteCard(quoteViewOf(result, { symbol: 'HYLIT', decimals: 18 }), TOKEN, links)).split('\n');
    expect(text[0]).toBe('💱 Quote: 0.05 ETH → HYLIT · on Pons');
    expect(text[1]).toBe('🪙 You get: 1.23M HYLIT');
    expect(text[3]).toBe('📉 Price impact: — · Fee: 0.00075 ETH');
    expect(text[4]).toBe('⚠️ A snipe tax of 0.001 ETH applies: buys in the first seconds after a launch pay it.');
    expect(toText(quoteCard(quoteViewOf({ ...result, snipeTax: '0', refund: '20000000000000000' }, null), TOKEN, links))).toContain('0.02 ETH would come back');
    expect(fmtUnits('1500000', 6)).toBe('1.5');
  });
});

describe('shared cards and commands', () => {
  it('lists only the tool commands this chain has', () => {
    const commands = [{ command: 'ca' }, { command: 'quote' }, { command: 'safety' }, { command: 'app' }];
    expect(offeredCommands(commands, { tools: ['pons_quote', 'pons_token'] }).map((c) => c.command)).toEqual(['ca', 'quote']);
    expect(offeredCommands(commands, null).map((c) => c.command)).toEqual(['ca']);
  });

  it('draws holders and an app answer with this chain\'s explorer, and no holder map link by default', () => {
    const view = { nodes: [{ id: '0x5bbe3adb4e5fc0747d7b261acea5be4fc157692c', pct: 4.2, type: 'holder' }], clusters: [] };
    const text = toText(holdersCard(view, 'HYLIT', TOKEN, links));
    expect(text).toContain('1. 0x5b…692c 4.2%');
    expect(text).not.toContain('🫧');
    expect(toText(appCard({ signature: '0xsig', platform: null, by: null, evidence: null }, links))).toContain('unknown, not "none"');
  });
});

describe('terminal', () => {
  it('prints bold figures and underlined link words, and drops escape codes from outside text', async () => {
    const { toAnsi } = await import('../src');
    expect(toAnsi([['MC ', { value: '$4K' }, ' ', { link: 'EXP', url: 'https://x' }, ' ', { bold: '\u001b[31mred' }]])).toBe('MC \u001b[1m$4K\u001b[0m \u001b[4mEXP\u001b[0m \u001b[1m[31mred\u001b[0m');
  });
});
