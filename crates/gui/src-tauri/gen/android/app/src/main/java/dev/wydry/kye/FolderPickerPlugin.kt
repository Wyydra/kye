package dev.wydry.kye

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class FolderPickerPlugin(private val activity: Activity) : Plugin(activity) {

    private var pendingInvoke: Invoke? = null
    private val launcher: ActivityResultLauncher<Uri?> = (activity as androidx.activity.ComponentActivity)
        .activityResultRegistry
        .register("folder_picker", ActivityResultContracts.OpenDocumentTree()) { uri ->
            val invoke = pendingInvoke ?: return@register
            pendingInvoke = null
            if (uri != null) {
                // Take persistent read/write permission so the app can access it later
                val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                activity.contentResolver.takePersistableUriPermission(uri, flags)

                // Convert content URI to a real filesystem path if possible
                val realPath = resolveRealPath(uri)
                val result = JSObject()
                if (realPath != null) {
                    result.put("path", realPath)
                    result.put("uri", uri.toString())
                } else {
                    // Fallback: return the URI string, let Rust/JS handle it
                    result.put("path", null)
                    result.put("uri", uri.toString())
                }
                invoke.resolve(result)
            } else {
                invoke.reject("User cancelled folder selection")
            }
        }

    override fun onPause() {
        super.onPause()
        launcher.unregister()
    }

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
    }

    @Command
    fun pickFolder(invoke: Invoke) {
        pendingInvoke = invoke
        launcher.launch(null)
    }

    /**
     * Attempts to resolve a content:// tree URI to a real filesystem path.
     * Works for URIs from the primary external storage (e.g. /sdcard/...).
     * Returns null for cloud/provider URIs that have no real path.
     */
    private fun resolveRealPath(uri: Uri): String? {
        // content://com.android.externalstorage.documents/tree/primary:<path>
        if (uri.authority == "com.android.externalstorage.documents") {
            val docId = androidx.documentfile.provider.DocumentFile
                .fromTreeUri(activity, uri)
                ?.uri
                ?.lastPathSegment
                ?: return null
            // docId is like "primary:Documents/kye"
            val parts = docId.split(":")
            if (parts.size == 2 && parts[0] == "primary") {
                val sdcard = android.os.Environment.getExternalStorageDirectory().absolutePath
                return "$sdcard/${parts[1]}"
            }
        }
        return null
    }
}
