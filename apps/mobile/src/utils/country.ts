// Shared country list + country→currency/timezone mapping. Selecting a
// country in Create Household or Profile determines the household's
// currency and suggested timezone automatically. Both can still be changed
// independently afterward from Profile — those manual choices only get
// overwritten again if the country itself is changed later.
//
// Deliberately a short, curated list, not all ~195 countries — extend
// this array as new markets are actually tested, rather than maintaining
// a huge list nobody's using yet.

export interface CountryOption {
  label: string;
  value: string;        // stored as-is in households.country
  currency: string;     // must match a value in CURRENCIES (currency.ts)
  defaultTimezone: string; // must match a value in TIMEZONES (timezone.ts) — a starting point, always changeable afterward
}

export const COUNTRIES: CountryOption[] = [
  { label: '🇳🇬 Nigeria', value: 'Nigeria', currency: 'NGN', defaultTimezone: 'Africa/Lagos' },
  { label: '🇺🇸 United States', value: 'United States', currency: 'USD', defaultTimezone: 'America/New_York' },
  { label: '🇨🇦 Canada', value: 'Canada', currency: 'CAD', defaultTimezone: 'America/Toronto' },
  { label: '🇬🇧 United Kingdom', value: 'United Kingdom', currency: 'GBP', defaultTimezone: 'Europe/London' },
  { label: '🇬🇭 Ghana', value: 'Ghana', currency: 'GHS', defaultTimezone: 'Africa/Accra' },
  { label: '🇿🇦 South Africa', value: 'South Africa', currency: 'ZAR', defaultTimezone: 'Africa/Johannesburg' },
];

export function getCurrencyForCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  return COUNTRIES.find(c => c.value === country)?.currency;
}

export function getTimezoneForCountry(country?: string | null): string | undefined {
  if (!country) return undefined;
  return COUNTRIES.find(c => c.value === country)?.defaultTimezone;
}