---
name: Country picker + VPN/proxy detection
description: CountryPhoneInput libphonenumber per-country validation, geo mismatch, security-check edge function VPN/proxy/Tor, security_signals table
type: feature
---
- `src/lib/countries.ts` — 70+ countries (dial+flag+FR/EN names), WAEMU prioritized
- `src/lib/phoneValidation.ts` — libphonenumber-js wrapper (validate, formatAsYouType, detectCountryFromE164)
- `src/components/ui/country-phone-input.tsx` — popover picker + national input + mismatch warning
- `src/hooks/useGeoCountry.tsx` — ipapi.co cached, returns country/ip/suspectedHosting
- profiles columns: country_code, signup_country, signup_ip
- `supabase/functions/security-check` (verify_jwt=false): regex match VPN providers/Tor/hosting; inserts security_signals when risk>0 or mismatch
- `security_signals` table (admin-read only, deny client writes); shown in AdminSecurityPage
- Signup soft-warns on VPN; never blocks
