// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Restarts the kiosk after a reboot (e.g. power loss). Starts KioskService,
 * whose foreground watchdog then brings MainActivity to the front; the
 * activity restores the last URL from SharedPreferences.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.i("KioskDebug", "BootReceiver action=" + intent.action)
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        // Start the service unconditionally: it needs no URL itself, and the
        // prefs file may not be readable this early in boot. The watchdog then
        // launches MainActivity, which restores the last URL from prefs.
        context.startForegroundService(Intent(context, KioskService::class.java))
        // This ROM has been observed to silently drop the service start above
        // during boot, so also launch the activity directly. Allowed despite
        // Android 10 background-start restrictions via the SYSTEM_ALERT_WINDOW
        // appop, which persists across reboots. MainActivity restores the last
        // URL from prefs and starts the service itself.
        android.util.Log.i("KioskDebug", "BootReceiver: starting MainActivity")
        context.startActivity(Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        })
    }
}
