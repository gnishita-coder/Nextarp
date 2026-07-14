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
import { DocumentDetailScreen } from './src/screens/DocumentDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ScanningScreen } from './src/screens/ScanningScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { BackSideScreen } from './src/screens/BackSideScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { DocumentTypeSheet } from './src/components/DocumentTypeSheet';
import { NationalitySheet } from './src/components/NationalitySheet';
import { BottomTabBar, type TabKey } from './src/components/BottomTabBar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import {
  deleteDocument,
  getSavedDocuments,
  persistCapturedPhoto,
  renameDocument,
  saveDocumentRecord,
} from './src/storage';
import { analyzeImageQuality, type QualityReport } from './src/quality/imageQuality';
import { checkContainsFace, type FaceCheckResult } from './src/vision/faceCheck';
import { checkNationalityMatch, type NationalityCheckResult } from './src/vision/nationalityCheck';
import type {
  CaptureMode,
  CapturedPhoto,
  CapturedSide,
  DocumentType,
  Nationality,
  SavedDocument,
} from './src/types';

const NATIONALITY_STORAGE_KEY = 'nextarp.nationality.v1';

// The back side of a driving licence/passport never has a face photo (so
// BackSideScreen doesn't run a face check at all - see its own comments) and,
// on several real documents (e.g. Turkish and Spanish driving licences), no
// printed country name either - it's mostly a table of vehicle category
// codes. Running the nationality/OCR check against the back side always
// produced a false "Doesn't match <country>" warning, even for a correctly
// scanned document, so BackSideScreen gets this "not applicable here" skipped
// result instead of actually running the OCR check.
const SKIPPED_NATIONALITY_CHECK: NationalityCheckResult = {
  matchesSelected: true,
  checkAvailable: false,
};

