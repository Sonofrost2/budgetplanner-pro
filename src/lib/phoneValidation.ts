import { parsePhoneNumberFromString, AsYouType, type CountryCode } from 'libphonenumber-js';
import { findCountryByCode } from './countries';

/** Validate a national-format number against a country code. Returns the E.164 string if valid. */
export const validatePhone = (national: string, countryCode: string): string | null => {
  const cc = countryCode.toUpperCase() as CountryCode;
  const cleaned = (national || '').trim();
  if (!cleaned) return null;
  try {
    const parsed = parsePhoneNumberFromString(cleaned, cc);
    if (parsed && parsed.isValid()) return parsed.number;
  } catch {
    /* ignore */
  }
  // Fallback: combine dial code + digits
  const country = findCountryByCode(countryCode);
  if (!country) return null;
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;
  const candidate = `${country.dial}${digits}`;
  try {
    const parsed = parsePhoneNumberFromString(candidate, cc);
    if (parsed && parsed.isValid()) return parsed.number;
  } catch {
    /* ignore */
  }
  return null;
};

/** Format the user's typing as they go (national format for the picked country). */
export const formatAsYouType = (input: string, countryCode: string): string => {
  try {
    return new AsYouType(countryCode.toUpperCase() as CountryCode).input(input || '');
  } catch {
    return input;
  }
};

/** Try to detect the country of an existing E.164 number. */
export const detectCountryFromE164 = (e164: string): string | null => {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    return parsed?.country ?? null;
  } catch {
    return null;
  }
};

/** Get the national (no dial-code) part of an E.164 number for editing. */
export const getNationalPart = (e164: string): string => {
  try {
    const parsed = parsePhoneNumberFromString(e164);
    return parsed?.nationalNumber ?? '';
  } catch {
    return '';
  }
};