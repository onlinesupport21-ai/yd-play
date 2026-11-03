package com.ydplay.masteroverlay;

import android.app.*;
import android.content.*;
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

public class CaptureService extends Service {
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    private static final AtomicBoolean SNAPSHOT_REQUESTED = new AtomicBoolean(false);
    private static volatile String publicStatus = "inactive";
    private MediaProjection projection;
    private ImageReader reader;
    private VirtualDisplay display;
    private HandlerThread thread;

    public static String getPublicStatus() { return publicStatus; }
    public static void requestSnapshot() { SNAPSHOT_REQUESTED.set(true); publicStatus = "snapshot requested"; }

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
            @Override public void onStop() { publicStatus="capture stopped by system"; stopSelf(); }
        }, new Handler(Looper.getMainLooper()));

        DisplayMetrics dm=new DisplayMetrics();
        WindowManager wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Rect b=wm.getCurrentWindowMetrics().getBounds();
            dm.widthPixels=b.width(); dm.heightPixels=b.height(); dm.densityDpi=getResources().getDisplayMetrics().densityDpi;
        } else {
            wm.getDefaultDisplay().getRealMetrics(dm);
        }
        int w=dm.widthPixels, h=dm.heightPixels, density=dm.densityDpi;
        reader=ImageReader.newInstance(w,h,PixelFormat.RGBA_8888,2);
        thread=new HandlerThread("MasterCapture"); thread.start();
        reader.setOnImageAvailableListener(r -> onFrame(r,w,h), new Handler(thread.getLooper()));
        display=projection.createVirtualDisplay("MasterBotCapture",w,h,density,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader.getSurface(),null,null);
        publicStatus="active " + w + "x" + h;
        return START_STICKY;
    }

    private void onFrame(ImageReader r, int width, int height) {
        Image image=null;
        try {
            image=r.acquireLatestImage();
            if (image==null || !SNAPSHOT_REQUESTED.compareAndSet(true,false)) return;
            Image.Plane plane=image.getPlanes()[0];
            ByteBuffer buffer=plane.getBuffer();
            int pixelStride=plane.getPixelStride();
            int rowStride=plane.getRowStride();
            int rowPadding=rowStride-pixelStride*width;
            Bitmap padded=Bitmap.createBitmap(width+rowPadding/pixelStride,height,Bitmap.Config.ARGB_8888);
            padded.copyPixelsFromBuffer(buffer);
            Bitmap cropped=Bitmap.createBitmap(padded,0,0,width,height);
            padded.recycle();
            File f=new File(getCacheDir(),"master_snapshot.png");
            try (FileOutputStream out=new FileOutputStream(f)) { cropped.compress(Bitmap.CompressFormat.PNG,92,out); }
            cropped.recycle();
            publicStatus="snapshot " + new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date()) + " • " + width + "x" + height;
        } catch (Exception e) {
            publicStatus="snapshot error: " + e.getClass().getSimpleName();
        } finally { if (image!=null) image.close(); }
    }

    @Override public void onDestroy() {
        if (display!=null) display.release();
        if (reader!=null) reader.close();
        if (projection!=null) projection.stop();
        if (thread!=null) thread.quitSafely();
        projection=null; publicStatus="inactive"; super.onDestroy();
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
                .setContentTitle("Master Bot Overlay").setContentText(text).setSmallIcon(android.R.drawable.ic_menu_camera).setContentIntent(p).setOngoing(true).build();
    }
}
