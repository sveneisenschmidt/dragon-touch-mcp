// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Test

class ScreenScheduleTest {

    private val berlin = ZoneId.of("Europe/Berlin")

    private fun at(text: String) = ZonedDateTime.of(LocalDateTime.parse(text), berlin)

    @Test
    fun nextOccurrenceIsTodayWhenTimeIsStillAhead() {
        val next = ScreenSchedule.nextOccurrence(at("2026-10-15T08:00"), LocalTime.of(22, 0))
        assertEquals(at("2026-10-15T22:00"), next)
    }

    @Test
    fun nextOccurrenceIsTomorrowWhenTimeHasPassed() {
        val next = ScreenSchedule.nextOccurrence(at("2026-10-15T08:00"), LocalTime.of(6, 0))
        assertEquals(at("2026-10-16T06:00"), next)
    }

    @Test
    fun nextOccurrenceIsTomorrowWhenTimeIsNow() {
        val next = ScreenSchedule.nextOccurrence(at("2026-10-15T22:00"), LocalTime.of(22, 0))
        assertEquals(at("2026-10-16T22:00"), next)
    }

    @Test
    fun nextOccurrenceKeepsWallClockTimeAcrossDstChange() {
        // Clocks go back one hour on 2026-10-25 at 03:00 CEST
        val now = at("2026-10-24T23:00")
        val next = ScreenSchedule.nextOccurrence(now, LocalTime.of(6, 0))
        assertEquals(at("2026-10-25T06:00"), next)
        assertEquals(8 * 3600L, next.toEpochSecond() - now.toEpochSecond())
    }

    @Test
    fun parseReadsSleepAndWakeTimes() {
        val schedule = ScreenSchedule.parse("21:30", "07:15")
        assertEquals(ScreenSchedule(LocalTime.of(21, 30), LocalTime.of(7, 15)), schedule)
    }

    @Test
    fun parseFallsBackToDefaultForMissingOrMalformedTimes() {
        assertEquals(ScreenSchedule.DEFAULT, ScreenSchedule.parse(null, "6 Uhr"))
        assertEquals(LocalTime.of(22, 0), ScreenSchedule.DEFAULT.sleepAt)
        assertEquals(LocalTime.of(6, 0), ScreenSchedule.DEFAULT.wakeAt)
    }
}
