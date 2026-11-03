package com.ydplay.masteroverlay;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.view.inputmethod.InputMethodManager;
import android.widget.*;

import com.ydplay.masteroverlay.engine.*;
import java.util.*;

public class OverlayService extends Service {
    private WindowManager wm;
    private TextView bubble;
    private LinearLayout panel;
    private WindowManager.LayoutParams bubbleParams, panelParams;
    private final PatternMemory memory = new PatternMemory();
    private final MasterAdvisor advisor = new MasterAdvisor(memory);
    private EditText handInput, jokerInput, openInput, moveInput;
    private TextView result, pattern, capture;

    @Override public void onCreate() {
        super.onCreate(); createChannel(); startForeground(41, notification());
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return; }
        wm=(WindowManager)getSystemService(WINDOW_SERVICE);
        createBubble(); createPanel();
    }

    private void createBubble() {
        bubble=new TextView(this); bubble.setText("M"); bubble.setTextSize(23); bubble.setTextColor(Color.WHITE); bubble.setGravity(Gravity.CENTER);
        bubble.setBackground(round(Color.rgb(20,145,78),100));
        int type=WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        bubbleParams=new WindowManager.LayoutParams(dp(58),dp(58),type,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.TRANSLUCENT);
        bubbleParams.gravity=Gravity.TOP|Gravity.START; bubbleParams.x=dp(12); bubbleParams.y=dp(180);
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

    private void createPanel() {
        panel=new LinearLayout(this); panel.setOrientation(LinearLayout.VERTICAL); panel.setPadding(dp(14),dp(12),dp(14),dp(12)); panel.setBackground(round(Color.rgb(250,252,250),24));
        TextView title=label("MASTER BOT • TEST MODE",18,Color.rgb(18,100,55)); panel.addView(title, lp());
        result=label("Enter your 13/14 cards, joker and open card.",14,Color.BLACK); result.setPadding(0,dp(8),0,dp(8)); panel.addView(result,lp());
        handInput=input("Hand: AS,2S,3S,...",true); panel.addView(handInput,lp());
        LinearLayout row=new LinearLayout(this); row.setOrientation(LinearLayout.HORIZONTAL);
        jokerInput=input("Joker rank",false); openInput=input("Open card",false); row.addView(jokerInput,new LinearLayout.LayoutParams(0,dp(48),1)); row.addView(openInput,new LinearLayout.LayoutParams(0,dp(48),1)); panel.addView(row,lp());
        LinearLayout actions=new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.addView(btn("Analyze",v->analyze()),new LinearLayout.LayoutParams(0,dp(48),1));
        actions.addView(btn("Snapshot",v->{CaptureService.requestSnapshot(); updateCapture();}),new LinearLayout.LayoutParams(0,dp(48),1));
        panel.addView(actions,lp());
        moveInput=input("P2 PICK 8H / P2 DISCARD 9H",false); panel.addView(moveInput,lp());
        panel.addView(btn("Log visible opponent move",v->logMove()),lp());
        pattern=label("Pattern memory: 0 moves",13,Color.DKGRAY); pattern.setPadding(0,dp(8),0,0); panel.addView(pattern,lp());
        capture=label("Capture: "+CaptureService.getPublicStatus(),12,Color.DKGRAY); panel.addView(capture,lp());
        LinearLayout bottom=new LinearLayout(this); bottom.setOrientation(LinearLayout.HORIZONTAL);
        bottom.addView(btn("Minimize",v->hidePanel()),new LinearLayout.LayoutParams(0,dp(46),1));
        bottom.addView(btn("Stop",v->stopSelf()),new LinearLayout.LayoutParams(0,dp(46),1)); panel.addView(bottom,lp());

        panelParams=new WindowManager.LayoutParams(dp(350),WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,android.graphics.PixelFormat.TRANSLUCENT);
        panelParams.gravity=Gravity.TOP|Gravity.START; panelParams.x=dp(8); panelParams.y=dp(80);
        panel.setVisibility(View.GONE); wm.addView(panel,panelParams);
    }

    private void showPanel() { panel.setVisibility(View.VISIBLE); bubble.setVisibility(View.GONE); panel.requestFocus(); updateCapture(); }
    private void hidePanel() { hideKeyboard(); panel.setVisibility(View.GONE); bubble.setVisibility(View.VISIBLE); }

    private void analyze() {
        try {
            List<Card> hand=parseCards(handInput.getText().toString());
            String wild=jokerInput.getText().toString().trim().toUpperCase(Locale.ROOT);
            if (!isRank(wild)) throw new IllegalArgumentException("Joker rank must be A,2..10,J,Q,K");
            Card open=null; String os=openInput.getText().toString().trim(); if (!os.isEmpty()) open=Card.parse(os,"open");
            Recommendation r=advisor.advise(hand,open,wild);
            String headline = r.drawChoice().equals("OPEN") ? "PICK OPEN" : r.drawChoice().equals("CLOSED") ? "PICK CLOSED" : "DISCARD " + (r.discard()==null?"?":r.discard().key());
            result.setText(headline + "\n" + r.reason());
            if (r.validDeclaration()) result.setText(result.getText()+"\n✓ VALID DECLARATION READY");
        } catch(Exception e) { result.setText("Input error: "+e.getMessage()); }
    }

    private void logMove() {
        try {
            String[] p=moveInput.getText().toString().trim().toUpperCase(Locale.ROOT).split("\\s+");
            if (p.length!=3) throw new IllegalArgumentException("Use: P2 PICK 8H");
            PatternMemory.Action a = p[1].startsWith("PICK") ? PatternMemory.Action.PICK_OPEN : p[1].startsWith("DISCARD") ? PatternMemory.Action.DISCARD : null;
            if (a==null) throw new IllegalArgumentException("Action must be PICK or DISCARD");
            memory.observe(p[0],a,Card.parse(p[2],"m"+System.nanoTime()));
            moveInput.setText("");
            Map<String,Double> top=memory.topRisks(4); StringBuilder sb=new StringBuilder("Pattern memory: ").append(memory.observations()).append(" moves");
            if (!top.isEmpty()) { sb.append("\nDanger: "); for (Map.Entry<String,Double> e: top.entrySet()) sb.append(e.getKey()).append(' ').append(Math.round(e.getValue()*100)).append("%  "); }
            pattern.setText(sb.toString());
        } catch(Exception e) { pattern.setText("Move error: "+e.getMessage()); }
    }

    private List<Card> parseCards(String csv) {
        List<Card> out=new ArrayList<>(); if (csv==null||csv.isBlank()) throw new IllegalArgumentException("Enter hand cards");
        int i=0; for(String s:csv.split(",")) if(!s.trim().isEmpty()) out.add(Card.parse(s.trim(),"h"+(i++)));
        if(out.size()!=13 && out.size()!=14) throw new IllegalArgumentException("Need exactly 13 or 14 cards; got "+out.size());
        return out;
    }
    private boolean isRank(String r) { for(String x:Card.RANKS) if(x.equals(r)) return true; return false; }
    private void updateCapture() { capture.setText("Capture: "+CaptureService.getPublicStatus()); }
    private EditText input(String hint, boolean multi) { EditText e=new EditText(this); e.setHint(hint); e.setTextSize(13); e.setSingleLine(!multi); if(multi)e.setMinLines(2); return e; }
    private Button btn(String s, View.OnClickListener l) { Button b=new Button(this); b.setText(s); b.setTextSize(12); b.setAllCaps(false); b.setOnClickListener(l); return b; }
    private TextView label(String s,int sp,int color) { TextView t=new TextView(this);t.setText(s);t.setTextSize(sp);t.setTextColor(color);return t; }
    private LinearLayout.LayoutParams lp(){return new LinearLayout.LayoutParams(-1,-2);}
    private int dp(int v){return Math.round(v*getResources().getDisplayMetrics().density);}
    private GradientDrawable round(int color,int radius){GradientDrawable g=new GradientDrawable();g.setColor(color);g.setCornerRadius(dp(radius));return g;}
    private void hideKeyboard(){InputMethodManager im=(InputMethodManager)getSystemService(INPUT_METHOD_SERVICE); im.hideSoftInputFromWindow(panel.getWindowToken(),0);}

    @Override public void onDestroy() {
        if(wm!=null){ try{if(bubble!=null)wm.removeView(bubble);}catch(Exception ignored){} try{if(panel!=null)wm.removeView(panel);}catch(Exception ignored){} }
        super.onDestroy();
    }
    @Override public android.os.IBinder onBind(Intent intent){return null;}

    private void createChannel(){if(Build.VERSION.SDK_INT>=26){NotificationChannel c=new NotificationChannel("master_overlay","Master Bot Overlay",NotificationManager.IMPORTANCE_LOW);((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);}}
    private Notification notification(){Intent i=new Intent(this,MainActivity.class);PendingIntent p=PendingIntent.getActivity(this,0,i,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);return new Notification.Builder(this,Build.VERSION.SDK_INT>=26?"master_overlay":"").setContentTitle("Master Bot Overlay").setContentText("Floating recommendation panel is running").setSmallIcon(android.R.drawable.ic_menu_info_details).setContentIntent(p).setOngoing(true).build();}
}
