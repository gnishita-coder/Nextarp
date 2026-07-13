// Unused - kept as an inert stub file (can't be deleted in this sandbox
// environment). This wrapped a native OpenCV post-capture crop module
// (DocumentCropModule) that was tried while camera-kit was the active
// capture library. It's no longer needed: capture now uses
// @dariyd/react-native-document-scanner (VisionKit / ML Kit), which does
// its own, more accurate native document detection + perspective correction
// - see App.tsx's header comment for the full history. Nothing imports this
// file anymore.
export {};