type Flow =
  | { screen: 'home' }
  // The transitional "opening scanner" screen is only shown for the front
  // side - back-side capture happens in place on BackSideScreen (its own
  // "Capture back side" button shows a loading spinner instead).
  | { screen: 'scanning'; documentType: DocumentType }
  | {
      screen: 'review';
      documentType: DocumentType;
      photo: CapturedPhoto;
      quality: QualityReport;
      faceCheck: FaceCheckResult;
      nationalityCheck: NationalityCheckResult;
    }
  | {
      screen: 'backSide';
      documentType: DocumentType;
      /** Undefined until the user taps "Capture back side". */
      photo?: CapturedPhoto;
      quality?: QualityReport;
      nationalityCheck?: NationalityCheckResult;
    }
  | {
      screen: 'success';
      documentId: string;
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
  // Loading state for BackSideScreen's "Capture back side" button - unlike
  // the front side, back-side capture doesn't navigate through the
  // transitional ScanningScreen, it just shows a spinner in place.
  const [capturingBack, setCapturingBack] = useState(false);
  // Which document (if any) is open in the full front+back "PDF style"
  // viewer within the Documents tab. Cleared whenever the user leaves that
  // tab so switching tabs and back doesn't leave a stale detail view open.
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  // App-wide nationality setting, chosen from the small flag icon in the
  // Home header (see NationalitySheet) rather than a mandatory full-screen
  // step before every scan. Persisted so it's remembered next launch.
  const [nationality, setNationality] = useState<Nationality>('ES');
  // Guards against starting a scan before the persisted nationality
  // preference has actually finished loading from AsyncStorage - without
  // this, a scan started in the brief window right after app launch could
  // silently run (and save) against the 'ES' fallback above instead of
  // whatever the user last chose (e.g. 'TR'), even though the flag chip
  // on Home would shortly afterwards flip to show the correct one.
  const [nationalityLoaded, setNationalityLoaded] = useState(false);
  const [nationalityPickerVisible, setNationalityPickerVisible] = useState(false);
  const [documentTypePickerVisible, setDocumentTypePickerVisible] = useState(false);

  // Accumulates sides + folder path across a single document's capture session.
  const [sessionSides, setSessionSides] = useState<CapturedSide[]>([]);
  const [sessionFolderPath, setSessionFolderPath] = useState<string | undefined>();

  const refreshDocuments = useCallback(() => {
    getSavedDocuments().then(setDocuments);
  }, []);

  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId) ?? null;

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    AsyncStorage.getItem(NATIONALITY_STORAGE_KEY)
      .then(stored => {
        if (stored === 'ES' || stored === 'TR') {
          setNationality(stored);
        }
      })
      .finally(() => setNationalityLoaded(true));
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

  /** Home row taps and "View all" both take the user to the Documents tab
   * (list view, not a specific document's detail screen). */
  const handleOpenDocumentsTab = useCallback(() => {
    setSelectedDocumentId(null);
    setActiveTab('documents');
  }, []);

  /** Tapping a row inside the Documents tab opens that document's full
   * front+back "PDF style" viewer. */
  const handleOpenDocument = useCallback((id: string) => {
    setSelectedDocumentId(id);
  }, []);

  const handleChangeTab = useCallback((tab: TabKey) => {
    if (tab !== 'documents') {
      setSelectedDocumentId(null);
    }
    setActiveTab(tab);
  }, []);

  /** Deletes a document's storage record and on-disk photos. Used by the
   * Home screen's swipe-to-delete - since Documents and Home both render
   * from the same `documents` state, this removes it from both places. */
  const handleDeleteDocument = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id);
        setSelectedDocumentId(current => (current === id ? null : current));
        refreshDocuments();
      } catch (err) {
        console.warn('[NextarpSDK] Failed to delete document', err);
        Alert.alert('Delete failed', 'This document could not be deleted. Please try again.');
      }
    },
    [refreshDocuments],
  );

  /** Rename icon on DocumentDetailScreen - unlike the Success screen's naming
   * prompt, this stays on the detail screen afterwards rather than
   * navigating home. */
  const handleRenameDocument = useCallback(
    async (id: string, name: string) => {
      try {
        await renameDocument(id, name);
        refreshDocuments();
      } catch (err) {
        console.warn('[NextarpSDK] Failed to rename document', err);
        Alert.alert('Rename failed', 'This document could not be renamed. Please try again.');
      }
    },
    [refreshDocuments],
  );

  /** Launches the OS-native scanner (VisionKit/ML Kit) for the FRONT side,
   * then runs quality analysis + face-presence check (faceCheck.ts) +
   * nationality/country text check (nationalityCheck.ts) against the
   * currently selected nationality setting. Lands on the front Review
   * screen, whose Next button moves on to BackSideScreen. */
  const startFrontScan = useCallback(
    async (documentType: DocumentType) => {
      setFlow({ screen: 'scanning', documentType });
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
              { text: 'Try again', onPress: () => startFrontScan(documentType) },
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

        setFlow({ screen: 'review', documentType, photo, quality, faceCheck, nationalityCheck });
      } catch (err) {
        console.warn('[NextarpSDK] launchScanner failed', err);
        Alert.alert('Scanner error', 'Something went wrong opening the scanner.', [
          { text: 'Cancel', style: 'cancel', onPress: goHome },
          { text: 'Try again', onPress: () => startFrontScan(documentType) },
        ]);
      }
    },
    [goHome, nationality],
  );

  const openDocumentTypePicker = useCallback(() => {
    // See the nationalityLoaded comment above - don't let a scan start
    // until we know for sure which nationality preference is actually in
    // effect. In practice this resolves in a few milliseconds, so this
    // essentially never blocks a real tap.
    if (!nationalityLoaded) return;
    setDocumentTypePickerVisible(true);
  }, [nationalityLoaded]);

  const handleSelectDocumentType = useCallback(
    (documentType: DocumentType) => {
      setDocumentTypePickerVisible(false);
      setSessionSides([]);
      setSessionFolderPath(undefined);
      startFrontScan(documentType);
    },
    [startFrontScan],
  );

  const handleRetakeFront = useCallback(
    (documentType: DocumentType) => {
      startFrontScan(documentType);
    },
    [startFrontScan],
  );

  /** Front Review's Next button: persists the front photo to this
   * document's folder, then moves on to BackSideScreen (which starts out
   * with no photo yet, prompting the user to capture the back). */
  const handleContinueToBackSide = useCallback(
    async (documentType: DocumentType, photo: CapturedPhoto) => {
      setSaving(true);
      try {
        const { folderPath, side: savedSide } = await persistCapturedPhoto(
          documentType,
          'front',
          photo.path,
          photo.width,
          photo.height,
        );
        setSessionSides([savedSide]);
        setSessionFolderPath(folderPath);
        setFlow({ screen: 'backSide', documentType });
      } catch (err) {
        console.warn('[NextarpSDK] Failed to save the front side', err);
        Alert.alert(
          'Save failed',
          `The front side photo could not be saved.\n\n${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  /** BackSideScreen's "Capture back side" / Retake button. Runs in place
   * (no ScanningScreen transition) - only quality analysis runs here, since
   * the back of a driving licence/passport never has a face photo, and
   * several real backs (Turkish, Spanish driving licence) have no printed
   * country name either, so the nationality/OCR check is skipped (see
   * SKIPPED_NATIONALITY_CHECK above). */
  const handleCaptureBackSide = useCallback(async (documentType: DocumentType) => {
    setCapturingBack(true);
    try {
      const result = await launchScanner({ quality: 0.9 });

      if (result.didCancel) {
        return;
      }
      if (result.error || !result.images || result.images.length === 0) {
        Alert.alert(
          'Scanner error',
          result.errorMessage || 'The document scanner could not capture an image.',
        );
        return;
      }

      const image = result.images[0];
      const photo: CapturedPhoto = { path: image.uri, width: image.width, height: image.height };
      const quality = await analyzeImageQuality(image.uri, image.width, image.height, documentType);

      setFlow({
        screen: 'backSide',
        documentType,
        photo,
        quality,
        nationalityCheck: SKIPPED_NATIONALITY_CHECK,
      });
    } catch (err) {
      console.warn('[NextarpSDK] launchScanner failed', err);
      Alert.alert('Scanner error', 'Something went wrong opening the scanner.');
    } finally {
      setCapturingBack(false);
    }
  }, []);

  /** BackSideScreen's Save button - persists the back photo, writes the
   * combined front+back document record to storage, and moves to Success. */
  const handleSaveBackSide = useCallback(
    async (documentType: DocumentType, photo: CapturedPhoto) => {
      setSaving(true);
      try {
        const { folderPath, side: savedSide } = await persistCapturedPhoto(
          documentType,
          'back',
          photo.path,
          photo.width,
          photo.height,
          sessionFolderPath,
        );

        const updatedSides = [...sessionSides, savedSide];
        const record = await saveDocumentRecord(documentType, folderPath, updatedSides, nationality);
        const afterSave = await getSavedDocuments();
        console.log(
          `[NextarpSDK] saved document record - ${afterSave.length} total documents now in storage`,
        );
        refreshDocuments();
        setFlow({
          screen: 'success',
          documentId: record.id,
          documentType,
          folderPath,
          sides: updatedSides,
          nationality,
        });
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
    [sessionSides, sessionFolderPath, nationality, refreshDocuments],
  );

  /** Success screen's naming prompt - the document is already saved with the
   * default label by this point, so this just renames that record (which is
   * why it shows up wherever `label` is rendered - Home's Recent scans and
   * the Documents tab both read from the same saved `documents` state). */
  const handleSaveWithName = useCallback(
    async (documentId: string, name: string) => {
      try {
        await renameDocument(documentId, name);
        refreshDocuments();
      } catch (err) {
        console.warn('[NextarpSDK] Failed to rename document', err);
      }
      goHome();
    },
    [refreshDocuments, goHome],
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
                    onViewAllDocuments={handleOpenDocumentsTab}
                    onDeleteDocument={handleDeleteDocument}
                    nationality={nationality}
                    onPressNationality={() => setNationalityPickerVisible(true)}
                  />
                )}
                {activeTab === 'documents' &&
                  (selectedDocument ? (
                    <DocumentDetailScreen
                      document={selectedDocument}
                      onBack={() => setSelectedDocumentId(null)}
                      onRename={name => handleRenameDocument(selectedDocument.id, name)}
                    />
                  ) : (
                    <DocumentsScreen documents={documents} onOpenDocument={handleOpenDocument} />
                  ))}
                {activeTab === 'settings' && (
                  <SettingsScreen documentCount={documents.length} onDataCleared={refreshDocuments} />
                )}
              </View>
              <BottomTabBar active={activeTab} onChange={handleChangeTab} />
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
            <ScanningScreen documentType={flow.documentType} side="front" />
          )}

          {flow.screen === 'review' && (
            <ReviewScreen
              documentType={flow.documentType}
              photoPath={flow.photo.path}
              photoWidth={flow.photo.width}
              photoHeight={flow.photo.height}
              quality={flow.quality}
              faceCheck={flow.faceCheck}
              nationalityCheck={flow.nationalityCheck}
              nationality={nationality}
              saving={saving}
              onBack={goHome}
              onRetake={() => handleRetakeFront(flow.documentType)}
              onNext={() => handleContinueToBackSide(flow.documentType, flow.photo)}
            />
          )}

          {flow.screen === 'backSide' && (
            <BackSideScreen
              documentType={flow.documentType}
              nationality={nationality}
              photo={flow.photo}
              quality={flow.quality}
              nationalityCheck={flow.nationalityCheck}
              capturing={capturingBack}
              saving={saving}
              onBack={goHome}
              onCapture={() => handleCaptureBackSide(flow.documentType)}
              onRetake={() => handleCaptureBackSide(flow.documentType)}
              onSave={() => handleSaveBackSide(flow.documentType, flow.photo!)}
            />
          )}

          {flow.screen === 'success' && (
            <SuccessScreen
              documentType={flow.documentType}
              folderPath={flow.folderPath}
              sides={flow.sides}
              nationality={flow.nationality}
              onSaveWithName={name => handleSaveWithName(flow.documentId, name)}
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
