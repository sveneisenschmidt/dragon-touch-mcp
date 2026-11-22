plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The APK version follows the npm package version, so `get_status` can compare
// the installed kiosk browser with the version the MCP server expects.
val packageVersion: String = Regex("\"version\"\\s*:\\s*\"([^\"]+)\"")
    .find(rootProject.file("../package.json").readText())!!
    .groupValues[1]
val packageVersionCode: Int = packageVersion.split(".").take(3)
    .map { it.takeWhile(Char::isDigit).toInt() }
    .let { (major, minor, patch) -> major * 10_000 + minor * 100 + patch }

// Release builds sign with the keystore that the release workflow decodes from
// repository secrets. Without these variables, the release APK stays unsigned.
val releaseKeystore: String? = System.getenv("KIOSK_KEYSTORE_FILE")

android {
    namespace = "com.dragontouch.kioskbrowser"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.dragontouch.kioskbrowser"
        minSdk = 26
        targetSdk = 34
        versionCode = packageVersionCode
        versionName = packageVersion
    }

    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = file(releaseKeystore)
                storePassword = System.getenv("KIOSK_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KIOSK_KEY_ALIAS")
                keyPassword = System.getenv("KIOSK_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseKeystore != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
