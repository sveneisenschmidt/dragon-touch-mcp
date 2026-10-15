// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.ZonedDateTime

/**
 * Turns the screen off at the sleep time and on at the wake time every day.
 * Replaces the sleep timer of the stock app com.fujia.calendar, which is
 * disabled on the tablet. A reboot or a force-stop (open_url, close_browser)
 * deletes the alarms, so MainActivity schedules them again on every start.
 */
object ScreenScheduler {
    const val ACTION_SLEEP = "com.dragontouch.kioskbrowser.SLEEP"
    const val ACTION_WAKE = "com.dragontouch.kioskbrowser.WAKE"

    fun schedule(context: Context) {
        val prefs = context.getSharedPreferences("kiosk", Context.MODE_PRIVATE)
        val schedule = ScreenSchedule.parse(prefs.getString("sleepAt", null), prefs.getString("wakeAt", null))
        val now = ZonedDateTime.now()
        setAlarm(context, ACTION_SLEEP, ScreenSchedule.nextOccurrence(now, schedule.sleepAt))
        setAlarm(context, ACTION_WAKE, ScreenSchedule.nextOccurrence(now, schedule.wakeAt))
    }

    private fun setAlarm(context: Context, action: String, at: ZonedDateTime) {
        val intent = Intent(context, ScreenScheduleReceiver::class.java).setAction(action)
        val pending = PendingIntent.getBroadcast(
            context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toInstant().toEpochMilli(), pending)
        android.util.Log.i("KioskDebug", "ScreenScheduler: $action at $at")
    }
}
