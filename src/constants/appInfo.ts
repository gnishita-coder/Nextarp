import { Platform } from 'react-native';

import appPackage from '../../package.json';
import rnPackage from 'react-native/package.json';

export const APP_VERSION = appPackage.version;
export const REACT_NATIVE_VERSION = rnPackage.version;

/**
 * Keep in sync with `minSdkVersion` in android/build.gradle.
 * API 31 = Android 12.
 */
export const MIN_SDK_API_LEVEL = 31;

/** Matches `platform :ios` in ios/Podfile. */
const MIN_IOS_VERSION = '15.5';

/** Maps Android API level to the user-facing OS version (e.g. 31 → "12"). */
const ANDROID_API_TO_VERSION: Record<number, string> = {
  21: '5.0',
  22: '5.1',
  23: '6',
  24: '7.0',
  25: '7.1',
  26: '8.0',
  27: '8.1',
  28: '9',
  29: '10',
  30: '11',
  31: '12',
  32: '12L',
  33: '13',
  34: '14',
  35: '15',
  36: '16',
};

function apiLevelToAndroidVersion(apiLevel: number): string {
  return ANDROID_API_TO_VERSION[apiLevel] ?? String(apiLevel);
}

export function getMinSdkLabel(): string {
  return Platform.OS === 'android' ? 'Min Android Version' : 'Min iOS Version';
}

export function getMinSdkValue(): string {
  if (Platform.OS === 'android') {
    return apiLevelToAndroidVersion(MIN_SDK_API_LEVEL);
  }
  return MIN_IOS_VERSION;
}
