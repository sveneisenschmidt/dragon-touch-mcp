// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.PowerManager

/**
 * Receives the ScreenScheduler alarms. Also receives clock and time zone
 * changes, which make the scheduled alarm times wrong.
 */
class ScreenScheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.i("KioskDebug", "ScreenScheduleReceiver action=" + intent.action)
        when (intent.action) {
            ScreenScheduler.ACTION_SLEEP -> sleep(context)
            ScreenScheduler.ACTION_WAKE -> wake(context)
        }
        // Moves the alarm that just fired to the next day
        ScreenScheduler.schedule(context)
    }

    // lockNow() needs an active device admin, granted once via:
    // adb shell dpm set-active-admin com.dragontouch.kioskbrowser/.KioskAdminReceiver
    // The lock screen is disabled on the tablet, so this only turns the screen off.
    private fun sleep(context: Context) {
        val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        if (!dpm.isAdminActive(ComponentName(context, KioskAdminReceiver::class.java))) {
            android.util.Log.e("KioskDebug", "ScreenScheduleReceiver: device admin inactive, screen stays on")
            return
        }
        dpm.lockNow()
    }

    // ACQUIRE_CAUSES_WAKEUP turns the screen on. Afterwards FLAG_KEEP_SCREEN_ON
    // keeps it on, and KioskService brings MainActivity to the front.
    @Suppress("DEPRECATION")
    private fun wake(context: Context) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "kiosk:wake"
        ).acquire(10_000L)
    }
}
