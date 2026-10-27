import { formatAgentPrice, normalizeCurrencyCode } from './agent-price.util';

describe('saved agent prices', () => {
  it.each([
    ['TZS', 12000, 'TZS 12,000/kg'],
    ['USD', '15.50', 'USD 15.5/kg'],
    ['EUR', 20, 'EUR 20/kg'],
    ['GBP', 25, 'GBP 25/kg'],
    ['KES', 1500, 'KES 1,500/kg'],
    ['UGX', 5000, 'UGX 5,000/kg'],
    [' tsh ', 12000, 'TZS 12,000/kg'],
    ['TZS', 0, 'TZS 0/kg'],
  ] as const)('formats %s prices without conversion', (currency, price, expected) => {
    expect(formatAgentPrice({ currency, base_price: price })).toBe(expected);
  });

  it.each([null, undefined, '', '   ', 'not-a-number', -1, Infinity])(
    'handles missing or invalid price %s',
    (price) => {
      expect(formatAgentPrice({ currency: 'TZS', base_price: price })).toBe('Contact for price');
    },
  );

  it('does not assume dollars when the currency is missing', () => {
    expect(formatAgentPrice({ base_price: 20 })).toBe('Contact for price');
    expect(normalizeCurrencyCode(' usd ')).toBe('USD');
  });
});
