package dev.pbo.mobile

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("pbo_mobile", MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val pad = (20 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }

        val title = TextView(this).apply {
            text = "Personal Browser Operator - Mobile Host"
            textSize = 20f
        }

        val relay = EditText(this).apply {
            hint = "Relay URL, e.g. https://personal-mobile-relay.example.workers.dev"
            setText(prefs.getString("relay_url", "") ?: "")
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        }

        val device = EditText(this).apply {
            hint = "Device ID"
            setText(prefs.getString("device_id", "vivo-v20-se") ?: "vivo-v20-se")
        }

        val token = EditText(this).apply {
            hint = "Device token"
            setText(prefs.getString("device_token", "") ?: "")
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }

        val allowedPackages = EditText(this).apply {
            hint = "Allowed packages, comma separated"
            setText(
                prefs.getString(
                    "allowed_packages",
                    "com.android.chrome,com.instagram.android,com.vivo.browser"
                ) ?: "com.android.chrome,com.instagram.android,com.vivo.browser"
            )
            inputType = InputType.TYPE_CLASS_TEXT
        }

        val save = Button(this).apply {
            text = "Save connection"
            setOnClickListener {
                prefs.edit()
                    .putString("relay_url", relay.text.toString().trim().trimEnd('/'))
                    .putString("device_id", device.text.toString().trim())
                    .putString("device_token", token.text.toString())
                    .putString("allowed_packages", allowedPackages.text.toString().trim())
                    .apply()
            }
        }

        val accessibility = Button(this).apply {
            text = "Open Accessibility Settings"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        val note = TextView(this).apply {
            text = "Enable the PBO Mobile Agent accessibility service after saving. " +
                "The agent only accepts commands through the configured authenticated relay. " +
                "Only allowlisted app packages may be observed or targeted. " +
                "Password fields require an explicitly approved command."
        }

        root.addView(title)
        root.addView(relay, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        root.addView(device, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        root.addView(token, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        root.addView(allowedPackages, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        root.addView(save)
        root.addView(accessibility)
        root.addView(note)
        setContentView(root)
    }
}
