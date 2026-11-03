package com.ydplay.masteroverlay;

import android.app.*;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.*;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.*;
import android.util.DisplayMetrics;
import android.view.WindowManager;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

public class CaptureService extends Service {
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    private static final AtomicBoolean SNAPSHOT_REQUESTED = new AtomicBoolean(false);
    private static final AtomicLong SNAPSHOT_VERSION = new AtomicLong(0);
    private static final AtomicLong SNAPSHOT_REQUEST_SEQUENCE = new AtomicLong(0);
    private static final Handler SNAPSHOT_HANDLER = new Handler(Looper.getMainLooper());
    private static final long SNAPSHOT_SETTLE_MS = 180L;
    private static volatile String publicStatus = "inactive";

    private final Object captureLock = new Object();
    private MediaProjection projection;
    private ImageReader reader;
    private VirtualDisplay display;
    private HandlerThread thread;
    private int captureWidth;
    private int captureHeight;
    private int captureDensity;

    public static String getPublicStatus() { return publicStatus; }
    public static long getLatestSnapshotVersion() { return SNAPSHOT_VERSION.get(); }
    public static File getLatestSnapshotFile(Context context) { return new File(context.getCacheDir(), "master_snapshot.png"); }
    public static void requestSnapshot() {
        long ticket = SNAPSHOT_REQUEST_SEQUENCE.incrementAndGet();
        SNAPSHOT_REQUESTED.set(false);
        publicStatus = "snapshot settling";
        SNAPSHOT_HANDLER.postDelayed(() -> {
            if (SNAPSHOT_REQUEST_SEQUENCE.get() != ticket) return;
            SNAPSHOT_REQUESTED.set(true);
            publicStatus = "snapshot requested";
        }, SNAPSHOT_SETTLE_MS);
    }

    @Override public void onCreate() { super.onCreate(); createChannel(); }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(52, notification("Screen capture active"));
        if (projection != null) return START_STICKY;
        if (intent == null) { stopSelf(); return START_NOT_STICKY; }
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED);
        Intent data;
        if (Build.VERSION.SDK_INT >= 33) data = intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent.class);
        else data = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        if (resultCode != Activity.RESULT_OK || data == null) { publicStatus="permission missing"; stopSelf(); return START_NOT_STICKY; }

        MediaProjectionManager mgr=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
        projection=mgr.getMediaProjection(resultCode,data);
        projection.registerCallback(new MediaProjection.Callback() {
            @Override public void onStop() { publicStatus="capture stopped by system"; releaseCaptureResources(); stopSelf(); }
            @Override public void onCapturedContentResize(int width, int height) {
                if (Build.VERSION.SDK_INT >= 34) resizeCapture(width, height);
            }
        }, new Handler(Looper.getMainLooper()));

        DisplayMetrics dm=currentDisplayMetrics();
        captureWidth=dm.widthPixels;
        captureHeight=dm.heightPixels;
        captureDensity=dm.densityDpi;
        thread=new HandlerThread("MasterCapture");
        thread.start();
        reader=createReader(captureWidth,captureHeight);
        display=projection.createVirtualDisplay(
                "MasterBotCapture",
                captureWidth,
                captureHeight,
                captureDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                reader.getSurface(),
                null,
                null);
        if (display == null) {
            publicStatus="capture init failed";
            stopSelf();
            return START_NOT_STICKY;
        }
        publicStatus="active " + captureWidth + "x" + captureHeight;
        return START_STICKY;
    }

    @Override public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        DisplayMetrics dm=currentDisplayMetrics();
        captureDensity=dm.densityDpi;
        resizeCapture(dm.widthPixels,dm.heightPixels);
    }

    private DisplayMetrics currentDisplayMetrics() {
        DisplayMetrics dm=new DisplayMetrics();
        WindowManager wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Rect b=wm.getCurrentWindowMetrics().getBounds();
            dm.widthPixels=b.width();
            dm.heightPixels=b.height();
            dm.densityDpi=getResources().getDisplayMetrics().densityDpi;
        } else {
            wm.getDefaultDisplay().getRealMetrics(dm);
        }
        return dm;
    }

    private ImageReader createReader(int width, int height) {
        ImageReader newReader=ImageReader.newInstance(width,height,PixelFormat.RGBA_8888,2);
        newReader.setOnImageAvailableListener(r -> onFrame(r,width,height), new Handler(thread.getLooper()));
        return newReader;
    }

    private void resizeCapture(int width, int height) {
        if (width <= 0 || height <= 0) return;
        synchronized (captureLock) {
            if (display == null || thread == null) return;
            if (width == captureWidth && height == captureHeight) return;
            ImageReader oldReader=reader;
            ImageReader newReader=createReader(width,height);
            display.resize(width,height,captureDensity);
            display.setSurface(newReader.getSurface());
            reader=newReader;
            captureWidth=width;
            captureHeight=height;
            if (oldReader!=null) oldReader.close();
            publicStatus="active " + width + "x" + height + " • resized";
        }
    }

    private void onFrame(ImageReader r, int width, int height) {
        Image image=null;
        Bitmap padded=null;
        Bitmap cropped=null;
        try {
            image=r.acquireLatestImage();
            if (image==null || !SNAPSHOT_REQUESTED.compareAndSet(true,false)) return;
            Image.Plane plane=image.getPlanes()[0];
            ByteBuffer buffer=plane.getBuffer();
            int pixelStride=plane.getPixelStride();
            int rowStride=plane.getRowStride();
            int rowPadding=rowStride-pixelStride*width;
            padded=Bitmap.createBitmap(width+rowPadding/pixelStride,height,Bitmap.Config.ARGB_8888);
            padded.copyPixelsFromBuffer(buffer);
            cropped=Bitmap.createBitmap(padded,0,0,width,height);
            File f=getLatestSnapshotFile(this);
            boolean saved;
            try (FileOutputStream out=new FileOutputStream(f)) {
                saved=cropped.compress(Bitmap.CompressFormat.PNG,92,out);
                out.flush();
            }
            if (!saved) throw new IllegalStateException("PNG encode failed");
            long version=SNAPSHOT_VERSION.incrementAndGet();
            publicStatus="snapshot #" + version + " " + new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date()) + " • " + width + "x" + height;
        } catch (Exception e) {
            publicStatus="snapshot error: " + e.getClass().getSimpleName();
        } finally {
            if (cropped!=null) cropped.recycle();
            if (padded!=null) padded.recycle();
            if (image!=null) image.close();
        }
    }

    private void releaseCaptureResources() {
        synchronized (captureLock) {
            if (display!=null) { display.release(); display=null; }
            if (reader!=null) { reader.close(); reader=null; }
        }
    }

    @Override public void onDestroy() {
        releaseCaptureResources();
        if (projection!=null) { projection.stop(); projection=null; }
        if (thread!=null) { thread.quitSafely(); thread=null; }
        publicStatus="inactive";
        super.onDestroy();
    }

    @Override public android.os.IBinder onBind(Intent intent) { return null; }

    private void createChannel() {
        if (Build.VERSION.SDK_INT>=26) {
            NotificationChannel c=new NotificationChannel("master_capture","Master Bot Capture",NotificationManager.IMPORTANCE_LOW);
            ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private Notification notification(String text) {
        Intent i=new Intent(this,MainActivity.class);
        PendingIntent p=PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this,Build.VERSION.SDK_INT>=26?"master_capture":"")
                .setContentTitle("Master Bot Overlay")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setContentIntent(p)
                .setOngoing(true)
                .build();
    }
}
