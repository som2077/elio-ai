package com.elioai.android

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.view.WindowCompat
import java.net.URLEncoder

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Intercept ACTION_SEND intent when app launches from system Share Sheet
    handleSendIntent(intent)
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme)
    super.onCreate(null)

    // Enable true edge-to-edge layout so translucent frosted glass blur
    // seamlessly extends all the way to the physical bottom edge under the system navigation bar
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.navigationBarColor = Color.TRANSPARENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isNavigationBarContrastEnforced = false
    }
  }

  override fun onNewIntent(intent: Intent) {
    // Intercept ACTION_SEND intent when app is already open in background
    handleSendIntent(intent)
    super.onNewIntent(intent)
  }

  /**
   * If another app (YouTube, Instagram, Twitter, etc.) shares a URL or text via ACTION_SEND,
   * convert it to an elio-ai://share deep link so React Native's standard Linking API handles it cleanly.
   */
  private fun handleSendIntent(intent: Intent?) {
    if (intent != null && Intent.ACTION_SEND == intent.action && intent.type != null) {
      if (intent.type?.startsWith("text/") == true) {
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)
        if (!sharedText.isNullOrBlank()) {
          try {
            val encoded = URLEncoder.encode(sharedText, "UTF-8")
            intent.data = Uri.parse("elio-ai:///share?text=$encoded")
            intent.action = Intent.ACTION_VIEW
          } catch (e: Exception) {
            e.printStackTrace()
          }
        }
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
