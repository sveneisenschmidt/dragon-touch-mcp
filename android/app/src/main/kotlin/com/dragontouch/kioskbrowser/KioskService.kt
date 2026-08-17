// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

class KioskService : Service() {

    companion object {
        private const val WATCHDOG_INTERVAL_MS = 5_000L
    }

    private val handler = Handler(Looper.getMainLooper())

    // The stock calendar app (com.fujia.calendar) periodically brings itself
    // to the foreground, hiding the kiosk browser. While this service runs,
    // reclaim the foreground whenever MainActivity is paused and the screen
    // is on. Stopped via close_browser (force-stop kills the service).
    private val watchdog = object : Runnable {
        override fun run() {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!MainActivity.isInForeground && pm.isInteractive) {
                bringToFront()
            }
            handler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    private val screenReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action == Intent.ACTION_SCREEN_ON) {
                bringToFront()
            }
        }
    }

    private fun bringToFront() {
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        })
    }

    override fun onCreate() {
        super.onCreate()
        android.util.Log.i("KioskDebug", "KioskService onCreate")
        val channelId = "kiosk"
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(NotificationChannel(channelId, "Kiosk", NotificationManager.IMPORTANCE_MIN))
        startForeground(1, Notification.Builder(this, channelId)
            .setContentTitle("Kiosk Browser")
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .build())
        registerReceiver(screenReceiver, IntentFilter(Intent.ACTION_SCREEN_ON))
        handler.postDelayed(watchdog, WATCHDOG_INTERVAL_MS)
    }

    override fun onDestroy() {
        handler.removeCallbacks(watchdog)
        unregisterReceiver(screenReceiver)
        super.onDestroy()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY

    override fun onBind(intent: Intent?): IBinder? = null
}
