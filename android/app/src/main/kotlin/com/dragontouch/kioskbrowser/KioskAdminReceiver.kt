// Copyright (c) 2025 Sven Eisenschmidt. Licensed under the MIT License.
package com.dragontouch.kioskbrowser

import android.app.admin.DeviceAdminReceiver

/** Device admin with the force-lock policy, which ScreenScheduleReceiver needs for lockNow(). */
class KioskAdminReceiver : DeviceAdminReceiver()
