/**
 * Domain types for the document capture flow.
 *
 * NOTE: For this first test build, only 'driving_licence' is wired up end-to-end.
 * 'passport' and 'national_id' are modelled here so the UI/data shape doesn't need
 * to change when they're enabled later.
 */
export type DocumentType = 'driving_licence' | 'passport' | 'national_id';

export type CaptureMode = 'automatic' | 'manual';

export type DocumentSide = 'front' | 'back';

/** Nationalities currently available in the pre-scan country picker. */
export type Nationality = 'ES' | 'TR' | 'FR' | 'DE' | 'IT' | 'NL';

export const NATIONALITY_LABELS: Record<Nationality, string> = {
  ES: 'Spain',
  TR: 'Turkey',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  NL: 'Netherlands',
};

export const NATIONALITY_CODES: Record<Nationality, string> = {
  ES: 'ESP',
  TR: 'TUR',
  FR: 'FRA',
  DE: 'DEU',
  IT: 'ITA',
  NL: 'NLD',
};

export const NATIONALITY_FLAGS: Record<Nationality, string> = {
  ES: '🇪🇸',
  TR: '🇹🇷',
  FR: '🇫🇷',
  DE: '🇩🇪',
  IT: '🇮🇹',
  NL: '🇳🇱',
};

export const NATIONALITIES: Nationality[] = ['ES', 'TR', 'FR', 'DE', 'IT', 'NL'];

/** Result of a single scan, normalized from the document-scanner library's ImageObject. */
export interface CapturedPhoto {
  path: string;
  width: number;
  height: number;
}

export interface CapturedSide {
  side: DocumentSide;
  /** file:// URI of the saved image on device storage */
  uri: string;
  fileSizeBytes: number;
  width: number;
  height: number;
  capturedAt: string; // ISO timestamp
}

export interface SavedDocument {
  id: string;
  documentType: DocumentType;
  label: string;
  folderPath: string;
  sides: CapturedSide[];
  createdAt: string; // ISO timestamp
  /** Nationality selected on the pre-scan step, if any (see Nationality above). */
  nationality?: Nationality;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  driving_licence: 'Driving licence',
  passport: 'Passport',
  national_id: 'National ID',
};

/** Which sides need to be captured for each document type. Both driving
 * licence and passport require front + back (2 photos), per the approved
 * scan-flow mockup. */
export const DOCUMENT_SIDES: Record<DocumentType, DocumentSide[]> = {
  driving_licence: ['front', 'back'],
  passport: ['front', 'back'],
  national_id: ['front', 'back'],
};
