// Shared currency list + helpers. Household currency (set in Profile, or
// auto-derived from Country — see country.ts) is the single source of
// truth every module (Bills, Grocery, etc.) should read from.

export interface CurrencyOption {
  label: string;
  value: string;
  symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { label: '🇳🇬 NGN (₦)', value: 'NGN', symbol: '₦' },
  { label: '🇺🇸 USD ($)', value: 'USD', symbol: '$' },
  { label: '🇨🇦 CAD ($)', value: 'CAD', symbol: '$' },
  { label: '🇬🇧 GBP (£)', value: 'GBP', symbol: '£' },
  { label: '🇪🇺 EUR (€)', value: 'EUR', symbol: '€' },
  { label: '🇿🇦 ZAR (R)', value: 'ZAR', symbol: 'R' },
  { label: '🇬🇭 GHS (GH₵)', value: 'GHS', symbol: 'GH₵' },
];

export function getCurrencySymbol(code?: string | null): string {
  if (!code) return '$';
  return CURRENCIES.find(c => c.value === code)?.symbol || code;
}

export function formatCurrency(amount: number | undefined | null, code?: string | null, decimals = 0): string {
  const symbol = getCurrencySymbol(code);
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `${symbol}${safeAmount.toFixed(decimals)}`;
}
