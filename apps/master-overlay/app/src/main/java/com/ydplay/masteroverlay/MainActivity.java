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

        TextView title = text("MASTER BOT OVERLAY v1.1 BETA", 25, Color.rgb(20, 90, 52));
        title.setGravity(Gravity.CENTER);
        root.addView(title, matchWrap());

        TextView intro = text("Companion overlay for your own/demo Rummy APK. Auto Scan uses on-device OCR for recommendations; it does not secretly auto-click or hide bot activity.", 15, Color.DKGRAY);
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
                "Auto Scan beta\n"
                + "1. Start Screen Capture and Master overlay.\n"
                + "2. Open your Rummy game and tap the green M.\n"
                + "3. Tap Auto Scan (beta). The overlay hides itself for a clean frame, reads visible card labels locally on your phone, then fills the fields.\n"
                + "4. If all 13/14 hand cards and Joker are trustworthy, Master advice runs automatically. Otherwise correct the fields and tap Analyze.\n\n"
                + "Manual format\nHand: AS,2S,3S,10H,JH,QH,...\nJoker rank: A / 2 ... K\nOpen card: 4S\nOpponent move: P2 PICK 8H or P2 DISCARD 9H\n\n"
                + "Recognition is beta: game skins with tiny/stylized card text or secure/blocked screenshots can require manual correction and later per-game calibration.",
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
        status.setText("Master overlay started. Open your game, tap the green M, then Auto Scan.");
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
                status.setText("Screen capture active. Start overlay, open your game, then use Auto Scan.");
            } else {
                status.setText("Screen capture permission was not granted. Manual overlay still works.");
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
