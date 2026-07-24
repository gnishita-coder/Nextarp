import { NativeModules, Platform } from 'react-native';
import type { CaptureMode, DocumentSide, DocumentType } from './types';

export type CapturedScanImage = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
  fileName?: string;
  type?: string;
  /**
   * Fast native-side mean luma (0-255) of the captured bitmap, computed
   * while the scanner module already had the bitmap decoded. Present on
   * Android via SinglePageScannerModule.sampleBrightnessStats; may be
   * undefined on iOS. Use for cheap "is this too bright?" gating BEFORE
   * running the expensive JS analyzeImageQuality / face / OCR checks.
   */
  brightness?: number;
  /**
   * Variance of the same luma samples (luma^2). High mean + LOW
   * variance = uniformly bright (likely white surface). High mean +
   * HIGH variance = light-coloured document with dark printing (e.g.
   * DNI back). Present on Android whenever `brightness` is.
   */
  brightnessVariance?: number;
  /**
   * Mean luma of just the outer ~6% border strip on every side of the
   * captured image. When ML Kit couldn't crop tightly (typical on
   * white-on-white scans where card edge contrast is low), this strip
   * is the actual surface behind the document - a much more direct
   * "what colour is the background" signal than the whole-image mean.
   * Android-only.
   */
  borderBrightness?: number;
  /** Variance of the same border samples (luma^2). Android-only. */
  borderBrightnessVariance?: number;
  /**
   * Mean luma of the "brightest" corner patch (out of the four 8%x8%
   * corner squares) of the captured image. Robust to mixed
   * backgrounds - e.g. white on top, dark on bottom - because it
   * looks at each corner independently rather than averaging the
   * whole outer strip. Android-only.
   */
  brightestCornerBrightness?: number;
  /**
   * Variance of the same brightest-corner patch (luma^2). A very
   * high-mean + very low-variance corner strongly indicates a
   * uniformly light surface (as opposed to card content leaking into
   * the corner). Android-only.
   */
  brightestCornerVariance?: number;
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
    image?: CapturedScanImage & {
      brightness?: number;
      brightnessVariance?: number;
      borderBrightness?: number;
      borderBrightnessVariance?: number;
      brightestCornerBrightness?: number;
      brightestCornerVariance?: number;
    };
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
