package com.elioai.android

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class WidgetDataModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetDataModule"

    @ReactMethod
    fun setWidgetData(jsonString: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences("ElioWidgetPrefs", Context.MODE_PRIVATE)
            prefs.edit().putString("saved_videos_json", jsonString).apply()

            // Broadcast immediate update to both Android widgets
            AiInsightWidgetProvider.updateAllWidgets(reactApplicationContext)
            LikedCarouselWidgetProvider.updateAllWidgets(reactApplicationContext)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun updateWidgets(promise: Promise) {
        try {
            AiInsightWidgetProvider.updateAllWidgets(reactApplicationContext)
            LikedCarouselWidgetProvider.updateAllWidgets(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_ERROR", e.message, e)
        }
    }
}
