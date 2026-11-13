# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Project-specific ProGuard / R8 rules for Elio AI Android

# 1. Bytecode Optimization & Symbol Obfuscation
-optimizationpasses 5
-dontusemixedcaseclassnames
-repackageclasses ''
-flattenpackagehierarchy ''
-allowaccessmodification

# 2. Anti-Reverse Engineering: Strip debug & verbose logs in release APKs
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
}

# 3. React Native Core & Hermes Bytecode Engine
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip

-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# 4. React Native Reanimated & TurboModules
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# 5. Fresco Image Pipeline & Caching (Hardware Bitmap & Smooth Scrolling)
-keep class com.facebook.imagepipeline.** { *; }
-keep class com.facebook.drawee.** { *; }
-keep class com.facebook.fresco.** { *; }

# 6. OkHttp & Networking Security
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# 7. AsyncStorage & Native Storage Modules
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# 8. Expo Modules & Expo Router
-keep class expo.modules.** { *; }
-dontwarn expo.modules.**
