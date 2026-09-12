import {
  parsePhoneNumber,
  isValidPhoneNumber,
  CountryCode,
} from "libphonenumber-js";

export interface NormalizeResult {
  success: boolean;
  e164?: string;
  error?: string;
}

/**
 * Normalizes a phone number to E.164 format.
 *
 * Handles common issues:
 * - Numbers with leading zeros (Excel strips + prefix)
 * - Numbers stored as integers without country code
 * - Numbers with spaces, dashes, parentheses
 *
 * @param raw - Raw phone number string from import
 * @param defaultCountry - ISO 3166-1 alpha-2 country code to assume when no country code present (e.g. "IN")
 * @returns NormalizeResult with E.164 string or error message
 */
export function normalizePhone(
  raw: string | number | null | undefined,
  defaultCountry: CountryCode = "IN"
): NormalizeResult {
  if (raw === null || raw === undefined || raw === "") {
    return { success: false, error: "Phone number is empty" };
  }

  // Convert number to string (Excel often stores as numeric)
  let cleaned = String(raw).trim();

  // Remove common formatting characters
  cleaned = cleaned.replace(/[\s\-().]/g, "");

  // If starts with 0 and is long enough, try stripping leading zero
  // (e.g. 0919876543210 → 919876543210 then try with +)
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  } else if (cleaned.startsWith("0") && cleaned.length >= 10 && !cleaned.startsWith("0044")) {
    // Could be a local number starting with 0, try removing the leading zero
    cleaned = cleaned.slice(1);
  }

  // Ensure + prefix if we detect a likely international number without it
  if (!cleaned.startsWith("+") && cleaned.length > 10) {
    cleaned = "+" + cleaned;
  }

  try {
    // Try with + prefix first
    if (cleaned.startsWith("+")) {
      const parsed = parsePhoneNumber(cleaned);
      if (parsed && parsed.isValid()) {
        return { success: true, e164: parsed.format("E.164") };
      }
    }

    // Try with default country code
    const parsedWithDefault = parsePhoneNumber(cleaned, defaultCountry);
    if (parsedWithDefault && parsedWithDefault.isValid()) {
      return { success: true, e164: parsedWithDefault.format("E.164") };
    }

    return {
      success: false,
      error: `Cannot parse "${raw}" as a valid phone number`,
    };
  } catch {
    return {
      success: false,
      error: `Cannot parse "${raw}" as a valid phone number`,
    };
  }
}

/**
 * Checks if a string is a valid E.164 phone number.
 */
export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * Detects opt-out keywords in an inbound message body.
 */
export function detectOptOut(
  body: string,
  keywords: string[] = [
    "stop",
    "unsubscribe",
    "don't contact me",
    "dont contact me",
    "remove me",
    "opt out",
    "optout",
    "do not contact",
  ]
): boolean {
  const lower = body.toLowerCase().trim();
  return keywords.some((kw) => lower === kw || lower.includes(kw));
}
