package com.nextarpsdk.scanner

import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import com.nextarpsdk.R
import java.lang.ref.WeakReference

/**
 * Native copy of the RN "Use a dark background" modal.
 *
 * Must be native: after ~5s of a stuck ML Kit scan we need a popup *on top of*
 * Google's scanner activity. A React Native Modal cannot appear over that
 * closed Play Services UI. Started with FLAG_ACTIVITY_NEW_TASK so it stacks
 * above ML Kit even when MainActivity is paused.
 */
class WhiteBackgroundWarningActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    instance = WeakReference(this)
    setContentView(R.layout.activity_white_background_warning)

    findViewById<TextView>(R.id.retake_button).setOnClickListener { completeRetake() }
    findViewById<android.view.View>(R.id.warning_backdrop).setOnClickListener { completeRetake() }
  }

  override fun onDestroy() {
    if (instance?.get() === this) {
      instance = null
    }
    super.onDestroy()
  }

  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    completeRetake()
  }

  private fun completeRetake() {
    val callback = onRetake
    onRetake = null
    instance = null
    finish()
    callback?.invoke()
  }

  companion object {
    /** Invoked once when the user confirms Retake / back / tap-outside. */
    @JvmField
    var onRetake: (() -> Unit)? = null

    private var instance: WeakReference<WhiteBackgroundWarningActivity>? = null

    /**
     * Close the overlay without invoking [onRetake] — used when ML Kit
     * returns a successful capture while the warning is still visible.
     */
    @JvmStatic
    fun dismissQuietly() {
      onRetake = null
      val activity = instance?.get()
      instance = null
      activity?.finish()
    }
  }
}
