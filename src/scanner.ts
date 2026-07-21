import { NativeModules, Platform } from 'react-native';
import type { CaptureMode, DocumentSide, DocumentType } from './types';

export type CapturedScanImage = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  fileName?: string;
  type?: string;
};

export type SinglePageScanResult = {
  didCancel?: boolean;
  error?: boolean;
  errorMessage?: string;
  image?: CapturedScanImage;
  images?: CapturedScanImage[];
};

type SinglePageScannerNative = {
  launch: (options: SinglePageScannerOptions) => Promise<{
    didCancel?: boolean;
    image?: CapturedScanImage;
  }>;
};

export type SinglePageScannerOptions = {
  documentType: DocumentType;
  side: DocumentSide;
  captureMode: CaptureMode;
};

const NativeSinglePageScanner = NativeModules.SinglePageScanner as
  | SinglePageScannerNative
  | undefined;

/**
 * Single-photo document capture with live edge overlay + automatic crop.
 * - Android: ML Kit Document Scanner with pageLimit = 1 (live edges + crop)
 * - iOS: custom camera with Vision live rectangle overlay + crop on shutter
 */
export async function launchSinglePageScanner(
  options: SinglePageScannerOptions,
): Promise<SinglePageScanResult> {
  if (!NativeSinglePageScanner?.launch) {
    return {
      error: true,
      errorMessage:
        `Single-page scanner is not linked on ${Platform.OS}. ` +
        'Delete the app and do a full native rebuild.',
    };
  }

  try {
    const result = await NativeSinglePageScanner.launch(options);
    if (result.didCancel) {
      return { didCancel: true };
    }
    if (!result.image?.uri) {
      return { error: true, errorMessage: 'No image was captured' };
    }
    return { image: result.image, images: [result.image] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cancel/i.test(message)) {
      return { didCancel: true };
    }
    console.warn(`[NextarpSDK] SinglePageScanner failed (${Platform.OS}):`, err);
    return { error: true, errorMessage: message };
  }
}
