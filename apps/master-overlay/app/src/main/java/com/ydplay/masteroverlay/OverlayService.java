package com.ydplay.masteroverlay;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;

import com.ydplay.masteroverlay.engine.*;
import com.ydplay.masteroverlay.scan.AutoScanResult;
import com.ydplay.masteroverlay.scan.ScreenOcrScanner;
import com.ydplay.masteroverlay.state.LiveGameBrain;
import com.ydplay.masteroverlay.state.LiveScanPolicy;
import com.ydplay.masteroverlay.state.StableGameState;
import com.ydplay.masteroverlay.ui.DecisionPresenter;
import com.ydplay.masteroverlay.ui.PrimaryDecision;

import java.io.File;
import java.util.*;

public class OverlayService extends Service {
    private static final int SCAN_MAX_POLLS = 18;
    private static final long SCAN_POLL_MS = 150L;
    private static final long LIVE_TICK_MS = 250L;

    private WindowManager wm;
    private TextView bubble;
    private TextView livePill;
    private LinearLayout panel;
    private LinearLayout detailsBox;
    private LinearLayout manualBox;
    private WindowManager.LayoutParams bubbleParams, pillParams, panelParams;

    private final LiveGameBrain gameBrain = new LiveGameBrain();
    private final PatternMemory memory = gameBrain.memory();
    private final MasterAdvisor advisor = new MasterAdvisor(memory);
    private final DecisionPresenter manualPresenter = new DecisionPresenter();
    private final LiveScanPolicy livePolicy = LiveScanPolicy.defaultPolicy();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ScreenOcrScanner scanner;
    private EditText handInput, jokerInput, openInput, moveInput;
    private TextView actionHeadline, actionReason, whyText, pattern, capture, scanStatus;
    private Button liveButton;

    private boolean scanInProgress;
    private boolean liveEnabled;
    private long lastScanCompletedMs;
    private boolean currentScanFromLive;
    private PrimaryDecision currentDecision = new PrimaryDecision(
            PrimaryDecision.Action.UNCERTAIN,
            "SCAN UNCERTAIN — DON'T ACT",
            null,
            "Start Live Scan after Screen Capture permission is active.",
            "No stable state yet.",
            PrimaryDecision.Severity.STOP);

