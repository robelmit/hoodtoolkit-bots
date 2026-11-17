/** Finding a token address in what somebody typed. */

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export const isEvmAddress = (text: string): boolean => EVM_ADDRESS.test(text);

/**
 * The first contract address in a text: bare, or inside a link (a token page,
 * a block explorer, a launchpad page), returned in lower case. An address is
 * `0x` and forty hex digits, so a transaction hash (sixty-four), a ticker or
 * an amount never matches.
 */
export function detectAddress(text: string): string | null {
  for (const raw of text.split(/[\s,;]+/)) {
    const word = raw.trim();
    if (!word) continue;
    // In a link the address is a path segment or a query value.
    const candidates = word.includes('/') || word.includes('=') ? word.split(/[/=?#&]/).filter(Boolean) : [word];
    for (const candidate of candidates.reverse()) {
      // Punctuation around it ("…a2?", "(…a2)") is not part of the address.
      const bare = candidate.replace(/^[^0-9a-zA-Z]+|[^0-9a-zA-Z]+$/g, '');
      if (EVM_ADDRESS.test(bare)) return bare.toLowerCase();
    }
  }
  return null;
}

/** A least-buy amount in dollars as an admin types it (`25`, `$1,000`, `2.5k`); null when it is not one. */
export function parseUsd(raw: string): number | null {
  const text = raw.trim().replace(/^\$/, '').replace(/,/g, '').toLowerCase();
  const match = /^(\d+(?:\.\d+)?)([km])?$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]) * (match[2] === 'k' ? 1_000 : match[2] === 'm' ? 1_000_000 : 1);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}
