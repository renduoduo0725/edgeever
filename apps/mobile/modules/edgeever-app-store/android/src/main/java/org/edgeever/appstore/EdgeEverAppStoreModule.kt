package org.edgeever.appstore

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val GOOGLE_PLAY_PACKAGE = "com.android.vending"
private const val RESULT_DISABLED = "disabled"
private const val RESULT_NOT_INSTALLED = "not-installed"
private const val RESULT_OPENED = "opened"
private const val RESULT_UNAVAILABLE = "unavailable"

class EdgeEverAppStoreModule : Module() {
  private var updateManager: AppUpdateManager? = null
  private var updateVersionCode = 0
  private val updateListener = InstallStateUpdatedListener { state ->
    sendEvent("onGooglePlayUpdate", updateState(installStatus(state.installStatus())))
  }

  private fun manager(): AppUpdateManager {
    return updateManager ?: AppUpdateManagerFactory.create(
      requireNotNull(appContext.reactContext)
    ).also {
      it.registerListener(updateListener)
      updateManager = it
    }
  }

  private fun installStatus(status: Int): String = when (status) {
    InstallStatus.PENDING, InstallStatus.DOWNLOADING, InstallStatus.INSTALLING -> "downloading"
    InstallStatus.DOWNLOADED -> "ready"
    else -> "unavailable"
  }

  private fun updateState(status: String) = mapOf(
    "status" to status,
    "versionCode" to updateVersionCode
  )

  private fun infoStatus(info: AppUpdateInfo): String {
    updateVersionCode = info.availableVersionCode()
    val status = installStatus(info.installStatus())
    if (status != "unavailable") return status
    return if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE &&
      info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) "available" else "unavailable"
  }

  override fun definition() = ModuleDefinition {
    Name("EdgeEverAppStore")
    Events("onGooglePlayUpdate")

    OnDestroy {
      updateManager?.unregisterListener(updateListener)
      updateManager = null
    }

    AsyncFunction("getGooglePlayUpdate") { promise: Promise ->
      manager().appUpdateInfo
        .addOnSuccessListener { promise.resolve(updateState(infoStatus(it))) }
        .addOnFailureListener { promise.resolve(updateState("unavailable")) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("startGooglePlayUpdate") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }
      val manager = manager()
      // Always fetch a fresh AppUpdateInfo: each instance can launch only one flow.
      manager.appUpdateInfo.addOnSuccessListener { info ->
        val status = infoStatus(info)
        if (status != "available") {
          sendEvent("onGooglePlayUpdate", updateState(status))
          promise.resolve(if (status == "unavailable") "unavailable" else "accepted")
          return@addOnSuccessListener
        }
        try {
          manager.startUpdateFlow(info, activity,
            AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build())
            .addOnSuccessListener { result ->
              promise.resolve(when (result) {
                Activity.RESULT_OK -> "accepted"
                Activity.RESULT_CANCELED -> "cancelled"
                else -> "unavailable"
              })
            }
            .addOnFailureListener { promise.resolve("unavailable") }
        } catch (_: Exception) {
          promise.resolve("unavailable")
        }
      }.addOnFailureListener { promise.resolve("unavailable") }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("completeGooglePlayUpdate") { promise: Promise ->
      manager().completeUpdate()
        .addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { promise.resolve(false) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("openGooglePlayDetails") { applicationId: String ->
      val activity = appContext.currentActivity ?: return@AsyncFunction RESULT_UNAVAILABLE
      val detailsUri = Uri.Builder()
        .scheme("market")
        .authority("details")
        .appendQueryParameter("id", applicationId)
        .build()
      val intent = Intent(Intent.ACTION_VIEW, detailsUri).apply {
        setPackage(GOOGLE_PLAY_PACKAGE)
      }

      try {
        activity.startActivity(intent)
        RESULT_OPENED
      } catch (_: ActivityNotFoundException) {
        getGooglePlayFailureReason(activity.packageManager)
      } catch (_: SecurityException) {
        getGooglePlayFailureReason(activity.packageManager)
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun getGooglePlayFailureReason(packageManager: PackageManager): String {
    return try {
      val applicationInfo = packageManager.getApplicationInfo(
        GOOGLE_PLAY_PACKAGE,
        PackageManager.MATCH_DISABLED_COMPONENTS
      )
      val enabledSetting = packageManager.getApplicationEnabledSetting(GOOGLE_PLAY_PACKAGE)
      val disabled = !applicationInfo.enabled || enabledSetting == PackageManager.COMPONENT_ENABLED_STATE_DISABLED ||
        enabledSetting == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER ||
        enabledSetting == PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED
      if (disabled) RESULT_DISABLED else RESULT_UNAVAILABLE
    } catch (_: PackageManager.NameNotFoundException) {
      RESULT_NOT_INSTALLED
    }
  }
}
