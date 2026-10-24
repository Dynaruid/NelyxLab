package com.nelyxtestbed2

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import dev.nelyx.sdk.editing.NelyxEditingPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      jsMainModulePath = "main",
      packageList =
        PackageList(this).packages.apply {
          add(NelyxEditingPackage())
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    android.util.Log.i("NelyxStartup", "NELYX_NATIVE_TIMING {\"phase\":\"ApplicationCreated\",\"clock\":\"Android-elapsedRealtime\",\"processStartedMs\":" + android.os.Process.getStartElapsedRealtime() + ",\"atMs\":" + android.os.SystemClock.elapsedRealtime() + "}")
    loadReactNative(this)
    android.util.Log.i("NelyxStartup", "NELYX_NATIVE_TIMING {\"phase\":\"ReactNativeEntryLoaded\",\"clock\":\"Android-elapsedRealtime\",\"atMs\":" + android.os.SystemClock.elapsedRealtime() + "}")
  }
}
