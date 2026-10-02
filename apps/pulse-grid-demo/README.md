# Pulse Grid development client

Serve this folder from localhost so browser CORS rules are predictable:

```bash
cd apps/pulse-grid-demo
python3 -m http.server 5173
```

Open `http://localhost:5173`, paste a valid access token, then start the game.
The visual client never decides score or coin rewards; it only submits ordered inputs.
