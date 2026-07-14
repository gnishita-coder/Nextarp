import FaceDetection from '@react-native-ml-kit/face-detection';

/**
 * ID-document validation: every driving licence and passport has a face
 * photo, so requiring at least one detected face is a simple, effective way
 * to reject "captured anything" (a random rectangular object VisionKit/ML
 * Kit's generic document scanner will happily auto-capture) without needing
 * to actually read/verify the document's content.
 *
 * Uses Google ML Kit Face Detection (Android) / Apple's Vision framework
 * (iOS) via @react-native-ml-kit/face-detection - on-device, no network
 * call, no extra permissions beyond what's already granted for the camera.
 *
 * Fails open: if the native call itself errors (module not linked yet,
 * unreadable file, etc.) we don't block the user - `checkAvailable: false`
 * signals the caller to treat this as "couldn't verify" rather than "no
 * face found", since blocking on our own infra failure would be worse than
 * the problem we're solving.
 */
export interface FaceCheckResult {
  hasFace: boolean;
  faceCount: number;
  checkAvailable: boolean;
}

/** Runs a single ML Kit detection pass. Returns null (rather than throwing)
 * if the native call itself fails, so the caller can tell "this pass
 * couldn't run" apart from "this pass ran and found nothing". */
async function detectFaces(
  uri: string,
  options: Parameters<typeof FaceDetection.detect>[1],
) {
  try {
    return await FaceDetection.detect(uri, options);
  } catch (err) {
    console.warn('[NextarpSDK] face detection pass failed', err);
    return null;
  }
}

export async function checkContainsFace(uri: string): Promise<FaceCheckResult> {
  // First pass: 'accurate' trades speed for a more thorough pass - needed
  // because printed/scanned ID photos (halftone printing, "SPECIMEN"/
  // "ESPECIMEN" watermarks, holographic overlays, desaturated/sepia tone)
  // are visually much noisier than a typical live camera selfie, which is
  // what these general-purpose face detectors are mainly tuned for.
  const primary = await detectFaces(uri, {
    performanceMode: 'accurate',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'none',
    // Lowered from 0.08 - the face on a scanned ID card is often a smaller
    // fraction of the full frame than a live selfie would be.
    minFaceSize: 0.03,
  });

  if (primary == null) {
    // The native call itself failed (module not linked, unreadable file,
    // etc.) - fail open rather than trying a second pass that would likely
    // fail the same way.
    return { hasFace: true, faceCount: 0, checkAvailable: false };
  }

  if (primary.length > 0) {
    return { hasFace: true, faceCount: primary.length, checkAvailable: true };
  }

  // The primary pass found nothing, but real scans have kept tripping this
  // up in testing - e.g. a diagonal "SPECIMEN"/"ESPECIMEN" watermark
  // crossing the photo, or a photo that's a smaller/lower-contrast portion
  // of the full card. 'accurate' and 'fast' use different underlying model
  // paths, so retrying with 'fast' (and an even smaller minimum face size)
  // can catch a face the first pass missed - this is a genuine second
  // opinion, not just a repeat of the same check. Only after BOTH passes
  // come up empty do we treat this as "no face found".
  const fallback = await detectFaces(uri, {
    performanceMode: 'fast',
    landmarkMode: 'none',
    contourMode: 'none',
    classificationMode: 'none',
    minFaceSize: 0.015,
  });

  const faces = fallback ?? [];
  return { hasFace: faces.length > 0, faceCount: faces.length, checkAvailable: true };
}
