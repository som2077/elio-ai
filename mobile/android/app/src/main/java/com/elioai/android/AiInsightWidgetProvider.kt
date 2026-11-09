package com.elioai.android

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject

class AiInsightWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_CYCLE_INSIGHT = "com.elioai.android.ACTION_CYCLE_INSIGHT"
        private const val PREFS_NAME = "ElioWidgetPrefs"
        private const val KEY_VIDEOS_JSON = "saved_videos_json"
        private const val KEY_CURRENT_INSIGHT_INDEX = "current_insight_index"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, AiInsightWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            val intent = Intent(context, AiInsightWidgetProvider::class.java).apply {
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
        if (intent.action == ACTION_CYCLE_INSIGHT) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentIndex = prefs.getInt(KEY_CURRENT_INSIGHT_INDEX, 0)
            prefs.edit().putInt(KEY_CURRENT_INSIGHT_INDEX, currentIndex + 1).apply()

            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisWidget = ComponentName(context, AiInsightWidgetProvider::class.java)
            val allWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget)
            for (id in allWidgetIds) {
                updateWidget(context, appWidgetManager, id)
            }
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_ai_insight)
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val videosJsonStr = prefs.getString(KEY_VIDEOS_JSON, "[]") ?: "[]"

        val insightVideos = mutableListOf<JSONObject>()
        try {
            val arr = JSONArray(videosJsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val aiMeta = obj.optJSONObject("ai_metadata")
                val tldw = aiMeta?.optString("tldw")
                if (!tldw.isNullOrBlank()) {
                    insightVideos.add(obj)
                }
            }
            // If none have tldw yet, fallback to any videos
            if (insightVideos.isEmpty()) {
                for (i in 0 until arr.length()) {
                    insightVideos.add(arr.getJSONObject(i))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        if (insightVideos.isNotEmpty()) {
            val rawIndex = prefs.getInt(KEY_CURRENT_INSIGHT_INDEX, 0)
            val safeIndex = Math.floorMod(rawIndex, insightVideos.size)
            val video = insightVideos[safeIndex]

            val title = video.optString("title", "Untitled Clip")
            val platform = video.optString("platform", "YouTube").replaceFirstChar { it.uppercase() }
            val cleanUrl = video.optString("clean_url", video.optString("original_url", ""))
            val aiMeta = video.optJSONObject("ai_metadata")
            val tldw = aiMeta?.optString("tldw", "Save videos from YouTube, Instagram, or 𝕏 to get automated AI Key Takeaways.")
            val readTime = aiMeta?.optInt("read_time_seconds", 120)?.let { it / 60 } ?: 2

            views.setTextViewText(R.id.widget_ai_title, title)
            views.setTextViewText(R.id.widget_ai_platform_badge, platform)
            views.setTextViewText(R.id.widget_ai_takeaway, "❝ $tldw ❞")
            views.setTextViewText(R.id.widget_ai_read_time, "⏱️ ${if (readTime < 1) 1 else readTime}m read in vault")

            // Play / Open intent
            val openIntent = if (cleanUrl.isNotBlank()) {
                Intent(Intent.ACTION_VIEW, Uri.parse(cleanUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            } else {
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
            }
            val openPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 1,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_ai_root, openPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_ai_open_action, openPendingIntent)
        } else {
            // Default placeholder state
            views.setTextViewText(R.id.widget_ai_title, "No AI Insights Yet")
            views.setTextViewText(R.id.widget_ai_platform_badge, "Elio AI")
            views.setTextViewText(
                R.id.widget_ai_takeaway,
                "❝ Open Elio AI or share clips from YouTube, Instagram, and 𝕏 to unlock instant AI takeaways here. ❞"
            )
            views.setTextViewText(R.id.widget_ai_read_time, "⏱️ Elio Knowledge Vault")

            val appIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val appPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 2,
                appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_ai_root, appPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_ai_open_action, appPendingIntent)
        }

        // Cycle / Refresh Intent
        val cycleIntent = Intent(context, AiInsightWidgetProvider::class.java).apply {
            action = ACTION_CYCLE_INSIGHT
        }
        val cyclePendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId * 10 + 3,
            cycleIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_ai_refresh_btn, cyclePendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }
}
