plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.pbo.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.pbo.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
