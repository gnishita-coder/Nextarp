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
 * 3. FINAL DECISION: capture uses app-owned SinglePageScanner (one photo +
 *    auto-crop). Android: ML Kit with pageLimit=1. iOS: camera + Vision crop.
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchSinglePageScanner } from './src/scanner';
import { requestCameraPermission } from './src/permissions/cameraPermission';

import { HomeScreen } from './src/screens/HomeScreen';
import { DocumentsScreen } from './src/screens/DocumentsScreen';
import { DocumentDetailScreen } from './src/screens/DocumentDetailScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { DocumentFlipScreen } from './src/screens/DocumentFlipScreen';
import { BackSideScreen } from './src/screens/BackSideScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { ScanningScreen } from './src/screens/ScanningScreen';
import { DocumentTypeSheet } from './src/components/DocumentTypeSheet';
import { NationalitySheet } from './src/components/NationalitySheet';
import { BottomTabBar, type TabKey } from './src/components/BottomTabBar';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LoadingOverlay } from './src/components/LoadingOverlay';
import { WhiteBackgroundWarningModal } from './src/components/WhiteBackgroundWarningModal';
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
import { NATIONALITIES } from './src/types';

const NATIONALITY_STORAGE_KEY = 'nextarp.nationality.v1';
/** Fixed duration the "Preparing scanner" screen stays visible after nationality selection. */
const SCANNER_PREPARATION_DURATION_MS = 4000;
/**
 * Android stuck-scan tip is shown natively over ML Kit after 5s (see
 * SinglePageScannerModule). If the user cancels before that fires but
 * after this long, show the RN modal once as a fallback.
 */