    private final Runnable liveTick = new Runnable() {
        @Override public void run() {
            if (!liveEnabled) return;
            long now = SystemClock.elapsedRealtime();
            if (livePolicy.shouldStart(true, scanInProgress, now, lastScanCompletedMs)) requestScan(true);
            mainHandler.postDelayed(this, LIVE_TICK_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(41, notification());
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return; }
        scanner = new ScreenOcrScanner();
        wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        createBubble();
        createLivePill();
        createPanel();
        renderDecision(currentDecision);
    }

    private void createBubble() {
        bubble=new TextView(this);
        bubble.setText("M");
        bubble.setTextSize(23);
        bubble.setTextColor(Color.WHITE);
        bubble.setTypeface(null, Typeface.BOLD);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackground(round(Color.rgb(20,145,78),100));
        bubbleParams=new WindowManager.LayoutParams(dp(58),dp(58),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                android.graphics.PixelFormat.TRANSLUCENT);
        bubbleParams.gravity=Gravity.TOP|Gravity.START;
        bubbleParams.x=dp(12);
        bubbleParams.y=dp(145);
        final int[] down={0,0,0,0};
        bubble.setOnTouchListener((v,e)->{
            switch(e.getAction()) {
                case MotionEvent.ACTION_DOWN -> { down[0]=(int)e.getRawX(); down[1]=(int)e.getRawY(); down[2]=bubbleParams.x; down[3]=bubbleParams.y; return true; }
                case MotionEvent.ACTION_MOVE -> { bubbleParams.x=down[2]+(int)e.getRawX()-down[0]; bubbleParams.y=down[3]+(int)e.getRawY()-down[1]; wm.updateViewLayout(bubble,bubbleParams); return true; }
                case MotionEvent.ACTION_UP -> { if (Math.abs((int)e.getRawX()-down[0])<12 && Math.abs((int)e.getRawY()-down[1])<12) showPanel(); return true; }
            }
            return false;
        });
        wm.addView(bubble,bubbleParams);
    }

    private void createLivePill() {
        livePill=new TextView(this);
        livePill.setTextSize(13);
        livePill.setTextColor(Color.WHITE);
        livePill.setTypeface(null,Typeface.BOLD);
        livePill.setGravity(Gravity.CENTER_VERTICAL);
        livePill.setPadding(dp(12),0,dp(12),0);
        livePill.setMaxLines(2);
        livePill.setBackground(round(Color.rgb(35,90,55),16));
        livePill.setOnClickListener(v -> {
            stopLiveScan();
            showPanel();
        });
        pillParams=new WindowManager.LayoutParams(dp(275),dp(60),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                android.graphics.PixelFormat.TRANSLUCENT);
        pillParams.gravity=Gravity.TOP|Gravity.START;
        pillParams.x=dp(8);
        pillParams.y=dp(8);
        livePill.setVisibility(View.GONE);
        wm.addView(livePill,pillParams);
    }

    private void createPanel() {
        panel=new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(dp(14),dp(12),dp(14),dp(12));
        panel.setBackground(round(Color.rgb(250,252,250),24));

        TextView title=label("MASTER BOT • GAME BRAIN",17,Color.rgb(18,100,55));
        title.setTypeface(null,Typeface.BOLD);
        panel.addView(title,lp());

        actionHeadline=label("SCAN UNCERTAIN — DON'T ACT",22,Color.rgb(90,25,25));
        actionHeadline.setTypeface(null,Typeface.BOLD);
        actionHeadline.setPadding(0,dp(10),0,dp(4));
        panel.addView(actionHeadline,lp());

        actionReason=label("Need a stable scan before advice.",14,Color.DKGRAY);
        actionReason.setPadding(0,0,0,dp(10));
        panel.addView(actionReason,lp());

        LinearLayout mainActions=new LinearLayout(this);
        mainActions.setOrientation(LinearLayout.HORIZONTAL);
        liveButton=btn("Live Scan: OFF",v->toggleLiveScan());
        mainActions.addView(liveButton,new LinearLayout.LayoutParams(0,dp(48),1));
        mainActions.addView(btn("Scan Now",v->requestScan(false)),new LinearLayout.LayoutParams(0,dp(48),1));
        panel.addView(mainActions,lp());

        LinearLayout secondary=new LinearLayout(this);
        secondary.setOrientation(LinearLayout.HORIZONTAL);
        secondary.addView(btn("Why?",v->toggle(detailsBox)),new LinearLayout.LayoutParams(0,dp(44),1));
        secondary.addView(btn("Manual",v->toggle(manualBox)),new LinearLayout.LayoutParams(0,dp(44),1));
        panel.addView(secondary,lp());

        detailsBox=new LinearLayout(this);
        detailsBox.setOrientation(LinearLayout.VERTICAL);
        detailsBox.setVisibility(View.GONE);
        whyText=label("No stable state yet.",12,Color.DKGRAY);
        whyText.setPadding(0,dp(8),0,dp(4));
        detailsBox.addView(whyText,lp());
        scanStatus=label("Scanner: ready",12,Color.DKGRAY);
        detailsBox.addView(scanStatus,lp());
        pattern=label("Opponent memory: 0 visible moves",12,Color.DKGRAY);
        detailsBox.addView(pattern,lp());
        capture=label("Capture: "+CaptureService.getPublicStatus(),12,Color.DKGRAY);
        detailsBox.addView(capture,lp());
        panel.addView(detailsBox,lp());

        manualBox=new LinearLayout(this);
        manualBox.setOrientation(LinearLayout.VERTICAL);
        manualBox.setVisibility(View.GONE);
        TextView manualTitle=label("Manual fallback",13,Color.DKGRAY);
        manualTitle.setTypeface(null,Typeface.BOLD);
        manualTitle.setPadding(0,dp(8),0,0);
        manualBox.addView(manualTitle,lp());
        handInput=input("Hand: AS,2S,3S,...",true);
        manualBox.addView(handInput,lp());
        LinearLayout row=new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        jokerInput=input("Joker rank",false);
        openInput=input("Open card",false);
        row.addView(jokerInput,new LinearLayout.LayoutParams(0,dp(48),1));
        row.addView(openInput,new LinearLayout.LayoutParams(0,dp(48),1));
        manualBox.addView(row,lp());
        manualBox.addView(btn("Analyze manual state",v->analyzeManual()),lp());
        manualBox.addView(btn("Snapshot only",v->{CaptureService.requestSnapshot(); updateCapture();}),lp());
        moveInput=input("Optional: P2 PICK 8H / P2 DISCARD 9H",false);
        manualBox.addView(moveInput,lp());
        manualBox.addView(btn("Add visible move manually",v->logMove()),lp());
        panel.addView(manualBox,lp());

        LinearLayout bottom=new LinearLayout(this);
        bottom.setOrientation(LinearLayout.HORIZONTAL);
        bottom.addView(btn("Minimize",v->hidePanel()),new LinearLayout.LayoutParams(0,dp(44),1));
        bottom.addView(btn("Stop",v->stopSelf()),new LinearLayout.LayoutParams(0,dp(44),1));
        panel.addView(bottom,lp());

        panelParams=new WindowManager.LayoutParams(dp(360),WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                android.graphics.PixelFormat.TRANSLUCENT);
        panelParams.gravity=Gravity.TOP|Gravity.START;
        panelParams.x=dp(8);
        panelParams.y=dp(26);
        panel.setVisibility(View.GONE);
        wm.addView(panel,panelParams);
    }

    private void showPanel() {
        if (liveEnabled) stopLiveScan();
        panel.setVisibility(View.VISIBLE);
        bubble.setVisibility(View.GONE);
        livePill.setVisibility(View.GONE);
        panel.requestFocus();
        updateCapture();
        updatePatternText();
    }

    private void hidePanel() {
        hideKeyboard();
        panel.setVisibility(View.GONE);
        if (liveEnabled) {
            bubble.setVisibility(View.GONE);
            livePill.setVisibility(View.VISIBLE);
        } else {
            livePill.setVisibility(View.GONE);
            bubble.setVisibility(View.VISIBLE);
        }
    }

    private void toggleLiveScan() {
        if (liveEnabled) {
            stopLiveScan();
            return;
        }
        String status=CaptureService.getPublicStatus();
        if (status == null || status.startsWith("inactive") || status.startsWith("permission")) {
            renderDecision(new PrimaryDecision(
                    PrimaryDecision.Action.UNCERTAIN,
                    "SCREEN CAPTURE NEEDED",
                    null,
                    "Open the launcher and grant Screen Capture, then start Live Scan.",
                    "Capture: "+status,
                    PrimaryDecision.Severity.STOP));
            return;
        }
        liveEnabled=true;
        liveButton.setText("Live Scan: ON");
        panel.setVisibility(View.GONE);
        bubble.setVisibility(View.GONE);
        livePill.setVisibility(View.VISIBLE);
        livePill.setText("MASTER • LIVE\nStabilizing table state…");
        lastScanCompletedMs=0L;
        mainHandler.removeCallbacks(liveTick);
        mainHandler.post(liveTick);
    }

    private void stopLiveScan() {
        liveEnabled=false;
        mainHandler.removeCallbacks(liveTick);
        if (liveButton!=null) liveButton.setText("Live Scan: OFF");
        if (livePill!=null) livePill.setVisibility(View.GONE);
        if (panel!=null && panel.getVisibility()!=View.VISIBLE && bubble!=null) bubble.setVisibility(View.VISIBLE);
    }

    private void requestScan(boolean fromLive) {
        if (scanInProgress) return;
        scanInProgress=true;
        currentScanFromLive=fromLive;
        long baseline=CaptureService.getLatestSnapshotVersion();
        if (scanStatus!=null) scanStatus.setText("Scanner: capturing clean game frame…");

        if (fromLive) {
            panel.setVisibility(View.GONE);
            bubble.setVisibility(View.GONE);
            livePill.setVisibility(View.VISIBLE);
        } else {
            panel.setVisibility(View.GONE);
            bubble.setVisibility(View.GONE);
            livePill.setVisibility(View.GONE);
        }

        CaptureService.requestSnapshot();
        pollFreshSnapshot(baseline,0,fromLive);
    }

    private void pollFreshSnapshot(long baseline,int attempt,boolean fromLive) {
        mainHandler.postDelayed(() -> {
            if (!scanInProgress) return;
            long current=CaptureService.getLatestSnapshotVersion();
            File file=CaptureService.getLatestSnapshotFile(this);
            if (current>baseline && file.isFile()) {
                restoreAfterCapture(fromLive);
                if (scanStatus!=null) scanStatus.setText("Scanner: reading frame #"+current+"…");
                scanner.scan(file,new ScreenOcrScanner.Callback(){
                    @Override public void onSuccess(AutoScanResult scan){ mainHandler.post(() -> applyScan(scan,fromLive)); }
                    @Override public void onError(String message){ mainHandler.post(() -> finishScanError(message,fromLive)); }
                });
                return;
            }
            if (attempt+1<SCAN_MAX_POLLS) pollFreshSnapshot(baseline,attempt+1,fromLive);
            else finishScanError("No fresh frame. Renew Screen Capture permission.",fromLive);
        },SCAN_POLL_MS);
    }

    private void restoreAfterCapture(boolean fromLive) {
        if (fromLive && liveEnabled) {
            panel.setVisibility(View.GONE);
            bubble.setVisibility(View.GONE);
            livePill.setVisibility(View.VISIBLE);
        } else {
            panel.setVisibility(View.VISIBLE);
            bubble.setVisibility(View.GONE);
            livePill.setVisibility(View.GONE);
        }
    }

    private void applyScan(AutoScanResult scan,boolean fromLive) {
        scanInProgress=false;
        lastScanCompletedMs=SystemClock.elapsedRealtime();
        currentScanFromLive=false;
        if (scan==null) { finishScanError("Scanner returned no state",fromLive); return; }

        if (!scan.handCards().isEmpty()) handInput.setText(String.join(",",scan.handCards()));
        if (scan.openCard()!=null) openInput.setText(scan.openCard());
        if (scan.jokerRank()!=null) jokerInput.setText(scan.jokerRank());

        PrimaryDecision decision=gameBrain.observe(scan,System.currentTimeMillis());
        renderDecision(decision);

        String confidence=String.format(Locale.US,"%.0f%%",scan.confidence()*100.0);
        scanStatus.setText("Scanner: "+scan.handCards().size()+" cards • "+confidence+" • "+scan.turnPhase()
                +(scan.openCard()==null?"":" • open "+scan.openCard())
                +(scan.jokerRank()==null?"":" • joker "+scan.jokerRank()));
        updatePatternText();
        updateCapture();
        restoreAfterCapture(fromLive && liveEnabled);
    }

    private void finishScanError(String message,boolean fromLive) {
        scanInProgress=false;
        lastScanCompletedMs=SystemClock.elapsedRealtime();
        currentScanFromLive=false;
        if (scanStatus!=null) scanStatus.setText("Scanner: "+message);
        renderDecision(new PrimaryDecision(
                PrimaryDecision.Action.UNCERTAIN,
                "SCAN UNCERTAIN — DON'T ACT",
                null,
                message,
                "Capture: "+CaptureService.getPublicStatus(),
                PrimaryDecision.Severity.STOP));
        restoreAfterCapture(fromLive && liveEnabled);
    }

    private void analyzeManual() {
        try {
            List<Card> hand=parseCards(handInput.getText().toString());
            String wild=jokerInput.getText().toString().trim().toUpperCase(Locale.ROOT);
            if (!isRank(wild)) throw new IllegalArgumentException("Joker rank must be A,2..10,J,Q,K");
            Card open=null;
            String os=openInput.getText().toString().trim();
            if (!os.isEmpty()) open=Card.parse(os,"manual-open");
            Recommendation r=advisor.advise(hand,open,wild);
            List<String> codes=new ArrayList<>();
            for (Card c:hand) codes.add(c.key());
            StableGameState state=new StableGameState(codes,open==null?null:open.key(),wild,1.0,System.currentTimeMillis());
            gameBrain.ledger().refreshOwnHand(codes);
            if (open!=null) gameBrain.ledger().observeVisibleCard(open.key());
            PrimaryDecision d=manualPresenter.present(state,r,memory,gameBrain.ledger());
            renderDecision(d);
            updatePatternText();
        } catch(Exception e) {
            renderDecision(new PrimaryDecision(
                    PrimaryDecision.Action.UNCERTAIN,
                    "CHECK MANUAL INPUT",
                    null,
                    e.getMessage()==null?"Invalid card state":e.getMessage(),
                    "Manual mode does not bypass Rummy legality checks.",
                    PrimaryDecision.Severity.STOP));
        }
    }

    private void logMove() {
        try {
            String[] p=moveInput.getText().toString().trim().toUpperCase(Locale.ROOT).split("\\s+");
            if (p.length!=3) throw new IllegalArgumentException("Use: P2 PICK 8H");
            PatternMemory.Action a=p[1].startsWith("PICK")?PatternMemory.Action.PICK_OPEN:p[1].startsWith("DISCARD")?PatternMemory.Action.DISCARD:null;
            if (a==null) throw new IllegalArgumentException("Action must be PICK or DISCARD");
            Card card=Card.parse(p[2],"manual-move-"+System.nanoTime());
            memory.observe(p[0],a,card);
            gameBrain.ledger().observeVisibleCard(card.key());
            moveInput.setText("");
            updatePatternText();
        } catch(Exception e) {
            pattern.setText("Move error: "+e.getMessage());
        }
    }

    private void renderDecision(PrimaryDecision decision) {
        if (decision==null) return;
        currentDecision=decision;
        if (actionHeadline!=null) actionHeadline.setText(decision.headline());
        if (actionReason!=null) actionReason.setText(decision.reason());
        if (whyText!=null) whyText.setText(decision.details());

        int panelColor;
        int pillColor;
        int textColor;
        switch(decision.severity()) {
            case GO -> { panelColor=Color.rgb(232,247,237); pillColor=Color.rgb(18,125,67); textColor=Color.rgb(12,90,48); }
            case CAUTION -> { panelColor=Color.rgb(255,248,225); pillColor=Color.rgb(164,112,15); textColor=Color.rgb(115,75,5); }
            default -> { panelColor=Color.rgb(255,235,235); pillColor=Color.rgb(150,40,40); textColor=Color.rgb(105,25,25); }
        }
        if (actionHeadline!=null) {
            actionHeadline.setTextColor(textColor);
            actionHeadline.setBackground(round(panelColor,12));
            actionHeadline.setPadding(dp(8),dp(8),dp(8),dp(8));
        }
        if (livePill!=null) {
            livePill.setBackground(round(pillColor,16));
            livePill.setText(decision.headline()+"\n"+shortReason(decision.reason()));
        }
    }

    private static String shortReason(String reason) {
        if (reason==null) return "";
        String one=reason.replace('\n',' ').trim();
        return one.length()<=70?one:one.substring(0,67)+"…";
    }

    private void updatePatternText() {
        if (pattern==null) return;
        Map<String,Double> top=memory.topRisks(4);
        StringBuilder sb=new StringBuilder("Opponent memory: ").append(memory.observations()).append(" visible moves");
        if (!top.isEmpty()) {
            sb.append("\nDanger: ");
            for (Map.Entry<String,Double> e:top.entrySet()) sb.append(e.getKey()).append(' ').append(Math.round(e.getValue()*100)).append("%  ");
        }
        sb.append("\nKnown ").append(gameBrain.ledger().knownTotal()).append(" • unseen ").append(gameBrain.ledger().unseenTotal());
        pattern.setText(sb.toString());
    }

    private List<Card> parseCards(String csv) {
        List<Card> out=new ArrayList<>();
        if (csv==null||csv.isBlank()) throw new IllegalArgumentException("Enter hand cards");
        int i=0;
        for(String s:csv.split(",")) if(!s.trim().isEmpty()) out.add(Card.parse(s.trim(),"manual-"+(i++)));
        if(out.size()!=13 && out.size()!=14) throw new IllegalArgumentException("Need exactly 13 or 14 cards; got "+out.size());
        return out;
    }

    private boolean isRank(String r) { for(String x:Card.RANKS) if(x.equals(r)) return true; return false; }

    private void updateCapture() { if (capture!=null) capture.setText("Capture: "+CaptureService.getPublicStatus()); }

    private void toggle(View view) { if (view!=null) view.setVisibility(view.getVisibility()==View.VISIBLE?View.GONE:View.VISIBLE); }

    private EditText input(String hint,boolean multi) {
        EditText e=new EditText(this); e.setHint(hint); e.setTextSize(13); e.setSingleLine(!multi); if(multi)e.setMinLines(2); return e;
    }
    private Button btn(String s,View.OnClickListener l) {
        Button b=new Button(this); b.setText(s); b.setTextSize(12); b.setAllCaps(false); b.setOnClickListener(l); return b;
    }
    private TextView label(String s,int sp,int color) { TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(color);return t; }
    private LinearLayout.LayoutParams lp(){return new LinearLayout.LayoutParams(-1,-2);}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    private GradientDrawable round(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));return g;}
    private void hideKeyboard(){if(panel==null)return;InputMethodManager im=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);im.hideSoftInputFromWindow(panel.getWindowToken(),0);}

    @Override public void onDestroy() {
        liveEnabled=false;
        scanInProgress=false;
        mainHandler.removeCallbacksAndMessages(null);
        if(scanner!=null){scanner.close();scanner=null;}
        if(wm!=null){
            try{if(bubble!=null)wm.removeView(bubble);}catch(Exception ignored){}
            try{if(livePill!=null)wm.removeView(livePill);}catch(Exception ignored){}
            try{if(panel!=null)wm.removeView(panel);}catch(Exception ignored){}
        }
        super.onDestroy();
    }

    @Override public android.os.IBinder onBind(Intent intent){return null;}

    private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel("master_overlay","Master Bot Overlay",NotificationManager.IMPORTANCE_LOW);((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);}}
    private Notification notification(){Intent i=new Intent(this,MainActivity.class);PendingIntent p=PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);return new Notification.Builder(this,Build.VERSION.SDK_INT>=26?"master_overlay":"").setContentTitle("Master Bot Overlay").setContentText("Recommendation-only Game Brain is running").setSmallIcon(android.R.drawable.ic_menu_info_details).setContentIntent(p).setOngoing(true).build();}
}
