package com.nextarpsdk.scanner

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.nextarpsdk.MainActivity
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Single-page capture only.
 *
 * ML Kit auto-detects the document edge and crops it. pageLimit is hard-coded
 * to 1 so the OS never offers "add another page" / "ready for next scan".
 *
 * Stuck-scan handling (white / low-contrast backgrounds):
 * After [STUCK_SCAN_TIMEOUT_MS] with no capture we present
 * [WhiteBackgroundWarningActivity] on top of ML Kit once. Retake clears the
 * scanner stack and resolves with scanTimedOut=true. The immediate JS retake
 * can pass skipStuckWarning so the tip does not loop.
 *
 * A successful ML Kit capture always wins: the warning is dismissed quietly
 * and the image is returned (no false timeout on a slow-but-valid dark scan).
 */
class SinglePageScannerModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var scanPromise: Promise? = null
  private var scanStartedAtMs: Long = 0L
  private var warningShown = false
  private var skipStuckWarning = false
  private val mainHandler = Handler(Looper.getMainLooper())
  private val stuckScanTimeoutRunnable = Runnable {
    if (scanPromise == null || warningShown || skipStuckWarning) return@Runnable
    Log.w(NAME, "Scan still open after ${STUCK_SCAN_TIMEOUT_MS}ms — showing dark-background warning")
    warningShown = true
    WhiteBackgroundWarningActivity.onRetake = {
      val activity = reactApplicationContext.currentActivity
      if (activity != null) {
        resolveTimedOut(activity)
      } else {
        resolveTimedOutWithoutActivity()
      }
    }
    try {
      val intent =
        Intent(reactApplicationContext, WhiteBackgroundWarningActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
      reactApplicationContext.startActivity(intent)
    } catch (e: Exception) {
      Log.e(NAME, "Could not present white-background warning", e)
      warningShown = false
      WhiteBackgroundWarningActivity.onRetake = null
      val activity = reactApplicationContext.currentActivity
      if (activity != null) resolveTimedOut(activity) else resolveTimedOutWithoutActivity()
    }
  }

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode == SCAN_REQUEST_CODE) {
          handleScanResult(resultCode, data)
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun launch(
    options: ReadableMap,
    promise: Promise,
  ) {
    val requestedMode =
      if (options.hasKey("captureMode")) options.getString("captureMode") else "automatic"
    val requestedSide = if (options.hasKey("side")) options.getString("side") else "front"
    skipStuckWarning =
      options.hasKey("skipStuckWarning") && options.getBoolean("skipStuckWarning")
    Log.d(NAME, "Opening $requestedSide scan ($requestedMode, skipStuckWarning=$skipStuckWarning)")

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity doesn't exist")
      return
    }
    if (scanPromise != null) {
      promise.reject("IN_PROGRESS", "A scan is already in progress")
      return
    }

    scanPromise = promise
    warningShown = false
    scanStartedAtMs = System.currentTimeMillis()

    val scannerOptions =
      GmsDocumentScannerOptions.Builder()
        .setGalleryImportAllowed(false)
        .setPageLimit(1)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()

    GmsDocumentScanning.getClient(scannerOptions)
      .getStartScanIntent(activity)
      .addOnSuccessListener { intentSender ->
        try {
          activity.startIntentSenderForResult(
            intentSender,
            SCAN_REQUEST_CODE,
            null,
            0,
            0,
            0,
          )
          mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
          if (!skipStuckWarning) {
            mainHandler.postDelayed(stuckScanTimeoutRunnable, STUCK_SCAN_TIMEOUT_MS)
          }
        } catch (e: Exception) {
          mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
          scanPromise = null
          promise.reject("SCAN_START", e.message, e)
        }
      }
      .addOnFailureListener { e ->
        mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
        scanPromise = null
        promise.reject("SCAN_START", e.message, e)
      }
  }

  private fun resolveTimedOut(activity: Activity) {
    mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
    WhiteBackgroundWarningActivity.onRetake = null
    WhiteBackgroundWarningActivity.dismissQuietly()
    val promise = scanPromise
    scanPromise = null
    warningShown = false
    val elapsedMs =
      (System.currentTimeMillis() - scanStartedAtMs).coerceAtLeast(STUCK_SCAN_TIMEOUT_MS)

    // MainActivity is singleTask — CLEAR_TOP removes ML Kit (+ warning) above it.
    try {
      val home =
        Intent(activity, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
      activity.startActivity(home)
    } catch (e: Exception) {
      Log.e(NAME, "Could not return to MainActivity after timeout", e)
      try {
        @Suppress("DEPRECATION")
        activity.finishActivity(SCAN_REQUEST_CODE)
      } catch (_: Exception) {
      }
    }

    if (promise != null) {
      val response = WritableNativeMap()
      response.putBoolean("scanTimedOut", true)
      response.putDouble("elapsedMs", elapsedMs.toDouble())
      promise.resolve(response)
    }
  }

  private fun resolveTimedOutWithoutActivity() {
    mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
    WhiteBackgroundWarningActivity.onRetake = null
    WhiteBackgroundWarningActivity.dismissQuietly()
    val promise = scanPromise ?: return
    scanPromise = null
    warningShown = false
    val response = WritableNativeMap()
    response.putBoolean("scanTimedOut", true)
    response.putDouble("elapsedMs", STUCK_SCAN_TIMEOUT_MS.toDouble())
    promise.resolve(response)
  }

  private fun handleScanResult(resultCode: Int, data: Intent?) {
    // Warning / Retake path may already have resolved the promise.
    val promise = scanPromise ?: return
    scanPromise = null
    mainHandler.removeCallbacks(stuckScanTimeoutRunnable)
    WhiteBackgroundWarningActivity.onRetake = null
    // Successful (or cancelled) capture while the tip is visible: drop it
    // quietly so we never leave a stale overlay above MainActivity.
    WhiteBackgroundWarningActivity.dismissQuietly()
    val elapsedMs = (System.currentTimeMillis() - scanStartedAtMs).coerceAtLeast(0L)
    warningShown = false

    if (resultCode == Activity.RESULT_CANCELED) {
      val cancelled = WritableNativeMap()
      cancelled.putBoolean("didCancel", true)
      cancelled.putDouble("elapsedMs", elapsedMs.toDouble())
      promise.resolve(cancelled)
      return
    }

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise.reject("SCAN_FAILED", "Document scan failed")
      return
    }

    try {
      val result = GmsDocumentScanningResult.fromActivityResultIntent(data)
      val pages = result?.pages
      if (pages.isNullOrEmpty()) {
        promise.reject("SCAN_EMPTY", "No page was captured")
        return
      }

      val imageMap = copyToCache(pages.first().imageUri) ?: run {
        promise.reject("SCAN_COPY", "Could not save the scanned image")
        return
      }
      val response = WritableNativeMap()
      response.putMap("image", imageMap)
      response.putDouble("elapsedMs", elapsedMs.toDouble())
      promise.resolve(response)
    } catch (e: Exception) {
      Log.e(NAME, "Failed to handle scan result", e)
      promise.reject("SCAN_ERROR", e.message, e)
    }
  }

  private fun copyToCache(imageUri: Uri): WritableNativeMap? {
    val activity = reactApplicationContext.currentActivity ?: return null
    val input = activity.contentResolver.openInputStream(imageUri) ?: return null
    val bytes = input.readBytes()
    input.close()

    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val fileName = "${UUID.randomUUID()}.jpg"
    val outFile = File(activity.cacheDir, fileName)
    FileOutputStream(outFile).use { stream ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, 92, stream)
    }

    // Sample the bitmap on the native side for both whole-image and
    // border-only luma stats. Free at this point (~5ms) because the
    // bitmap is already decoded, and lets JS make the white-background
    // decision the moment this Promise resolves - no JS JPEG decode
    // required.
    //
    // Why two regions:
    // - WHOLE-IMAGE mean + variance catches the case where ML Kit
    //   couldn't crop at all and returned a mostly-uniform white
    //   frame.
    // - BORDER-ONLY mean + variance catches the more common case
    //   where ML Kit returned a LOOSE crop (edge detection was
    //   confused by a low-contrast white surface behind the card):
    //   the outer ~6% of the returned image is then the surface
    //   itself. If those border pixels are bright and uniform, we
    //   know we're looking at a white background regardless of what
    //   the card content in the middle looks like.
    // Both regions use the same 0.299R + 0.587G + 0.114B luma so
    // values are directly comparable across the two.
    val whole = sampleBrightnessStats(bitmap)
    val border = sampleBorderBrightnessStats(bitmap)
    val corners = sampleCornerBrightnessStats(bitmap)

    // The best "does this corner look like a white surface" score
    // across all four corners. Pass just the max mean + its
    // corresponding variance to JS: any single white-surface-looking
    // corner is enough to fire the modal. This is more robust than
    // full-border averaging when the crop has mixed background (e.g.
    // white surface on top, dark object at the bottom - averaging
    // hides the white top signal).
    var bestCornerIndex = 0
    for (i in corners.indices) {
      if (corners[i].mean > corners[bestCornerIndex].mean) bestCornerIndex = i
    }
    val bestCorner = corners[bestCornerIndex]

    val map = WritableNativeMap()
    map.putString("uri", Uri.fromFile(outFile).toString())
    map.putString("fileName", fileName)
    map.putString("type", "image/jpeg")
    map.putInt("width", bitmap.width)
    map.putInt("height", bitmap.height)
    map.putInt("fileSize", outFile.length().toInt())
    map.putDouble("brightness", whole.mean)
    map.putDouble("brightnessVariance", whole.variance)
    map.putDouble("borderBrightness", border.mean)
    map.putDouble("borderBrightnessVariance", border.variance)
    map.putDouble("brightestCornerBrightness", bestCorner.mean)
    map.putDouble("brightestCornerVariance", bestCorner.variance)
    bitmap.recycle()
    return map
  }

  private data class BrightnessStats(val mean: Double, val variance: Double)

  /**
   * Fast mean + variance of luma over the whole bitmap using a fixed
   * ~32x32 downsample grid. Same 0.299R + 0.587G + 0.114B formula used
   * by analyzeImageQuality in JS so the mean value is directly
   * comparable. Variance is in luma^2 units (0-255 luma -> variance up
   * to ~16000 in practice).
   */
  private fun sampleBrightnessStats(bitmap: Bitmap): BrightnessStats {
    val w = bitmap.width
    val h = bitmap.height
    if (w <= 0 || h <= 0) return BrightnessStats(0.0, 0.0)
    val gridSize = 32
    val stepX = maxOf(1, w / gridSize)
    val stepY = maxOf(1, h / gridSize)

    var sum = 0.0
    var sumSq = 0.0
    var count = 0
    var y = 0
    while (y < h) {
      var x = 0
      while (x < w) {
        val pixel = bitmap.getPixel(x, y)
        val r = (pixel shr 16) and 0xFF
        val g = (pixel shr 8) and 0xFF
        val b = pixel and 0xFF
        val luma = 0.299 * r + 0.587 * g + 0.114 * b
        sum += luma
        sumSq += luma * luma
        count++
        x += stepX
      }
      y += stepY
    }
    if (count <= 0) return BrightnessStats(0.0, 0.0)
    val mean = sum / count
    val variance = (sumSq / count) - (mean * mean)
    return BrightnessStats(mean, variance.coerceAtLeast(0.0))
  }

  /**
   * Mean + variance of luma for each of the four corner patches of the
   * image (top-left, top-right, bottom-left, bottom-right). Each
   * patch is an 8% x 8% square in the corner of the image.
   *
   * Why per-corner rather than full-border: real loose crops from ML
   * Kit often have MIXED background - e.g. white desk visible on top
   * and left, but a dark shadow / phone case / desk edge visible on
   * the bottom. Averaging over the entire border strip then produces
   * high variance and the check stays quiet even though the top-left
   * corner is clearly a white surface. Per-corner sampling isolates
   * each corner so a single "clean white surface" corner is enough
   * to fire the modal.
   *
   * Returns exactly 4 BrightnessStats in the order [TL, TR, BL, BR].
   */
  private fun sampleCornerBrightnessStats(bitmap: Bitmap): Array<BrightnessStats> {
    val w = bitmap.width
    val h = bitmap.height
    if (w <= 0 || h <= 0) {
      return Array(4) { BrightnessStats(0.0, 0.0) }
    }
    val patchFraction = 0.08
    val patchW = maxOf(4, (w * patchFraction).toInt())
    val patchH = maxOf(4, (h * patchFraction).toInt())
    val strideX = maxOf(1, patchW / 20)
    val strideY = maxOf(1, patchH / 20)

    fun statsFor(x0: Int, y0: Int): BrightnessStats {
      var sum = 0.0
      var sumSq = 0.0
      var count = 0
      var y = y0
      val yEnd = minOf(h, y0 + patchH)
      val xEnd = minOf(w, x0 + patchW)
      while (y < yEnd) {
        var x = x0
        while (x < xEnd) {
          val pixel = bitmap.getPixel(x, y)
          val r = (pixel shr 16) and 0xFF
          val g = (pixel shr 8) and 0xFF
          val b = pixel and 0xFF
          val luma = 0.299 * r + 0.587 * g + 0.114 * b
          sum += luma
          sumSq += luma * luma
          count++
          x += strideX
        }
        y += strideY
      }
      if (count <= 0) return BrightnessStats(0.0, 0.0)
      val mean = sum / count
      val variance = (sumSq / count) - (mean * mean)
      return BrightnessStats(mean, variance.coerceAtLeast(0.0))
    }

    return arrayOf(
      statsFor(0, 0),
      statsFor(w - patchW, 0),
      statsFor(0, h - patchH),
      statsFor(w - patchW, h - patchH),
    )
  }

  /**
   * Mean + variance of luma over just the outer ~6% border strip on
   * every side. Purpose: if ML Kit's document scanner couldn't crop
   * tightly (very common on white-on-white scans, where the card
   * edge has low contrast against the surface), the returned image
   * contains a strip of the actual surface around the card. That
   * outer strip is the *only* place in the image where we can
   * observe the background at all - the middle is always card
   * content. High mean + very low variance on the border => the
   * surface is uniformly bright => a white/light background.
   */
  private fun sampleBorderBrightnessStats(bitmap: Bitmap): BrightnessStats {
    val w = bitmap.width
    val h = bitmap.height
    if (w <= 0 || h <= 0) return BrightnessStats(0.0, 0.0)
    val borderFraction = 0.06
    val borderW = maxOf(2, (w * borderFraction).toInt())
    val borderH = maxOf(2, (h * borderFraction).toInt())
    // Cap total samples to keep this cheap (~1600 pixels max) even at
    // 4K captures - stride the strips accordingly.
    val strideX = maxOf(1, w / 60)
    val strideY = maxOf(1, h / 60)

    var sum = 0.0
    var sumSq = 0.0
    var count = 0

    fun accumulate(x: Int, y: Int) {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      val pixel = bitmap.getPixel(x, y)
      val r = (pixel shr 16) and 0xFF
      val g = (pixel shr 8) and 0xFF
      val b = pixel and 0xFF
      val luma = 0.299 * r + 0.587 * g + 0.114 * b
      sum += luma
      sumSq += luma * luma
      count++
    }

    // Top + bottom horizontal strips.
    var y = 0
    while (y < borderH) {
      var x = 0
      while (x < w) {
        accumulate(x, y)
        accumulate(x, h - 1 - y)
        x += strideX
      }
      y += maxOf(1, strideY / 2)
    }
    // Left + right vertical strips (excluding corners we already hit).
    var x = 0
    while (x < borderW) {
      var yy = borderH
      while (yy < h - borderH) {
        accumulate(x, yy)
        accumulate(w - 1 - x, yy)
        yy += strideY
      }
      x += maxOf(1, strideX / 2)
    }

    if (count <= 0) return BrightnessStats(0.0, 0.0)
    val mean = sum / count
    val variance = (sumSq / count) - (mean * mean)
    return BrightnessStats(mean, variance.coerceAtLeast(0.0))
  }

  companion object {
    const val NAME = "SinglePageScanner"
    private const val SCAN_REQUEST_CODE = 29101
    private const val STUCK_SCAN_TIMEOUT_MS = 5_000L
  }
}
