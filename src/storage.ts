import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import type { CapturedSide, DocumentSide, DocumentType, Nationality, SavedDocument } from './types';
import { DOCUMENT_LABELS } from './types';

const INDEX_KEY = 'nextarp.scanned_documents.v1';
const ROOT_FOLDER = `${RNFS.DocumentDirectoryPath}/scanned_ids`;

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function folderSuffix(date: Date) {
  // e.g. 0714 -> month+day, matches the "driving_licence_0714" style folder
  // name in the mockup. IMPORTANT: a time component (HHMMSS) is appended -
  // without it, every driving-licence scan done on the same calendar day
  // mapped to the exact same folder ("scanned_ids/driving_licence_0714")
  // with fixed "front.jpg"/"back.jpg" filenames. A second scan that same
  // day would silently overwrite the first scan's photos on disk, and
  // because a PREVIOUSLY saved document's record still pointed at that same
  // now-overwritten path, its thumbnail/preview would then show whichever
  // scan was saved *last* - exactly the "Save shows the wrong document's
  // photos" bug. Appending the time makes each capture session's folder
  // unique, so different scans never share a path.
  return `${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;
}

/**
 * Moves a temporary captured photo (from the camera) into this document's
 * permanent folder on device storage, and returns metadata about the saved file.
 */
export async function persistCapturedPhoto(
  documentType: DocumentType,
  side: DocumentSide,
  tempPath: string,
  width: number,
  height: number,
  /** Reuse the same folder across multiple sides of one document (pass in the
   * folderPath returned from the first side's capture). */
  folderPathOverride?: string,
): Promise<{ folderPath: string; side: CapturedSide }> {
  const now = new Date();
  const folderName = `${documentType}_${folderSuffix(now)}`;
  const folderPath = folderPathOverride ?? `${ROOT_FOLDER}/${folderName}`;

  await RNFS.mkdir(folderPath);

  const destPath = `${folderPath}/${side}.jpg`;
  // tempPath from the camera may or may not have a file:// prefix depending on platform.
  const normalizedTemp = tempPath.startsWith('file://') ? tempPath.replace('file://', '') : tempPath;

  // Overwrite if a previous attempt for this side already exists (e.g. after a retake).
  if (await RNFS.exists(destPath)) {
    await RNFS.unlink(destPath);
  }
  await RNFS.copyFile(normalizedTemp, destPath);

  const stat = await RNFS.stat(destPath);

  return {
    folderPath,
    side: {
      side,
      uri: `file://${destPath}`,
      fileSizeBytes: Number(stat.size),
      width,
      height,
      capturedAt: now.toISOString(),
    },
  };
}

/** Deletes a single saved document's record (from the AsyncStorage index) and
 * its folder of photos on disk. Used by the Home screen's swipe-to-delete and
 * the Documents tab. */
export async function deleteDocument(id: string): Promise<void> {
  const existing = await getSavedDocuments();
  const target = existing.find(doc => doc.id === id);
  const next = existing.filter(doc => doc.id !== id);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
  if (target) {
    await RNFS.unlink(target.folderPath).catch(() => {
      /* folder may already be gone - ignore */
    });
  }
}

/** Deletes every saved document record and its files on disk. Used by Settings > Clear data (test build only). */
export async function clearAllDocuments(): Promise<void> {
  const existing = await getSavedDocuments();
  await Promise.all(
    existing.map(doc =>
      RNFS.unlink(doc.folderPath).catch(() => {
        /* folder may already be gone - ignore */
      }),
    ),
  );
  await AsyncStorage.removeItem(INDEX_KEY);
}

export async function getSavedDocuments(): Promise<SavedDocument[]> {
  const raw = await AsyncStorage.getItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedDocument[];
    return parsed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    return [];
  }
}

export async function saveDocumentRecord(
  documentType: DocumentType,
  folderPath: string,
  sides: CapturedSide[],
  nationality?: Nationality,
): Promise<SavedDocument> {
  const existing = await getSavedDocuments();

  const record: SavedDocument = {
    id: `${documentType}-${Date.now()}`,
    documentType,
    label: DOCUMENT_LABELS[documentType],
    folderPath,
    sides,
    createdAt: new Date().toISOString(),
    nationality,
  };

  const next = [record, ...existing];
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
  return record;
}

export function formatRelativeTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (isToday) return `Today, ${time}`;
  if (isYesterday) return `Yesterday, ${time}`;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${time}`;
}

export function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${Math.max(1, Math.round(kb))} KB`;
}
