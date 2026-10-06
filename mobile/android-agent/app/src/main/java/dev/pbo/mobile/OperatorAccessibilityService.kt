package dev.pbo.mobile

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.Rect
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.ArrayDeque
import java.util.UUID

class OperatorAccessibilityService : AccessibilityService() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val refs = LinkedHashMap<String, AccessibilityNodeInfo>()
    private var stateCounter = 0L
    private var stateVersion: String? = null
    private var relay: RelayClient? = null
    private var deviceId: String = ""
    private var allowedPackages: Set<String> = emptySet()

    override fun onServiceConnected() {
        super.onServiceConnected()
        val prefs = getSharedPreferences("pbo_mobile", MODE_PRIVATE)
        val relayUrl = prefs.getString("relay_url", "") ?: ""
        deviceId = prefs.getString("device_id", "vivo-v20-se") ?: "vivo-v20-se"
        val token = prefs.getString("device_token", "") ?: ""
        allowedPackages = parseAllowedPackages(
            prefs.getString(
                "allowed_packages",
                "com.android.chrome,com.instagram.android,com.vivo.browser"
            ) ?: "com.android.chrome,com.instagram.android,com.vivo.browser"
        )

        relay?.close()
        relay = RelayClient(relayUrl, deviceId, token) { command ->
            mainHandler.post { executeCommand(command) }
        }.also { it.connect() }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit

    override fun onDestroy() {
        relay?.close()
        clearRefs()
        super.onDestroy()
    }

    private fun parseAllowedPackages(raw: String): Set<String> {
        return raw.split(",")
            .map { it.trim() }
            .filter { it.matches(Regex("^[A-Za-z0-9_.]+$")) }
            .toSet()
    }

    private fun requireAllowedPackage(packageName: String) {
        if (allowedPackages.isEmpty()) {
            throw SecurityException("PACKAGE_ALLOWLIST_EMPTY")
        }
        if (!allowedPackages.contains(packageName)) {
            throw SecurityException("PACKAGE_NOT_ALLOWED:$packageName")
        }
    }

    private fun executeCommand(command: JSONObject) {
        val requestId = command.optString("requestId")
        if (requestId.isBlank()) return

        try {
            val type = command.optString("type")
            val payload = command.optJSONObject("payload") ?: JSONObject()
            val approved = command.optBoolean("approved", false)

            val result = when (type) {
                "observe" -> observe()
                "open_url" -> openUrl(payload)
                "interact" -> interact(payload, approved)
                "global_action" -> globalAction(payload)
                else -> throw IllegalArgumentException("UNSUPPORTED_COMMAND:$type")
            }

            relay?.sendResponse(requestId, true, result)
        } catch (error: Throwable) {
            relay?.sendResponse(
                requestId,
                false,
                error = error.message ?: error.javaClass.simpleName
            )
        }
    }

    private fun clearRefs() {
        refs.values.forEach { runCatching { it.recycle() } }
        refs.clear()
    }

    private fun observe(): JSONObject {
        val root = rootInActiveWindow ?: throw IllegalStateException("NO_ACTIVE_WINDOW")
        val packageName = root.packageName?.toString() ?: ""
        requireAllowedPackage(packageName)

        clearRefs()
        stateCounter += 1
        stateVersion = "$deviceId:$stateCounter:" + System.currentTimeMillis()

        val queue = ArrayDeque<AccessibilityNodeInfo>()
        queue.add(root)
        val elements = JSONArray()
        val visibleText = StringBuilder()
        var visited = 0

        while (queue.isNotEmpty() && visited < 400) {
            val node = queue.removeFirst()
            visited += 1

            val text = if (node.isPassword) "[REDACTED_PASSWORD]" else (node.text?.toString() ?: "")
            val description = node.contentDescription?.toString() ?: ""
            if (text.isNotBlank()) {
                if (visibleText.isNotEmpty()) visibleText.append("\n")
                visibleText.append(text.take(300))
            }

            val interesting =
                node.isClickable || node.isEditable || text.isNotBlank() || description.isNotBlank()

            if (interesting && elements.length() < 250) {
                val ref = "mref-" + (elements.length() + 1)
                refs[ref] = AccessibilityNodeInfo.obtain(node)

                val bounds = Rect()
                node.getBoundsInScreen(bounds)

                elements.put(
                    JSONObject()
                        .put("ref", ref)
                        .put("text", text.take(240))
                        .put("description", description.take(240))
                        .put("className", node.className?.toString() ?: "")
                        .put("viewId", node.viewIdResourceName ?: JSONObject.NULL)
                        .put("clickable", node.isClickable)
                        .put("editable", node.isEditable)
                        .put("password", node.isPassword)
                        .put(
                            "bounds",
                            JSONObject()
                                .put("left", bounds.left)
                                .put("top", bounds.top)
                                .put("right", bounds.right)
                                .put("bottom", bounds.bottom)
                        )
                )
            }

            for (index in 0 until node.childCount) {
                node.getChild(index)?.let(queue::addLast)
            }
        }

        return JSONObject()
            .put("observationId", "MOBS-" + UUID.randomUUID())
            .put("deviceId", deviceId)
            .put("stateVersion", stateVersion)
            .put("packageName", packageName)
            .put("windowClass", root.className?.toString() ?: "")
            .put("textSnapshot", visibleText.toString().take(12000))
            .put("interactiveElements", elements)
            .put("trust", "UNTRUSTED_DEVICE_DATA")
            .put("authority", "NONE")
            .put("capturedAt", Instant.now().toString())
    }

    private fun requireFreshRef(payload: JSONObject): AccessibilityNodeInfo {
        val expectedState = payload.optString("stateVersion")
        if (expectedState.isBlank() || expectedState != stateVersion) {
            throw IllegalStateException("STALE_STATE")
        }

        val ref = payload.optString("ref")
        return refs[ref] ?: throw IllegalArgumentException("TARGET_NOT_FOUND")
    }

    private fun interact(payload: JSONObject, approved: Boolean): JSONObject {
        val root = rootInActiveWindow ?: throw IllegalStateException("NO_ACTIVE_WINDOW")
        requireAllowedPackage(root.packageName?.toString() ?: "")

        val node = requireFreshRef(payload)
        val operation = payload.optString("operation")
        val value = if (payload.has("value")) payload.optString("value") else null

        val success = when (operation) {
            "click" -> clickNodeOrParent(node)
            "fill" -> {
                if (!node.isEditable) throw IllegalStateException("TARGET_NOT_EDITABLE")
                if (node.isPassword && !approved) {
                    throw SecurityException("SENSITIVE_INPUT_REQUIRES_APPROVAL")
                }
                if (value == null) throw IllegalArgumentException("VALUE_REQUIRED")
                val args = Bundle().apply {
                    putCharSequence(
                        AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                        value
                    )
                }
                node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
            }
            else -> throw IllegalArgumentException("UNSUPPORTED_INTERACTION:$operation")
        }

        if (!success) throw IllegalStateException("ACTION_NOT_PERFORMED")
        stateVersion = null
        clearRefs()

        return JSONObject()
            .put("operation", operation)
            .put("executed", true)
            .put("requiresFreshObservation", true)
    }

    private fun clickNodeOrParent(original: AccessibilityNodeInfo): Boolean {
        var node: AccessibilityNodeInfo? = original
        repeat(6) {
            if (node?.isClickable == true && node?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true) {
                return true
            }
            node = node?.parent
        }
        return false
    }

    private fun openUrl(payload: JSONObject): JSONObject {
        val raw = payload.optString("url")
        val uri = Uri.parse(raw)
        if (uri.scheme != "https" && uri.scheme != "http") {
            throw SecurityException("ONLY_HTTP_HTTPS_ALLOWED")
        }

        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        stateVersion = null
        clearRefs()
        return JSONObject()
            .put("opened", raw)
            .put("requiresFreshObservation", true)
    }

    private fun globalAction(payload: JSONObject): JSONObject {
        val name = payload.optString("action")
        val action = when (name) {
            "BACK" -> GLOBAL_ACTION_BACK
            "HOME" -> GLOBAL_ACTION_HOME
            "RECENTS" -> GLOBAL_ACTION_RECENTS
            else -> throw IllegalArgumentException("UNSUPPORTED_GLOBAL_ACTION:$name")
        }

        if (!performGlobalAction(action)) {
            throw IllegalStateException("GLOBAL_ACTION_NOT_PERFORMED")
        }

        stateVersion = null
        clearRefs()
        return JSONObject()
            .put("action", name)
            .put("executed", true)
            .put("requiresFreshObservation", true)
    }
}
