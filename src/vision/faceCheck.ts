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

export async function checkContainsFace(uri: string): Promise<FaceCheckResult> {
  try {
    const faces = await FaceDetection.detect(uri, {
      // 'accurate' trades speed for a more thorough pass - needed because
      // printed/scanned ID photos (halftone printing, "SPECIMEN" watermarks,
      // holographic overlays, desaturated/sepia tone) are visually much
      // noisier than a typical live camera selfie, which is what these
      // general-purpose face detectors are mainly tuned for. 'fast' mode
      // produced a real false negative on a clear, well-lit ID photo during
      // testing.
      performanceMode: 'accurate',
      landmarkMode: 'none',
      contourMode: 'none',
      classificationMode: 'none',
      // Lowered from 0.08 - the face on a scanned ID card is often a smaller
      // fraction of the full frame than a live selfie would be.
      minFaceSize: 0.03,
    });
    return { hasFace: faces.length > 0, faceCount: faces.length, checkAvailable: true };
  } catch (err) {
    console.warn('[NextarpSDK] face detection check failed', err);
    return { hasFace: true, faceCount: 0, checkAvailable: false };
  }
}
