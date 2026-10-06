package dev.pbo.mobile

import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class RelayClient(
    private val relayUrl: String,
    private val deviceId: String,
    private val token: String,
    private val onCommand: (JSONObject) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var socket: WebSocket? = null

    @Volatile
    private var stopped = false

    fun connect() {
        if (stopped || relayUrl.isBlank() || deviceId.isBlank() || token.isBlank()) return
        val wsUrl = relayUrl
            .replaceFirst("https://", "wss://")
            .replaceFirst("http://", "ws://")
            .trimEnd('/') + "/v1/device/" + deviceId + "/connect"

        val request = Request.Builder()
            .url(wsUrl)
            .header("Authorization", "Bearer $token")
            .build()

        socket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching { JSONObject(text) }.getOrNull()?.let(onCommand)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                socket = null
                scheduleReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                socket = null
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (stopped) return
        handler.postDelayed({ connect() }, 2500)
    }

    fun sendResponse(requestId: String, ok: Boolean, result: JSONObject? = null, error: String? = null) {
        val payload = JSONObject()
            .put("requestId", requestId)
            .put("ok", ok)

        if (result != null) payload.put("result", result)
        if (error != null) payload.put("error", error)

        socket?.send(payload.toString())
    }

    fun close() {
        stopped = true
        handler.removeCallbacksAndMessages(null)
        socket?.close(1000, "service_stopped")
        socket = null
        client.dispatcher.executorService.shutdown()
    }
}
