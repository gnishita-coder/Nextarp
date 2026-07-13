import RNFS from 'react-native-fs';
import { decode as decodeJpeg } from 'jpeg-js';
import { toByteArray as base64ToBytes } from 'base64-js';
import type { DocumentType } from '../types';

/**
 * Post-capture image quality analysis (blur, glare, resolution, aspect ratio).
 *
 * IMPORTANT CAVEAT: this is a pure-JS approximation (no native OpenCV, per the
 * decision to avoid another native-module rebuild cycle after the camera
 * library issues earlier in this project). It decodes the captured JPEG with
 * `jpeg-js` and runs a downsampled Laplacian-variance blur estimate and a
 * brightness-histogram glare estimate entirely in JS.
 *
 * The thresholds below are reasonable starting points, NOT calibrated against
 * real driving-licence/passport sample scans. Before this ships, run it
 * against a real batch of sharp/blurry/glare-y test photos and tune
 * BLUR_THRESHOLD / GLARE_RATIO_THRESHOLD accordingly. A native OpenCV
 * pipeline (as originally specified in the checklist) would be materially
 * more accurate and much faster than decoding full JPEGs in JS.
 */

export interface QualityReport {
  /** Laplacian-variance sharpness estimate on a downsampled grid - higher is sharper. */
  blurScore: number;
  isBlurry: boolean;
  /** Average luma (0-255) across the sampled grid. */
  brightness: number;
  /** Fraction (0-1) of sampled pixels that are near-white/overexposed. */
  glareRatio: number;
  hasGlare: boolean;
  resolutionOk: boolean;
  aspectRatioOk: boolean;
  /** True only if every individual check passed. */
  overallPass: boolean;
  /** Human-readable messages for whichever checks failed. */
  warnings: string[];
  /** True if pixel-level analysis (blur/glare) couldn't run at all (e.g. decode failure). */
  analysisUnavailable: boolean;
}

// --- Tunable thresholds (starting points - see caveat above) ---
const BLUR_THRESHOLD = 4;
const GLARE_BRIGHT_LUMA = 250;
const GLARE_RATIO_THRESHOLD = 0.06;
const MIN_WIDTH = 800;
const MIN_HEIGHT = 500;
const ANALYSIS_GRID_SIZE = 300; // downsample to roughly this many samples per axis

// Expected long:short side ratio once the document-scanner has cropped to the
// document bounds. ID-1 cards (driving licence / national ID) are ~85.6x54mm;
// passport bio-data pages are roughly ~1.42:1.
const EXPECTED_ASPECT_RATIO: Record<DocumentType, number> = {
  driving_licence: 1.586,
  national_id: 1.586,
  passport: 1.42,
};
const ASPECT_RATIO_TOLERANCE = 0.35;

export async function analyzeImageQuality(
  uri: string,
  width: number,
  height: number,
  documentType: DocumentType,
): Promise<QualityReport> {
  const warnings: string[] = [];

  const resolutionOk = width >= MIN_WIDTH && height >= MIN_HEIGHT;
  if (!resolutionOk) {
    warnings.push('Resolution is lower than recommended - text may be hard to read.');
  }

  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height) || 1;
  const aspectRatio = longSide / shortSide;
  const expected = EXPECTED_ASPECT_RATIO[documentType];
  const aspectRatioOk = Math.abs(aspectRatio - expected) <= ASPECT_RATIO_TOLERANCE;
  if (!aspectRatioOk) {
    warnings.push('Aspect ratio looks off - the document may be cropped, rotated, or skewed.');
  }

  let blurScore = NaN;
  let isBlurry = false;
  let brightness = NaN;
  let glareRatio = NaN;
  let hasGlare = false;
  let analysisUnavailable = false;

  try {
    const normalizedPath = uri.startsWith('file://') ? uri.replace('file://', '') : uri;
    const base64 = await RNFS.readFile(normalizedPath, 'base64');
    const bytes = base64ToBytes(base64);
    const decoded = decodeJpeg(bytes, {
      useTArray: true,
      formatAsRGBA: true,
      maxResolutionInMP: 30,
      maxMemoryUsageInMB: 512,
    });

    const pixelAnalysis = analyzePixels(decoded.data, decoded.width, decoded.height);
    blurScore = pixelAnalysis.blurScore;
    isBlurry = blurScore < BLUR_THRESHOLD;
    brightness = pixelAnalysis.brightness;
    glareRatio = pixelAnalysis.glareRatio;
    hasGlare = glareRatio > GLARE_RATIO_THRESHOLD;

    if (isBlurry) warnings.push('Image looks blurry - hold steady and retake.');
    if (hasGlare) warnings.push('Glare or overexposure detected - avoid direct light and retake.');
  } catch (err) {
    console.warn('[NextarpSDK][Quality] pixel analysis failed', err);
    analysisUnavailable = true;
    warnings.push('Could not run sharpness/glare analysis on this image.');
  }

  const overallPass = resolutionOk && aspectRatioOk && !isBlurry && !hasGlare && !analysisUnavailable;

  return {
    blurScore,
    isBlurry,
    brightness,
    glareRatio,
    hasGlare,
    resolutionOk,
    aspectRatioOk,
    overallPass,
    warnings,
    analysisUnavailable,
  };
}

function analyzePixels(rgba: Uint8Array, width: number, height: number) {
  const stepX = Math.max(1, Math.floor(width / ANALYSIS_GRID_SIZE));
  const stepY = Math.max(1, Math.floor(height / ANALYSIS_GRID_SIZE));
  const gridWidth = Math.max(1, Math.floor(width / stepX));
  const gridHeight = Math.max(1, Math.floor(height / stepY));

  const luma = new Float64Array(gridWidth * gridHeight);
  let brightSum = 0;
  let brightPixelCount = 0;

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const x = gx * stepX;
      const y = gy * stepY;
      const idx = (y * width + x) * 4;
      const r = rgba[idx] ?? 0;
      const g = rgba[idx + 1] ?? 0;
      const b = rgba[idx + 2] ?? 0;
      const value = 0.299 * r + 0.587 * g + 0.114 * b;
      luma[gy * gridWidth + gx] = value;
      brightSum += value;
      if (value >= GLARE_BRIGHT_LUMA) brightPixelCount++;
    }
  }

  const totalSamples = gridWidth * gridHeight;

  // Laplacian variance over the downsampled grid, as a sharpness proxy.
  let lapSum = 0;
  let lapSumSq = 0;
  let lapCount = 0;
  for (let gy = 1; gy < gridHeight - 1; gy++) {
    for (let gx = 1; gx < gridWidth - 1; gx++) {
      const center = luma[gy * gridWidth + gx];
      const up = luma[(gy - 1) * gridWidth + gx];
      const down = luma[(gy + 1) * gridWidth + gx];
      const left = luma[gy * gridWidth + (gx - 1)];
      const right = luma[gy * gridWidth + (gx + 1)];
      const lap = up + down + left + right - 4 * center;
      lapSum += lap;
      lapSumSq += lap * lap;
      lapCount++;
    }
  }

  const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
  const blurScore = lapCount > 0 ? lapSumSq / lapCount - lapMean * lapMean : 0;

  return {
    blurScore,
    brightness: totalSamples > 0 ? brightSum / totalSamples : 0,
    glareRatio: totalSamples > 0 ? brightPixelCount / totalSamples : 0,
  };
}
