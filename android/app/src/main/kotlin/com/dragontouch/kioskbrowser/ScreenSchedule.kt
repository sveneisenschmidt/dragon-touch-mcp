// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import java.time.LocalTime
import java.time.ZonedDateTime
import java.time.format.DateTimeParseException

/** Daily times at which the screen turns off and on again, e.g. 22:00 and 06:00. */
data class ScreenSchedule(val sleepAt: LocalTime, val wakeAt: LocalTime) {

    companion object {
        val DEFAULT = ScreenSchedule(LocalTime.of(22, 0), LocalTime.of(6, 0))

        /** Parses "HH:mm" times. A missing or malformed time falls back to the default. */
        fun parse(sleepAt: String?, wakeAt: String?) = ScreenSchedule(
            parseTime(sleepAt) ?: DEFAULT.sleepAt,
            parseTime(wakeAt) ?: DEFAULT.wakeAt,
        )

        private fun parseTime(value: String?): LocalTime? =
            try {
                value?.let { LocalTime.parse(it) }
            } catch (e: DateTimeParseException) {
                null
            }

        /** The first moment after [now] at which the wall clock shows [time]. */
        fun nextOccurrence(now: ZonedDateTime, time: LocalTime): ZonedDateTime {
            val today = ZonedDateTime.of(now.toLocalDate(), time, now.zone)
            if (today.isAfter(now)) return today
            return ZonedDateTime.of(now.toLocalDate().plusDays(1), time, now.zone)
        }
    }
}
