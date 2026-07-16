package com.nextarpsdk.scanner

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * Single-page capture only.
 *
 * ML Kit auto-detects the document edge and crops it. pageLimit is hard-coded
 * to 1 so the OS never offers "add another page" / "ready for next scan".
 * Flow: point camera → auto capture/crop → optional Retake/Keep for that
 * one photo → return to the app.
 */
class SinglePageScannerModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var scanPromise: Promise? = null

  private val activityEventListener: ActivityEventListener =
    object : BaseActivityEventListener() {
      override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
      ) {
        if (requestCode != REQUEST_CODE) return
        val promise = scanPromise ?: return
        scanPromise = null

        if (resultCode == Activity.RESULT_CANCELED) {
          val cancelled = WritableNativeMap()
          cancelled.putBoolean("didCancel", true)
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

          // Only ever keep the first auto-cropped page.
          val imageMap = copyToCache(pages.first().imageUri) ?: run {
            promise.reject("SCAN_COPY", "Could not save the scanned image")
            return
          }
          val response = WritableNativeMap()
          response.putMap("image", imageMap)
          promise.resolve(response)
        } catch (e: Exception) {
          Log.e(NAME, "Failed to handle scan result", e)
          promise.reject("SCAN_ERROR", e.message, e)
        }
      }
    }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun launch(promise: Promise) {
    val activity = currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity doesn't exist")
      return
    }
    if (scanPromise != null) {
      promise.reject("IN_PROGRESS", "A scan is already in progress")
      return
    }

    scanPromise = promise

    // pageLimit(1) removes multi-page. FULL mode gives the strongest auto edge/crop.
    val options =
      GmsDocumentScannerOptions.Builder()
        .setGalleryImportAllowed(false)
        .setPageLimit(1)
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
        .build()

    GmsDocumentScanning.getClient(options)
      .getStartScanIntent(activity)
      .addOnSuccessListener { intentSender ->
        try {
          activity.startIntentSenderForResult(
            intentSender,
            REQUEST_CODE,
            null,
            0,
            0,
            0,
          )
        } catch (e: Exception) {
          scanPromise = null
          promise.reject("SCAN_START", e.message, e)
        }
      }
      .addOnFailureListener { e ->
        scanPromise = null
        promise.reject("SCAN_START", e.message, e)
      }
  }

  private fun copyToCache(imageUri: Uri): WritableNativeMap? {
    val activity = currentActivity ?: return null
    val input = activity.contentResolver.openInputStream(imageUri) ?: return null
    val bytes = input.readBytes()
    input.close()

    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size) ?: return null
    val fileName = "${UUID.randomUUID()}.jpg"
    val outFile = File(activity.cacheDir, fileName)
    FileOutputStream(outFile).use { stream ->
      bitmap.compress(Bitmap.CompressFormat.JPEG, 92, stream)
    }

    val map = WritableNativeMap()
    map.putString("uri", Uri.fromFile(outFile).toString())
    map.putString("fileName", fileName)
    map.putString("type", "image/jpeg")
    map.putInt("width", bitmap.width)
    map.putInt("height", bitmap.height)
    map.putInt("fileSize", outFile.length().toInt())
    bitmap.recycle()
    return map
  }

  companion object {
    const val NAME = "SinglePageScanner"
    private const val REQUEST_CODE = 29101
  }
}
