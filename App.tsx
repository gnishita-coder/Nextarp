/**
 * NextarpSDK - React Native Document Capture SDK
 *
 * Test build scope: Driving licence and Passport capture (front + back where
 * applicable), to validate the camera -> review -> save pipeline end to end,
 * including real quality checks.
 *
 * DEVIATIONS FROM CHECKLIST (need client sign-off):
 *
 * 1. Camera/CV stack: the checklist specifies react-native-vision-camera (v5)
 *    + Nitro Modules + native OpenCV. Vision Camera v5 threw a native
 *    "This device does not have any 'back' Cameras!" error on real Android
 *    hardware (a known, recurring issue upstream), and its ground-up Nitro
 *    rewrite also removed the classic FrameProcessorPlugin API a live OpenCV
 *    overlay would need - confirmed directly in node_modules, not just docs.
 *
 * 2. We tried two alternatives on our own custom-branded camera screen
 *    (matching the approved mockup - purple gradient alignment frame,
 *    Automatic/Manual toggle):
 *      a. react-native-camera-kit (simple, no live frame access) + a
 *         timer-based "hold steady" simulation instead of real detection.
 *      b. A native, post-capture (not live) OpenCV crop step (Canny edge
 *         detection + contour/quad approximation + perspective warp) run
 *         right after camera-kit captured a still photo.
 *    On real-device testing, (b) added several seconds of visible lag before
 *    Review appeared, AND still failed to find a confident document edge on
 *    typical shots (falling back to the raw, uncropped photo) - hand-rolled
 *    contour detection just isn't in the same league as Apple's/Google's
 *    ML-based document detectors.
 *
 * 3. FINAL DECISION: capture now uses @dariyd/react-native-document-scanner's
 *    launchScanner() - Apple VisionKit on iOS, Google ML Kit on Android.
 *    This is an OS-native full-screen scanner modal (their UI, their colors,
 *    their own Auto/Manual capture control and Enhance/Filters/Crop-and-
 *    rotate review step) - NOT our custom-branded screen. The trade-off:
 *    we lose full UI control over the live capture step, in exchange for
 *    genuinely accurate real-time edge detection, auto-capture-on-alignment,
 *    and perspective correction that actually works on cluttered real-world
 *    backgrounds. Our own custom Review and Success screens are still used
 *    afterwards - only the capture step itself is the OS's UI.
 *
 * 4. Quality checks (blur/glare/resolution/orientation, see
 *    src/quality/imageQuality.ts) still run as our own pure-JS post-capture
 *    analysis step on top of whatever VisionKit/ML Kit hands back, shown on
 *    our custom Review screen. Thresholds are starting points and need
 *    calibration against real sample scans before this is production-ready.
 *
 * @format
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchScanner } from '@dariyd/react-native-document-scanner';

import { HomeScreen } from './src/screens/HomeScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ScanningScreen } from './src/screens/ScanningScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { DocumentTypeSheet } from './src/components/DocumentTypeSheet';
import { NationalitySheet } from './src/components/NationalitySheet';
import { BottomTabBar, type TabKey } from './src/components/BottomTabBar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import {
  getSavedDocuments,
  persistCapturedPhoto,
  saveDocumentRecord,
} from './src/storage';
import { analyzeImageQuality, type QualityReport } from './src/quality/imageQuality';
import { checkContainsFace, type FaceCheckResult } from './src/vision/faceCheck';
import { checkNationalityMatch, type NationalityCheckResult } from './src/vision/nationalityCheck';
import type {
  CaptureMode,
  CapturedPhoto,
  CapturedSide,
  DocumentSide,
  DocumentType,
  Nationality,
  SavedDocument,
} from './src/types';
import { DOCUMENT_SIDES } from './src/types';

const NATIONALITY_STORAGE_KEY = 'nextarp.nationality.v1';

type Flow =
  | { screen: 'home' }
  | { screen: 'scanning'; documentType: DocumentType; side: DocumentSide }
  | {
      screen: 'review';
      documentType: DocumentType;
      side: DocumentSide;
      photo: CapturedPhoto;
      quality: QualityReport;
      faceCheck: FaceCheckResult;
      nationalityCheck: NationalityCheckResult;
    }
  | {
      screen: 'success';
      documentType: DocumentType;
      folderPath: string;
      sides: CapturedSide[];
      nationality?: Nationality;
    };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  // Kept for the Home screen's Automatic/Manual tiles (matches the mockup),
  // but no longer changes capture behavior - the OS-native scanner has its
  // own built-in automatic-alignment + manual-shutter UX that we don't
  // control. See deviation #3 in the header comment above.
  const [captureMode, setCaptureMode] = useState<CaptureMode>('automatic');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [flow, setFlow] = useState<Flow>({ screen: 'home' });
  const [saving, setSaving] = useState(false);

  // App-wide nationality setting, chosen from the small flag icon in the
  // Home header (see NationalitySheet) rather than a mandatory full-screen
  // step before every scan. Persisted so it's remembered next launch.
  const [nationality, setNationality] = useState<Nationality>('ES');
  const [nationalityPickerVisible, setNationalityPickerVisible] = useState(false);
  const [documentTypePickerVisible, setDocumentTypePickerVisible] = useState(false);

  // Accumulates sides + folder path across a single document's capture session.
  const [sessionSides, setSessionSides] = useState<CapturedSide[]>([]);
  const [sessionFolderPath, setSessionFolderPath] = useState<string | undefined>();

  const refreshDocuments = useCallback(() => {
    getSavedDocuments().then(setDocuments);
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    AsyncStorage.getItem(NATIONALITY_STORAGE_KEY).then(stored => {
      if (stored === 'ES' || stored === 'TR') {
        setNationality(stored);
      }
    });
  }, []);

  const handleSelectNationality = useCallback((next: Nationality) => {
    setNationality(next);
    AsyncStorage.setItem(NATIONALITY_STORAGE_KEY, next).catch(() => {
      /* non-critical - just means the choice won't be remembered next launch */
    });
  }, []);

  const goHome = useCallback(() => {
    setSessionSides([]);
    setSessionFolderPath(undefined);
    setActiveTab('home');
    setFlow({ screen: 'home' });
  }, []);

  /** Launches the OS-native scanner (VisionKit/ML Kit) for a given side, then
   * runs our own quality analysis + face-presence check (faceCheck.ts) +
   * nationality/country text check (nationalityCheck.ts) against the
   * currently selected nationality setting. */
  const startScanForSide = useCallback(
    async (documentType: DocumentType, side: DocumentSide) => {
      setFlow({ screen: 'scanning', documentType, side });
      try {
        const result = await launchScanner({ quality: 0.9 });

        if (result.didCancel) {
          goHome();
          return;
        }
        if (result.error || !result.images || result.images.length === 0) {
          Alert.alert(
            'Scanner error',
            result.errorMessage || 'The document scanner could not capture an image.',
            [
              { text: 'Cancel', style: 'cancel', onPress: goHome },
              { text: 'Try again', onPress: () => startScanForSide(documentType, side) },
            ],
          );
          return;
        }

        const image = result.images[0];
        const photo: CapturedPhoto = { path: image.uri, width: image.width, height: image.height };
        const [quality, faceCheck, nationalityCheck] = await Promise.all([
          analyzeImageQuality(image.uri, image.width, image.height, documentType),
          checkContainsFace(image.uri),
          checkNationalityMatch(image.uri, nationality),
        ]);

        setFlow({ screen: 'review', documentType, side, photo, quality, faceCheck, nationalityCheck });
      } catch (err) {
        console.warn('[NextarpSDK] launchScanner failed', err);
        Alert.alert('Scanner error', 'Something went wrong opening the scanner.', [
          { text: 'Cancel', style: 'cancel', onPress: goHome },
          { text: 'Try again', onPress: () => startScanForSide(documentType, side) },
        ]);
      }
    },
    [goHome, nationality],
  );

  const openDocumentTypePicker = useCallback(() => {
    setDocumentTypePickerVisible(true);
  }, []);

  const handleSelectDocumentType = useCallback(
    (documentType: DocumentType) => {
      setDocumentTypePickerVisible(false);
      setSessionSides([]);
      setSessionFolderPath(undefined);
      startScanForSide(documentType, DOCUMENT_SIDES[documentType][0]);
    },
    [startScanForSide],
  );

  const handleRetake = useCallback(
    (documentType: DocumentType, side: DocumentSide) => {
      startScanForSide(documentType, side);
    },
    [startScanForSide],
  );

  const handleSaveSide = useCallback(
    async (documentType: DocumentType, side: DocumentSide, photo: CapturedPhoto) => {
      setSaving(true);
      try {
        const { folderPath, side: savedSide } = await persistCapturedPhoto(
          documentType,
          side,
          photo.path,
          photo.width,
          photo.height,
          sessionFolderPath,
        );

        const updatedSides = [...sessionSides, savedSide];
        setSessionSides(updatedSides);
        setSessionFolderPath(folderPath);

        const sidesToCapture = DOCUMENT_SIDES[documentType];
        const sideIndex = sidesToCapture.indexOf(side);
        const nextSide = sidesToCapture[sideIndex + 1];

        if (nextSide) {
          // IMPORTANT: launchScanner() presents a native full-screen modal
          // (VisionKit/ML Kit). Calling it again immediately, in the same
          // tick the previous instance is still animating its dismissal,
          // can cause the second presentation to silently no-op on both
          // iOS and Android - the screen just looks "stuck" and this side
          // never gets saved, so saveDocumentRecord() is never reached and
          // nothing shows up in Documents/Recent scans. A short delay lets
          // the first modal's dismiss animation finish before we present
          // the next one.
          setTimeout(() => {
            startScanForSide(documentType, nextSide);
          }, 450);
        } else {
          await saveDocumentRecord(documentType, folderPath, updatedSides, nationality);
          const afterSave = await getSavedDocuments();
          console.log(
            `[NextarpSDK] saved document record - ${afterSave.length} total documents now in storage`,
          );
          refreshDocuments();
          setFlow({
            screen: 'success',
            documentType,
            folderPath,
            sides: updatedSides,
            nationality,
          });
        }
      } catch (err) {
        // Surface this instead of only logging it - a silently-swallowed
        // failure here is exactly why a capture can look "saved" (Review's
        // button stops loading) while nothing actually landed in storage.
        console.warn('[NextarpSDK] Failed to save captured document', err);
        Alert.alert(
          'Save failed',
          `The photo could not be saved to this document's folder.\n\n${
            err instanceof Error ? err.message : String(err)
          }`,
          [{ text: 'OK' }],
        );
      } finally {
        setSaving(false);
      }
    },
    [sessionSides, sessionFolderPath, nationality, refreshDocuments, startScanForSide],
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <ErrorBoundary>
          {flow.screen === 'home' && (
            <>
              <View style={styles.tabContent}>
                {activeTab === 'home' && (
                  <HomeScreen
                    documents={documents}
                    captureMode={captureMode}
                    onChangeCaptureMode={setCaptureMode}
                    onRequestScan={openDocumentTypePicker}
                    onViewAllDocuments={() => setActiveTab('documents')}
                    nationality={nationality}
                    onPressNationality={() => setNationalityPickerVisible(true)}
                  />
                )}
                {activeTab === 'documents' && <DocumentsScreen documents={documents} />}
                {activeTab === 'settings' && (
                  <SettingsScreen documentCount={documents.length} onDataCleared={refreshDocuments} />
                )}
              </View>
              <BottomTabBar active={activeTab} onChange={setActiveTab} />
            </>
          )}

          <DocumentTypeSheet
            visible={documentTypePickerVisible}
            onSelect={handleSelectDocumentType}
            onClose={() => setDocumentTypePickerVisible(false)}
          />
          <NationalitySheet
            visible={nationalityPickerVisible}
            selected={nationality}
            onSelect={handleSelectNationality}
            onClose={() => setNationalityPickerVisible(false)}
          />

          {flow.screen === 'scanning' && (
            <ScanningScreen documentType={flow.documentType} side={flow.side} />
          )}

          {flow.screen === 'review' && (
            <ReviewScreen
              documentType={flow.documentType}
              side={flow.side}
              photoPath={flow.photo.path}
              photoWidth={flow.photo.width}
              photoHeight={flow.photo.height}
              quality={flow.quality}
              faceCheck={flow.faceCheck}
              nationalityCheck={flow.nationalityCheck}
              nationality={nationality}
              saving={saving}
              onRetake={() => handleRetake(flow.documentType, flow.side)}
              onSave={() => handleSaveSide(flow.documentType, flow.side, flow.photo)}
            />
          )}

          {flow.screen === 'success' && (
            <SuccessScreen
              documentType={flow.documentType}
              folderPath={flow.folderPath}
              sides={flow.sides}
              nationality={flow.nationality}
              onDone={goHome}
              onScanAnother={() => {
                goHome();
                openDocumentTypePicker();
              }}
            />
          )}
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
  },
});

export default App;
