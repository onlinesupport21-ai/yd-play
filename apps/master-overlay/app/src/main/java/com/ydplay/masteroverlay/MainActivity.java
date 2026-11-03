package com.ydplay.masteroverlay;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.projection.MediaProjectionManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.*;

public class MainActivity extends Activity {
    private static final int REQ_OVERLAY = 1001;
    private static final int REQ_CAPTURE = 1002;
    private MediaProjectionManager projectionManager;
    private TextView status;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        projectionManager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 77);
        }
        buildUi();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(22), dp(28), dp(22), dp(28));
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        scroll.addView(root);

        TextView title = text("MASTER BOT • GAME BRAIN", 25, Color.rgb(20, 90, 52));
        title.setGravity(Gravity.CENTER);
        root.addView(title, matchWrap());

        TextView intro = text("Recommendation companion for your own/demo Rummy APK. Live Scan stabilizes repeated on-device observations, tracks visible table changes and shows one clear next action. It never auto-clicks the game.", 15, Color.DKGRAY);
        intro.setPadding(0, dp(12), 0, dp(18));
        root.addView(intro, matchWrap());

        status = text("Ready", 15, Color.BLACK);
        status.setPadding(dp(12), dp(12), dp(12), dp(12));
        status.setBackgroundColor(Color.rgb(238, 246, 240));
        root.addView(status, matchWrap());

        root.addView(button("1. Grant overlay permission", v -> requestOverlay()), matchWrapTop());
        root.addView(button("2. Grant screen capture", v -> requestCapture()), matchWrapTop());
        root.addView(button("3. Start Master overlay", v -> startOverlay()), matchWrapTop());
        root.addView(button("Stop overlay", v -> stopOverlay()), matchWrapTop());

        TextView help = text(
                "How to use Game Brain\n"
                + "1. Grant Screen Capture and start the Master overlay.\n"
                + "2. Open your Rummy game and tap the green M.\n"
                + "3. Turn Live Scan ON. The large panel closes so it does not cover your cards.\n"
                + "4. A compact top-left pill shows: PICK OPEN, DRAW CLOSED, DISCARD, WATCHING TABLE, or SCAN UNCERTAIN.\n"
                + "5. Tap the pill to pause Live Scan and open Why? details such as scan confidence, known/unseen cards and danger signals.\n\n"
                + "Trust rule\nThe app waits for repeated compatible scans. If the hand/Joker/open-card state is not trustworthy it says SCAN UNCERTAIN — DON'T ACT instead of guessing.\n\n"
                + "Manual fallback remains under Manual if a stylized card cannot be read.",
                14,
                Color.DKGRAY);
        help.setPadding(0, dp(22), 0, 0);
        root.addView(help, matchWrap());
        setContentView(scroll);
        refreshStatus();
    }

    private void requestOverlay() {
        if (Settings.canDrawOverlays(this)) { toast("Overlay permission already granted"); refreshStatus(); return; }
        Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName()));
        startActivityForResult(i, REQ_OVERLAY);
    }

    private void requestCapture() {
        startActivityForResult(projectionManager.createScreenCaptureIntent(), REQ_CAPTURE);
    }

    private void startOverlay() {
        if (!Settings.canDrawOverlays(this)) { toast("Grant overlay permission first"); requestOverlay(); return; }
        Intent i = new Intent(this, OverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        status.setText("Master overlay started. Open your game, tap M, then turn Live Scan ON.");
    }

    private void stopOverlay() {
        stopService(new Intent(this, OverlayService.class));
        stopService(new Intent(this, CaptureService.class));
        status.setText("Overlay stopped");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_CAPTURE) {
            if (resultCode == RESULT_OK && data != null) {
                Intent svc = new Intent(this, CaptureService.class);
                svc.putExtra(CaptureService.EXTRA_RESULT_CODE, resultCode);
                svc.putExtra(CaptureService.EXTRA_RESULT_DATA, data);
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(svc); else startService(svc);
                status.setText("Screen capture active. Start the overlay, open your game and turn Live Scan ON.");
            } else {
                status.setText("Screen capture permission was not granted. Manual fallback still works.");
            }
        } else if (requestCode == REQ_OVERLAY) {
            refreshStatus();
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (status != null) refreshStatus();
    }

    private void refreshStatus() {
        boolean overlay = Settings.canDrawOverlays(this);
        status.setText("Overlay permission: " + (overlay ? "GRANTED" : "NOT GRANTED") + "\nCapture: " + CaptureService.getPublicStatus());
    }

    private Button button(String label, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(label);
        b.setTextSize(16);
        b.setAllCaps(false);
        b.setOnClickListener(listener);
        return b;
    }

    private TextView text(String s, int sp, int color) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        return t;
    }

    private LinearLayout.LayoutParams matchWrap() { return new LinearLayout.LayoutParams(-1, -2); }
    private LinearLayout.LayoutParams matchWrapTop() { LinearLayout.LayoutParams p=matchWrap(); p.topMargin=dp(12); return p; }
    private int dp(int x) { return Math.round(x * getResources().getDisplayMetrics().density); }
    private void toast(String s) { Toast.makeText(this, s, Toast.LENGTH_SHORT).show(); }
}
