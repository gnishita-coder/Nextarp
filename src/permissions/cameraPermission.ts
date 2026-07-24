import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

type CameraPermissionNative = {
  requestCameraPermission: () => Promise<{ granted: boolean; status: string }>;
};

const NativeSinglePageScanner = NativeModules.SinglePageScanner as
  | CameraPermissionNative
  | undefined;

const ANDROID_CAMERA_RATIONALE =
  'NextarpSDK needs camera access to scan your driving licence and other identity documents.';

/** Requests camera access once — Android via PermissionsAndroid, iOS via AVFoundation. */
export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const alreadyGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (alreadyGranted) {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera permission',
        message: ANDROID_CAMERA_RATIONALE,
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  if (!NativeSinglePageScanner?.requestCameraPermission) {
    return true;
  }

  const result = await NativeSinglePageScanner.requestCameraPermission();
  return result.granted;
}
