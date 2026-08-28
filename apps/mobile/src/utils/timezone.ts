// Shared timezone list. Selecting a country in Create Household or Profile
// suggests a default timezone (see country.ts's defaultTimezone field),
// overridable here. Multi-timezone countries (US, Canada) get one common
// default with the rest available in this picker — auto-deriving a single
// "correct" zone from country alone isn't possible for those two the way
// it is for currency.

export interface TimezoneOption {
  label: string;
  value: string; // IANA name, stored as-is in households.timezone
}

export const TIMEZONES: TimezoneOption[] = [
  { label: '🇳🇬 Lagos (WAT)', value: 'Africa/Lagos' },
  { label: '🇬🇭 Accra (GMT)', value: 'Africa/Accra' },
  { label: '🇿🇦 Johannesburg (SAST)', value: 'Africa/Johannesburg' },
  { label: '🇬🇧 London (GMT/BST)', value: 'Europe/London' },
  { label: '🇨🇦 Toronto (Eastern)', value: 'America/Toronto' },
  { label: '🇨🇦 Vancouver (Pacific)', value: 'America/Vancouver' },
  { label: '🇺🇸 New York (Eastern)', value: 'America/New_York' },
  { label: '🇺🇸 Chicago (Central)', value: 'America/Chicago' },
  { label: '🇺🇸 Denver (Mountain)', value: 'America/Denver' },
  { label: '🇺🇸 Los Angeles (Pacific)', value: 'America/Los_Angeles' },
];

export function getTimezoneLabel(tz?: string | null): string {
  if (!tz) return 'Not set';
  return TIMEZONES.find(t => t.value === tz)?.label || tz;
}