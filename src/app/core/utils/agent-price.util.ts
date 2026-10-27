const priceFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function normalizeCurrencyCode(currency: string | null | undefined): string {
  const code = currency?.trim().toUpperCase() || '';
  return code === 'TSH' ? 'TZS' : code;
}

/** Display saved prices without assuming a currency or converting the amount. */
export function formatAgentPrice(agent: {
  base_price: number | string | null | undefined;
  currency?: string | null;
}): string {
  const code = normalizeCurrencyCode(agent.currency);
  const price = agent.base_price;
  if (
    !code ||
    price === null ||
    price === undefined ||
    (typeof price === 'string' && !price.trim())
  ) {
    return 'Contact for price';
  }
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount < 0) return 'Contact for price';
  return `${code} ${priceFormat.format(amount)}/kg`;
}
