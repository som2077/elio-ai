package com.elioai.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class LikedCarouselWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_NEXT_LIKED = "com.elioai.android.ACTION_NEXT_LIKED"
        const val ACTION_PREV_LIKED = "com.elioai.android.ACTION_PREV_LIKED"
        private const val PREFS_NAME = "ElioWidgetPrefs"
        private const val KEY_VIDEOS_JSON = "saved_videos_json"
        private const val KEY_CURRENT_LIKED_INDEX = "current_liked_index"

        private val imageExecutor = Executors.newFixedThreadPool(2)

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, LikedCarouselWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            val intent = Intent(context, LikedCarouselWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, allWidgetIds)
            }
            context.sendBroadcast(intent)
        }
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val currentIndex = prefs.getInt(KEY_CURRENT_LIKED_INDEX, 0)

        when (intent.action) {
            ACTION_NEXT_LIKED -> {
                prefs.edit().putInt(KEY_CURRENT_LIKED_INDEX, currentIndex + 1).apply()
                refreshAll(context)
            }
            ACTION_PREV_LIKED -> {
                prefs.edit().putInt(KEY_CURRENT_LIKED_INDEX, currentIndex - 1).apply()
                refreshAll(context)
            }
        }
    }

    private fun refreshAll(context: Context) {
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val thisWidget = ComponentName(context, LikedCarouselWidgetProvider::class.java)
        val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
        for (id in allWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_liked_carousel)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val videosJsonStr = prefs.getString(KEY_VIDEOS_JSON, "[]") ?: "[]"

        val likedVideos = mutableListOf<JSONObject>()
        val allVideos = mutableListOf<JSONObject>()

        try {
            val arr = JSONArray(videosJsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                allVideos.add(obj)
                if (obj.optBoolean("is_favorite", false)) {
                    likedVideos.add(obj)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // If user hasn't marked any favorite yet, fallback to all saved videos
        val targetList = if (likedVideos.isNotEmpty()) likedVideos else allVideos
        val isFavoritesMode = likedVideos.isNotEmpty()

        if (targetList.isNotEmpty()) {
            val rawIndex = prefs.getInt(KEY_CURRENT_LIKED_INDEX, 0)
            val safeIndex = Math.floorMod(rawIndex, targetList.size)
            val video = targetList[safeIndex]

            val title = video.optString("title", "Untitled Clip")
            val platform = video.optString("platform", "YouTube").replaceFirstChar { it.uppercase() }
            val creator = video.optString("creator_name", "Unknown Creator")
            val cleanUrl = video.optString("clean_url", video.optString("original_url", ""))
            val thumbUrl = video.optString("thumbnail_url", "")

            views.setTextViewText(R.id.widget_liked_counter, "${safeIndex + 1} / ${targetList.size}")
            views.setTextViewText(
                R.id.widget_liked_badge,
                if (isFavoritesMode) "❤️ LIKED VAULT" else "🎬 RECENT CLIPS"
            )
            views.setTextViewText(R.id.widget_liked_platform_badge, platform)
            views.setTextViewText(R.id.widget_liked_title, title)
            views.setTextViewText(R.id.widget_liked_meta, "$platform • $creator")

            // Clear previous thumbnail while loading
            views.setImageViewResource(R.id.widget_liked_thumb, 0)

            // Play Intent: Tapping video directly plays video in native app / browser
            val playIntent = if (cleanUrl.isNotBlank()) {
                Intent(Intent.ACTION_VIEW, Uri.parse(cleanUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            } else {
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            }

            val playPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 20 + safeIndex,
                playIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_liked_click_area, playPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_liked_play_bar, playPendingIntent)

            // Async Thumbnail loader (Safe scaled bitmap)
            if (thumbUrl.isNotBlank()) {
                val currentSafeIndex = safeIndex
                imageExecutor.execute {
                    try {
                        val bitmap = loadScaledBitmap(thumbUrl, 160, 160)
                        if (bitmap != null) {
                            val activeIndex = Math.floorMod(prefs.getInt(KEY_CURRENT_LIKED_INDEX, 0), targetList.size)
                            if (activeIndex == currentSafeIndex) {
                                val thumbViews = RemoteViews(context.packageName, R.layout.widget_liked_carousel)
                                thumbViews.setImageViewBitmap(R.id.widget_liked_thumb, bitmap)
                                appWidgetManager.partiallyUpdateAppWidget(appWidgetId, thumbViews)
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        } else {
            views.setTextViewText(R.id.widget_liked_counter, "0 / 0")
            views.setTextViewText(R.id.widget_liked_badge, "❤️ LIKED VAULT")
            views.setTextViewText(R.id.widget_liked_platform_badge, "Elio AI")
            views.setTextViewText(R.id.widget_liked_title, "No clips saved in vault yet")
            views.setTextViewText(R.id.widget_liked_meta, "Clip videos from YouTube, Instagram, 𝕏 to play here")
            views.setImageViewResource(R.id.widget_liked_thumb, 0)

            val appIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val appPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 20 + 99,
                appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_liked_click_area, appPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_liked_play_bar, appPendingIntent)
        }

        // Manual Prev Button (◀)
        val prevIntent = Intent(context, LikedCarouselWidgetProvider::class.java).apply {
            action = ACTION_PREV_LIKED
        }
        val prevPendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId * 20 + 101,
            prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_liked_prev_btn, prevPendingIntent)

        // Manual Next Button (▶)
        val nextIntent = Intent(context, LikedCarouselWidgetProvider::class.java).apply {
            action = ACTION_NEXT_LIKED
        }
        val nextPendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId * 20 + 102,
            nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_liked_next_btn, nextPendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun loadScaledBitmap(urlStr: String, reqWidth: Int, reqHeight: Int): Bitmap? {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            conn = url.openConnection() as HttpURLConnection
            conn.connectTimeout = 3000
            conn.readTimeout = 3000
            conn.doInput = true
            conn.connect()

            val bytes = conn.inputStream.readBytes()
            val opts = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)

            var inSampleSize = 1
            if (opts.outHeight > reqHeight || opts.outWidth > reqWidth) {
                val halfH = opts.outHeight / 2
                val halfW = opts.outWidth / 2
                while (halfH / inSampleSize >= reqHeight && halfW / inSampleSize >= reqWidth) {
                    inSampleSize *= 2
                }
            }

            opts.inJustDecodeBounds = false
            opts.inSampleSize = inSampleSize
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        } catch (e: Exception) {
            null
        } finally {
            conn?.disconnect()
        }
    }
}