const SCAN_CANCEL_HINT_MS = 5_000;
const allowLoadingOverlayToRender = () =>
  new Promise<void>(resolve => setTimeout(resolve, 180));

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
  | {
      screen: 'review';
      documentType: DocumentType;
      photo: CapturedPhoto;
      quality: QualityReport;
      faceCheck: FaceCheckResult;
      nationalityCheck: NationalityCheckResult;
    }
  | {
      /** Front validated + saved — cue user to flip before back capture. */
      screen: 'flip';
      documentType: DocumentType;
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

type ReviewFlow = Extract<Flow, { screen: 'review' }>;

type DocumentDetailOrigin = 'home' | 'documents';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  // Kept for the Home screen's Automatic/Manual tiles (matches the mockup),
  // but no longer changes capture behavior - the OS-native scanner has its
  // own built-in automatic-alignment + manual-shutter UX that we don't
  // control. See deviation #3 in the header comment above.
  const [captureMode, setCaptureMode] = useState<CaptureMode>('automatic');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [flow, setFlow] = useState<Flow>({ screen: 'home' });
  const [frontReviewFlow, setFrontReviewFlow] = useState<ReviewFlow | null>(null);
  const [saving, setSaving] = useState(false);
  // Loading state for BackSideScreen's "Capture back side" button - unlike
  // the front side, back-side capture doesn't navigate through the
  // transitional ScanningScreen, it just shows a spinner in place.
  const [capturingBack, setCapturingBack] = useState(false);
  // Visibility + retake handler for the on-brand "Use a dark background"
  // modal shown when a captured scan's average brightness suggests it was
  // taken against a white surface. The retake handler is stashed on the
  // state so tapping Retake can immediately reopen the correct scanner
  // (front vs. back), avoiding a stale closure captured earlier.
  const [whiteBackgroundWarning, setWhiteBackgroundWarning] = useState<{
    onRetake: () => void;
  } | null>(null);
  const [preparingScan, setPreparingScan] = useState<{
    documentType: DocumentType;
    side: 'front' | 'back';
  } | null>(null);
  // Which document (if any) is open in the full front+back "PDF style"
  // viewer within the Documents tab. Cleared whenever the user leaves that
  // tab so switching tabs and back doesn't leave a stale detail view open.
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentDetailOrigin, setDocumentDetailOrigin] = useState<DocumentDetailOrigin | null>(
    null,
  );

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
  const [pendingDocumentType, setPendingDocumentType] = useState<DocumentType | null>(null);
  const nationalityTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerPreparationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannerLaunchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Accumulates sides + folder path across a single document's capture session.
  const [sessionSides, setSessionSides] = useState<CapturedSide[]>([]);
  const [sessionFolderPath, setSessionFolderPath] = useState<string | undefined>();

  const refreshDocuments = useCallback(async () => {
    try {
      const savedDocuments = await getSavedDocuments();
      setDocuments(savedDocuments);
    } finally {
      setDocumentsLoaded(true);
    }
  }, []);

  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId) ?? null;

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    requestCameraPermission().catch(err => {
      console.warn('[NextarpSDK] Camera permission request failed', err);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(NATIONALITY_STORAGE_KEY)
      .then(stored => {
        if (NATIONALITIES.includes(stored as Nationality)) {
          setNationality(stored as Nationality);
        }
      })
      .finally(() => setNationalityLoaded(true));
  }, []);

  const persistNationalitySelection = useCallback((next: Nationality) => {
    setNationality(next);
    AsyncStorage.setItem(NATIONALITY_STORAGE_KEY, next).catch(() => {
      /* non-critical - just means the choice won't be remembered next launch */
    });
  }, []);

  const clearPendingScanTimers = useCallback(() => {
    if (nationalityTransitionTimer.current) clearTimeout(nationalityTransitionTimer.current);
    if (scannerPreparationTimer.current) clearTimeout(scannerPreparationTimer.current);
    if (scannerLaunchTimer.current) clearTimeout(scannerLaunchTimer.current);
    nationalityTransitionTimer.current = null;
    scannerPreparationTimer.current = null;
    scannerLaunchTimer.current = null;
  }, []);

  useEffect(() => clearPendingScanTimers, [clearPendingScanTimers]);

  const goHome = useCallback(() => {
    clearPendingScanTimers();
    setSessionSides([]);
    setSessionFolderPath(undefined);
    setFrontReviewFlow(null);
    setPreparingScan(null);
    setPendingDocumentType(null);
    setDocumentTypePickerVisible(false);
    setNationalityPickerVisible(false);
    setOperationLoading(null);
    setWhiteBackgroundWarning(null);
    setActiveTab('home');
    setSelectedDocumentId(null);
    setDocumentDetailOrigin(null);
    setFlow({ screen: 'home' });
  }, [clearPendingScanTimers]);

  const handleCloseDocumentDetail = useCallback(() => {
    setSelectedDocumentId(null);
    setDocumentDetailOrigin(null);
  }, []);

  /** "View all" on Home - opens the Documents tab list (not a specific document). */
  const handleOpenDocumentsTab = useCallback(() => {
    setSelectedDocumentId(null);
    setDocumentDetailOrigin(null);
    setActiveTab('documents');
  }, []);

  /** Recent-scan row on Home - opens the document detail viewer, back returns to Home. */
  const handleOpenDocumentFromHome = useCallback((id: string) => {
    setDocumentDetailOrigin('home');
    setSelectedDocumentId(id);
    setActiveTab('home');
  }, []);

  /** Row tap in Documents tab - opens detail viewer, back returns to the list. */
  const handleOpenDocument = useCallback((id: string) => {
    setDocumentDetailOrigin('documents');
    setSelectedDocumentId(id);
    setActiveTab('documents');
  }, []);

  const handleChangeTab = useCallback((tab: TabKey) => {
    setSelectedDocumentId(null);
    setDocumentDetailOrigin(null);
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // Flow screens own their back behavior so their local popups can close first.
      if (flow.screen !== 'home') return false;

      if (pendingDocumentType && operationLoading) {
        clearPendingScanTimers();
        setPendingDocumentType(null);
        setOperationLoading(null);
        return true;
      }
      if (preparingScan) {
        clearPendingScanTimers();
        setPreparingScan(null);
        return true;
      }
      if (operationLoading || saving || capturingBack) {
        return true;
      }
      if (selectedDocumentId) {
        handleCloseDocumentDetail();
        return true;
      }
      if (activeTab !== 'home') {
        setSelectedDocumentId(null);
        setActiveTab('home');
        return true;
      }

      // Returning false on the root Home screen lets Android close the app.
      return false;
    });
    return () => subscription.remove();
  }, [
    activeTab,
    capturingBack,
    clearPendingScanTimers,
    flow.screen,
    operationLoading,
    pendingDocumentType,
    preparingScan,
    saving,
    selectedDocumentId,
    handleCloseDocumentDetail,
  ]);

  /** Confirms destructive deletion before removing both metadata and photos. */
  const handleDeleteDocument = useCallback(
    (id: string) => {
      const target = documents.find(document => document.id === id);
      Alert.alert(
        'Delete document?',
        `Are you sure you want to delete “${target?.label ?? 'this document'}”? This removes both captured sides and cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setOperationLoading('Deleting document…');
              try {
                await deleteDocument(id);
                setSelectedDocumentId(current => {
                  if (current === id) {
                    setDocumentDetailOrigin(null);
                  }
                  return current === id ? null : current;
                });
                await refreshDocuments();
              } catch (err) {
                console.warn('[NextarpSDK] Failed to delete document', err);
                Alert.alert('Delete failed', 'This document could not be deleted. Please try again.');
              } finally {
                setOperationLoading(null);
              }
            },
          },
        ],
      );
    },
    [documents, refreshDocuments],
  );

  /** Rename icon on DocumentDetailScreen - unlike the Success screen's naming
   * prompt, this stays on the detail screen afterwards rather than
   * navigating home. */
  const handleRenameDocument = useCallback(
    async (id: string, name: string) => {
      setOperationLoading('Updating document…');
      try {
        await renameDocument(id, name);
        await refreshDocuments();
      } catch (err) {
        console.warn('[NextarpSDK] Failed to rename document', err);
        Alert.alert('Rename failed', 'This document could not be renamed. Please try again.');
      } finally {
        setOperationLoading(null);
      }
    },
    [refreshDocuments],
  );

  /** Launches the OS-native scanner (VisionKit/ML Kit) for the FRONT side,
   * then runs quality analysis + face-presence check (faceCheck.ts) +
   * nationality/country text check (nationalityCheck.ts) against the
   * currently selected nationality setting. Lands on the front Review
   * screen, whose Next button moves on to BackSideScreen.
   *
   * IMPORTANT (iOS): do NOT navigate to a loading screen before opening the
   * camera. Presenting the native picker while a full-screen RN view has
   * just replaced the Home tab can hang. Open the scanner in place from
   * Home / Review instead. */
  const startFrontScan = useCallback(
    async (
      documentType: DocumentType,
      options?: {
        stayOnCancel?: boolean;
        nationality?: Nationality;
        /** After native tip + Retake: reopen once without showing tip again. */
        skipStuckWarning?: boolean;
      },
    ) => {
      try {
        setOperationLoading('Opening scanner…');
        await allowLoadingOverlayToRender();
        const result = await launchSinglePageScanner({
          documentType,
          side: 'front',
          captureMode,
          skipStuckWarning: options?.skipStuckWarning,
        });

        if (result.scanTimedOut) {
          // Native "Use a dark background" overlay was already shown over
          // ML Kit and the user tapped Retake. Do NOT show the RN modal
          // again (double-popup), and reopen with skipStuckWarning so the
          // tip does not loop on the immediate retake.
          setOperationLoading(null);
          setPreparingScan(null);
          setWhiteBackgroundWarning(null);
          setTimeout(() => {
            startFrontScan(documentType, {
              ...options,
              stayOnCancel: true,
              skipStuckWarning: true,
            });
          }, 300);
          return;
        }

        if (result.didCancel) {
          setOperationLoading(null);
          // Fallback: user closed ML Kit after a long hang before the
          // native overlay fired (or on a path that skipped it).
          const elapsed = result.elapsedMs ?? 0;
          if (
            Platform.OS === 'android' &&
            !options?.skipStuckWarning &&
            elapsed >= SCAN_CANCEL_HINT_MS
          ) {
            setWhiteBackgroundWarning({
              onRetake: () => {
                setWhiteBackgroundWarning(null);
                startFrontScan(documentType, {
                  ...options,
                  stayOnCancel: true,
                  skipStuckWarning: true,
                });
              },
            });
            return;
          }
          if (!options?.stayOnCancel) {
            goHome();
          }
          return;
        }
        if (result.error || !result.image) {
          setOperationLoading(null);
          Alert.alert(
            'Scanner error',
            result.errorMessage || 'The document scanner could not capture an image.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => {
                  if (!options?.stayOnCancel) {
                    goHome();
                  }
                },
              },
              { text: 'Try again', onPress: () => startFrontScan(documentType, options) },
            ],
          );
          return;
        }

        const image = result.image;

        setOperationLoading('Checking captured image…');
        // Let the native scanner dismiss and paint the loading overlay before
        // JPEG decoding and quality analysis perform CPU-heavy work.
        await allowLoadingOverlayToRender();
        const [quality, faceCheck, nationalityCheck] = await Promise.all([
          analyzeImageQuality(image.uri, image.width, image.height, documentType),
          checkContainsFace(image.uri),
          checkNationalityMatch(image.uri, options?.nationality ?? nationality),
        ]);

        setOperationLoading(null);

        const photo: CapturedPhoto = {
          path: image.uri,
          width: quality.analyzedWidth || image.width,
          height: quality.analyzedHeight || image.height,
        };
        const reviewFlow: ReviewFlow = {
          screen: 'review',
          documentType,
          photo,
          quality,
          faceCheck,
          nationalityCheck,
        };
        setFrontReviewFlow(reviewFlow);
        setFlow(reviewFlow);
      } catch (err) {
        setOperationLoading(null);
        console.warn('[NextarpSDK] launchScanner failed', err);
        Alert.alert('Scanner error', 'Something went wrong opening the scanner.', [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              if (!options?.stayOnCancel) {
                goHome();
              }
            },
          },
          { text: 'Try again', onPress: () => startFrontScan(documentType, options) },
        ]);
      }
    },
    [captureMode, goHome, nationality],
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
      setFrontReviewFlow(null);
      setPendingDocumentType(documentType);
      setOperationLoading('Opening nationality selection…');
      // Wait for the full-screen document picker to finish dismissing before
      // presenting the nationality picker on top of the stable Home screen.
      nationalityTransitionTimer.current = setTimeout(
        () => {
          nationalityTransitionTimer.current = null;
          setOperationLoading(null);
          setNationalityPickerVisible(true);
        },
        Platform.OS === 'ios' ? 350 : 150,
      );
    },
    [],
  );

  const handleSelectNationality = useCallback(
    (next: Nationality) => {
      persistNationalitySelection(next);
      setNationalityPickerVisible(false);
      if (!pendingDocumentType) return;

      const documentType = pendingDocumentType;
      setPendingDocumentType(null);
      setPreparingScan({ documentType, side: 'front' });
      // Keep Home mounted underneath this lightweight preparation overlay.
      // Show it for a fixed 4 s after nationality selection, then remove it
      // before presenting the native scanner so iOS always presents from a
      // stable React root after the nationality picker dismisses.
      scannerPreparationTimer.current = setTimeout(() => {
        scannerPreparationTimer.current = null;
        setPreparingScan(null);
        scannerLaunchTimer.current = setTimeout(
          () => {
            scannerLaunchTimer.current = null;
            startFrontScan(documentType, { nationality: next });
          },
          Platform.OS === 'ios' ? 120 : 40,
        );
      }, SCANNER_PREPARATION_DURATION_MS);
    },
    [pendingDocumentType, persistNationalitySelection, startFrontScan],
  );

  const handleRetakeFront = useCallback(
    (documentType: DocumentType) => {
      startFrontScan(documentType, { stayOnCancel: true });
    },
    [startFrontScan],
  );

  /** Front Review's Next button: persists the front photo, then shows the
   * flip cue. Back camera opens only after the user continues from Flip. */
  const handleContinueToBackSide = useCallback(
    async (documentType: DocumentType, photo: CapturedPhoto) => {
      if (sessionFolderPath && sessionSides.some(side => side.side === 'front')) {
        setFlow({ screen: 'flip', documentType });
        return;
      }
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
        setFlow({ screen: 'flip', documentType });
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
    [sessionFolderPath, sessionSides],
  );

  /** BackSideScreen's "Capture back side" / Retake button. Runs in place
   * (no ScanningScreen transition) - only quality analysis runs here, since
   * the back of a driving licence/passport never has a face photo, and
   * several real backs (Turkish, Spanish driving licence) have no printed
   * country name either, so the nationality/OCR check is skipped (see
   * SKIPPED_NATIONALITY_CHECK above). */
  const handleCaptureBackSide = useCallback(async (
    documentType: DocumentType,
    options?: { skipStuckWarning?: boolean },
  ) => {
    setCapturingBack(true);
    try {
      await allowLoadingOverlayToRender();
      const result = await launchSinglePageScanner({
        documentType,
        side: 'back',
        captureMode,
        skipStuckWarning: options?.skipStuckWarning,
      });

      if (result.scanTimedOut) {
        // Native tip already handled Retake — reopen once without a
        // second RN modal / tip loop.
        setTimeout(
          () => handleCaptureBackSide(documentType, { skipStuckWarning: true }),
          300,
        );
        return;
      }

      if (result.didCancel) {
        const elapsed = result.elapsedMs ?? 0;
        if (
          Platform.OS === 'android' &&
          !options?.skipStuckWarning &&
          elapsed >= SCAN_CANCEL_HINT_MS
        ) {
          setWhiteBackgroundWarning({
            onRetake: () => {
              setWhiteBackgroundWarning(null);
              setTimeout(
                () => handleCaptureBackSide(documentType, { skipStuckWarning: true }),
                0,
              );
            },
          });
        }
        return;
      }
      if (result.error || !result.image) {
        Alert.alert(
          'Scanner error',
          result.errorMessage || 'The document scanner could not capture an image.',
        );
        return;
      }

      const image = result.image;
      await allowLoadingOverlayToRender();
      const quality = await analyzeImageQuality(image.uri, image.width, image.height, documentType);
      const photo: CapturedPhoto = {
        path: image.uri,
        width: quality.analyzedWidth || image.width,
        height: quality.analyzedHeight || image.height,
      };

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
  }, [captureMode]);

  /** Flip screen CTA: open the back camera immediately from Flip.
   * Do not show the empty BackSide "Capture back side" prompt first.
   * After a successful capture we land on BackSide for review; on cancel
   * we stay on Flip so the user can try again. */
  const handleFlipContinue = useCallback(
    (documentType: DocumentType) => {
      handleCaptureBackSide(documentType);
    },
    [handleCaptureBackSide],
  );

  /** BackSideScreen's Save button - persists the back photo, writes the
   * combined front+back document record to storage, and moves to Success. */
  const handleSaveBackSide = useCallback(
    async (documentType: DocumentType, photo: CapturedPhoto) => {
      const hasFront = sessionSides.some(side => side.side === 'front');
      if (!hasFront) {
        Alert.alert(
          'Front side missing',
          'Please capture and confirm the front side before saving the back side.',
        );
        return;
      }

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
        if (
          !updatedSides.some(side => side.side === 'front') ||
          !updatedSides.some(side => side.side === 'back')
        ) {
          Alert.alert(
            'Incomplete scan',
            'Both front and back sides are required before this document can be saved.',
          );
          return;
        }

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
      setOperationLoading('Saving document…');
      try {
        await renameDocument(documentId, name);
        await refreshDocuments();
      } catch (err) {
        console.warn('[NextarpSDK] Failed to rename document', err);
      } finally {
        setOperationLoading(null);
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
                {activeTab === 'home' &&
                  (selectedDocument && documentDetailOrigin === 'home' ? (
                    <DocumentDetailScreen
                      document={selectedDocument}
                      onBack={handleCloseDocumentDetail}
                      onRename={name => handleRenameDocument(selectedDocument.id, name)}
                    />
                  ) : (
                    <HomeScreen
                      documents={documents}
                      captureMode={captureMode}
                      onChangeCaptureMode={setCaptureMode}
                      onRequestScan={openDocumentTypePicker}
                      onViewAllDocuments={handleOpenDocumentsTab}
                      onOpenDocument={handleOpenDocumentFromHome}
                      onDeleteDocument={handleDeleteDocument}
                      nationality={nationality}
                      onPressNationality={() => setNationalityPickerVisible(true)}
                    />
                  ))}
                {activeTab === 'documents' &&
                  (selectedDocument && documentDetailOrigin === 'documents' ? (
                    <DocumentDetailScreen
                      document={selectedDocument}
                      onBack={handleCloseDocumentDetail}
                      onRename={name => handleRenameDocument(selectedDocument.id, name)}
                    />
                  ) : (
                    <DocumentsScreen
                      documents={documents}
                      onOpenDocument={handleOpenDocument}
                      onDeleteDocument={handleDeleteDocument}
                    />
                  ))}
                {activeTab === 'settings' && (
                  <SettingsScreen documentCount={documents.length} />
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
            onClose={() => {
              setNationalityPickerVisible(false);
              if (pendingDocumentType) {
                setPendingDocumentType(null);
                nationalityTransitionTimer.current = setTimeout(() => {
                  nationalityTransitionTimer.current = null;
                  setDocumentTypePickerVisible(true);
                }, Platform.OS === 'ios' ? 300 : 120);
              }
            }}
          />

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
              onChangeCountry={() => {
                goHome();
                setTimeout(() => setNationalityPickerVisible(true), 100);
              }}
              onNext={() => handleContinueToBackSide(flow.documentType, flow.photo)}
            />
          )}

          {flow.screen === 'flip' && (
            <DocumentFlipScreen
              documentType={flow.documentType}
              onBack={() => {
                if (frontReviewFlow) {
                  setFlow(frontReviewFlow);
                } else {
                  goHome();
                }
              }}
              onContinue={() => handleFlipContinue(flow.documentType)}
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
              onBack={() => {
                if (frontReviewFlow) {
                  setFlow(frontReviewFlow);
                } else {
                  goHome();
                }
              }}
              onCapture={() => handleCaptureBackSide(flow.documentType)}
              onRetake={() => handleCaptureBackSide(flow.documentType)}
              onSave={() => handleSaveBackSide(flow.documentType, flow.photo!)}
            />
          )}

          {flow.screen === 'success' && (
            <SuccessScreen
              documentType={flow.documentType}
              sides={flow.sides}
              nationality={flow.nationality}
              onSaveWithName={name => handleSaveWithName(flow.documentId, name)}
              onScanAnother={() => {
                goHome();
                openDocumentTypePicker();
              }}
              onOpenDocument={() => {
                const documentId = flow.documentId;
                goHome();
                setDocumentDetailOrigin('documents');
                setSelectedDocumentId(documentId);
                setActiveTab('documents');
              }}
              onDone={goHome}
            />
          )}

          {preparingScan && (
            <View style={styles.preparingOverlay}>
              <ScanningScreen
                documentType={preparingScan.documentType}
                side={preparingScan.side}
              />
            </View>
          )}

          <LoadingOverlay
            visible={
              !documentsLoaded ||
              !nationalityLoaded ||
              operationLoading != null ||
              saving ||
              capturingBack
            }
            title={
              !documentsLoaded || !nationalityLoaded
                ? 'Loading your vault'
                : operationLoading
                  ? 'Please wait'
                  : capturingBack
                    ? 'Processing scan'
                    : 'Saving document'
            }
            message={
              operationLoading ??
              (capturingBack
                ? 'Checking the captured image…'
                : saving
                  ? 'Securing your document on this device…'
                  : 'Loading your saved documents and preferences…')
            }
          />

          <WhiteBackgroundWarningModal
            visible={whiteBackgroundWarning != null}
            onRetake={() => whiteBackgroundWarning?.onRetake()}
          />
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
  preparingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});

export default App;
