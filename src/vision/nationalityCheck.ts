import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { Nationality } from '../types';

/**
 * Best-effort check: does the scanned document's printed text plausibly
 * match the nationality the user selected? Uses on-device OCR (ML Kit Text
 * Recognition / iOS Vision framework) and a simple keyword search - looking
 * for the country's ISO code, name, or common document phrasing (e.g. a
 * passport's machine-readable zone encodes a 3-letter country code like
 * "ESP" or "TUR").
 *
 * IMPORTANT CAVEATS:
 * - This is NOT a real document-authentication or MRZ-parsing feature. It's
 *   a keyword search over whatever OCR recognized, which varies with photo
 *   angle, lighting, print quality, and font. Treat the result as a helpful
 *   nudge, not a verification - it should only ever produce a dismissable
 *   warning, never a hard block (see the face-detection false-positive we
 *   just hit for exactly why a hard block on ML output is risky).
 * - We only check for the SELECTED nationality's markers. If they're not
 *   found, we say "couldn't confirm" rather than guessing which country it
 *   actually is - guessing wrong would be worse than saying nothing.
 */
export interface NationalityCheckResult {
  matchesSelected: boolean;
  checkAvailable: boolean;
}

const COUNTRY_MARKERS: Record<Nationality, string[]> = {
  ES: ['ESP', 'SPAIN', 'ESPAÑA', 'ESPANA', 'REINO DE ESPAÑA', 'REINO DE ESPANA', 'ESPANOLA'],
  TR: ['TUR', 'TURKEY', 'TÜRKİYE', 'TURKIYE', 'T.C.', 'REPUBLIC OF TURKEY', 'TURKIYE CUMHURIYETI'],
};

export async function checkNationalityMatch(
  uri: string,
  nationality: Nationality,
): Promise<NationalityCheckResult> {
  try {
    const result = await TextRecognition.recognize(uri);
    const text = result.text.toUpperCase();
    const markers = COUNTRY_MARKERS[nationality];
    const matchesSelected = markers.some(marker => text.includes(marker));
    return { matchesSelected, checkAvailable: true };
  } catch (err) {
    console.warn('[NextarpSDK] nationality text check failed', err);
    return { matchesSelected: true, checkAvailable: false };
  }
}
