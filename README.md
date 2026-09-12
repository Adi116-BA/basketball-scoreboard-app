# Basketball Scoreboard PWA - Complete Implementation

A fully-featured basketball scoreboard application with **PIN-authenticated remote control**, **real-time multi-device synchronization via PeerJS**, and **complete PWA support** for offline functionality.

## 🎯 Features

### Core Scoreboard Features
- ✅ Real-time score tracking for two teams
- ✅ Fouls and timeouts management
- ✅ Game clock (12:00 default, configurable)
- ✅ Shot clock (24 sec default, configurable)
- ✅ Fullscreen display mode
- ✅ Local storage persistence
- ✅ Keyboard shortcuts support

### Security & Authentication
- ✅ **4-digit PIN authentication** - generated on app load, displayed on scoreboard
- ✅ **PIN entry validation** - controllers must authenticate before accessing controls
- ✅ **Failed attempt tracking** - automatic disconnection after 3 failed attempts
- ✅ **Connection status monitoring** - shows authenticated controller count
- ✅ **Command blocking** - all game commands blocked from unauthenticated connections

### Remote Control (Multi-Device)
- ✅ **PeerJS integration** - P2P connection between scoreboard and smartphone controllers
- ✅ **Real-time state synchronization** - game state broadcast to all authenticated controllers
- ✅ **Multiple concurrent controllers** - support for multiple simultaneous remote users
- ✅ **Connection lifecycle management** - track, authenticate, and remove connections
- ✅ **Command acknowledgment** - controllers receive feedback on command execution

### Progressive Web App (PWA)
- ✅ **Installable to home screen** - iOS, Android, and desktop
- ✅ **Offline support** - complete app functionality without internet
- ✅ **Service Worker caching** - Cache-First strategy with Network fallback
- ✅ **External CDN caching** - PeerJS and QRCode.js libraries pre-cached
- ✅ **Adaptive icons** - maskable icon support for modern devices
- ✅ **Full manifest configuration** - app name, colors, display modes

### Responsive Design
- ✅ Portrait mode for mobile devices
- ✅ Landscape mode optimized for displays
- ✅ Tablet-friendly layouts
- ✅ Fullscreen presentation mode

---

## 📁 Project Structure

```
basketball-scoreboard-app/
├── index.html                          # Main scoreboard (host display)
├── controller.html                     # Smartphone remote controller
├── sw.js                               # Service Worker (offline caching)
├── manifest.json                       # PWA configuration
├── PEERJS_PIN_AUTHENTICATION_GUIDE.md  # Complete technical documentation
├── QUICK_START.md                      # 5-minute setup guide
├── README.md                           # This file
└── images/
    ├── icon-192.png                    # App icon (192x192)
    ├── icon-192-maskable.png           # Maskable icon (192x192)
    ├── icon-512.png                    # App icon (512x512)
    └── icon-512-maskable.png           # Maskable icon (512x512)
```

---

## 🚀 Quick Start

### Prerequisites
- HTTPS hosting (required for PWA & Service Worker)
- Modern browser (Chrome, Firefox, Safari, Edge)
- Internet connection (for initial setup and PeerJS)

### 5-Minute Setup

1. **Deploy files to HTTPS server**
   ```bash
   # Files needed:
   - index.html (scoreboard)
   - controller.html (remote)
   - sw.js (service worker)
   - manifest.json (PWA config)
   - images/ (app icons)
   ```

2. **Open scoreboard in browser**
   ```
   https://your-domain.com/index.html
   ```
   - PIN is automatically generated and displayed
   - Scoreboard Peer ID shown in console

3. **Open controller on smartphone**
   ```
   https://your-domain.com/controller.html
   ```
   - Enter Scoreboard Peer ID
   - Enter PIN from scoreboard display
   - Control game remotely

4. **Install as PWA (Optional)**
   - Android: Chrome menu → "Install app"
   - iOS: Safari Share → "Add to Home Screen"

**For detailed setup, see [QUICK_START.md](QUICK_START.md)**

---

## 🔐 PIN Authentication Flow

### High-Level Flow

```
1. Scoreboard generates random 4-digit PIN (e.g., "4829")
   └─ Displayed as: ●●●● on scoreboard display
   
2. Controller connects via PeerJS
   └─ Shows PIN entry screen with numpad
   
3. User enters PIN on controller
   └─ Sends: { type: 'AUTHENTICATE', pin: '4829' }
   
4. Scoreboard validates PIN
   └─ If correct: AUTHENTICATED → show game controls
   └─ If wrong: show error → allow retry (max 3 attempts)
   └─ After 3 failures: LOCKED → force disconnect
   
5. Authenticated controller receives game commands
   └─ Commands like SCORE_HOME, FOUL_AWAY, TOGGLE_GAME_CLOCK accepted
   └─ Unauthenticated commands are blocked
   
6. All authenticated controllers receive state updates
   └─ Broadcast when: score changes, clock updates, fouls added, etc.
```

### Security Features

- **PIN Display**: Only shown on scoreboard, not transmitted to controllers
- **Connection Isolation**: Each controller tracked independently
- **Attempt Limiting**: Auto-disconnect after 3 failed PIN attempts
- **WebRTC Encryption**: PeerJS DataChannel uses DTLS for encryption
- **Stateless Design**: No server-side storage needed

---

## 📱 Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│              SCOREBOARD HOST (index.html)            │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  Generated PIN: ●●●●  (e.g., 4829)          │  │
│  │  Connected: 0/0 authorized                   │  │
│  ├──────────────────────────────────────────────┤  │
│  │  Score Display & Game Controls               │  │
│  │  - Team 1: 45 | Team 2: 38                  │  │
│  │  - Clock: 12:00 | Shot Clock: 24.0          │  │
│  │  - Fouls, Timeouts, Clocks                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  PeerJS Server Connection (P2P)                    │
└─────────────────────────────────────────────────────┘
         ↑              ↑              ↑
    [WebRTC]       [WebRTC]       [WebRTC]
         │              │              │
    ┌────▼────┐    ┌────▼────┐   ┌────▼────┐
    │Controller│    │Controller│   │Controller│
    │   #1    │    │   #2    │   │   #3    │
    │         │    │         │   │         │
    │ 1. PIN  │    │ 1. PIN  │   │ 1. PIN  │
    │ 2. Auth │    │ 2. Auth │   │ 2. Auth │
    │ 3.Cmds  │    │ 3.Cmds  │   │ 3.Cmds  │
    └─────────┘    └─────────┘   └─────────┘
```

### Message Protocol

#### Authentication
```javascript
// Controller → Scoreboard
{ type: 'AUTHENTICATE', pin: '4829' }

// Scoreboard → Controller (Success)
{ type: 'AUTH_SUCCESS' }

// Scoreboard → Controller (Failure)
{ type: 'AUTH_FAILURE', message: 'Invalid PIN', attempts: 1 }

// Scoreboard → Controller (Locked)
{ type: 'AUTH_LOCKED', message: 'Too many failed attempts...' }
```

#### Game Commands
```javascript
// Controller → Scoreboard (examples)
{ type: 'SCORE_HOME', points: 2 }
{ type: 'FOUL_AWAY' }
{ type: 'TOGGLE_GAME_CLOCK' }
{ type: 'RESET_SHOT_CLOCK' }

// Scoreboard → Controller (acknowledgment)
{ type: 'COMMAND_ACK', command: 'SCORE_HOME' }
```

#### State Synchronization
```javascript
// Scoreboard → All Authenticated Controllers
{
  type: 'STATE_UPDATE',
  score1: 45,
  score2: 38,
  fouls1: 2,
  fouls2: 3,
  timeouts1: 2,
  timeouts2: 3,
  gameTime: 342,
  shotTime: 12.5,
  gameClockRunning: true,
  shotClockRunning: false
}
```

---

## 🔧 Configuration

### PeerJS Server (index.html & controller.html)

```javascript
const peer = new Peer({
    debug: 2,                          // 0=none, 1=error, 2=warning, 3=all
    host: 'peerjs.com',                // Default public server (or your own)
    port: 443,
    path: '/',
    secure: true
});
```

**Options:**
- `peerjs.com` - Free public server (rate limited)
- Self-hosted PeerServer - For production with high volume
- Enterprise solutions - Custom deployment

### Game Time Settings (index.html)

```html
<input type="number" id="game-time-setting" value="720" min="1">
<!-- 720 seconds = 12 minutes -->

<input type="number" id="shot-time-setting" value="24" min="1">
<!-- 24 seconds default -->
```

### PWA Configuration (manifest.json)

```json
{
  "name": "Basketball Scoreboard",
  "short_name": "Scoreboard",
  "start_url": "./index.html",
  "display": "standalone",
  "theme_color": "#ff5500",
  "background_color": "#111111"
}
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] Test locally in Chrome DevTools
- [ ] Verify PeerJS connection works
- [ ] Test PIN authentication flow
- [ ] Test multiple controller connections
- [ ] Verify offline functionality (Service Worker)
- [ ] Test on Android device
- [ ] Test on iOS device

### Hosting Requirements
- [ ] **HTTPS only** (required for Service Worker)
- [ ] **Icon files present** in `/images` directory
- [ ] **manifest.json** properly linked in HTML `<head>`
- [ ] **sw.js** accessible at root level
- [ ] **CORS headers** configured for external resources

### Deployment Platforms

| Platform | Setup | HTTPS | Cost |
|----------|-------|-------|------|
| GitHub Pages | Push to repo | Auto | Free |
| Netlify | Connect repo | Auto | Free |
| Vercel | Connect repo | Auto | Free |
| Firebase | `firebase deploy` | Auto | Free tier |
| AWS S3 | `aws s3 cp` | CloudFront | ~$1-5/mo |

### Example: GitHub Pages Deployment

```bash
# 1. Push all files to GitHub
git add .
git commit -m "Add PeerJS PIN authentication and PWA support"
git push origin main

# 2. Enable GitHub Pages
# - Go to Settings → Pages
# - Source: main branch
# - Custom domain (optional)

# 3. Access at https://username.github.io/basketball-scoreboard-app
```

---

## 🛠️ Development

### Browser Console Debugging

Scoreboard logs:
```javascript
[Scoreboard] Peer ID: controller-abc123
[Scoreboard] Peer connected: controller-xyz789
[Scoreboard] Message from controller-xyz789: { type: 'AUTHENTICATE', pin: '4829' }
[Scoreboard] Auth successful for controller-xyz789
[Scoreboard] Peer disconnected: controller-xyz789
```

Controller logs:
```javascript
[Controller] Initializing PeerJS
[Controller] Peer ID: controller-abc123
[Controller] Connected to scoreboard
[Controller] Submitting PIN for authentication
[Controller] Authentication successful
[Controller] Sending message: { type: 'SCORE_HOME', points: 2 }
[Controller] Message from scoreboard: { type: 'STATE_UPDATE', score1: 47, ... }
```

### Testing PIN Authentication

**Test Case 1: Correct PIN**
1. Open scoreboard, note PIN (e.g., "4829")
2. Open controller, connect
3. Enter correct PIN
4. Verify: "✓ Authenticated Successfully!" message
5. Game controls should be visible

**Test Case 2: Wrong PIN**
1. Enter incorrect PIN
2. Verify: "❌ Invalid PIN" message
3. Error text shows "Invalid PIN"
4. Allow re-entry

**Test Case 3: Lockout**
1. Enter wrong PIN 3 times
2. Verify: "❌ Too many attempts. Disconnected." message
3. Connection should auto-disconnect
4. Force reconnect via page reload

**Test Case 4: Multiple Controllers**
1. Open 2-3 controllers
2. Authenticate each with same PIN
3. Verify scoreboard shows "Connected: 2/2 authorized" or "3/3"
4. Change score on one controller
5. Verify all controllers update in real-time

### Offline Testing

1. Open DevTools → Application → Service Workers
2. Check "Offline" checkbox
3. Reload page
4. Verify app still loads
5. Local controls still work (scores, clocks, etc.)
6. Remote commands won't work (no internet)
7. Uncheck "Offline" and sync resumes

---

## 🔒 Security Best Practices

### For Local Network Use (Recommended)
- ✅ Use shared WiFi network
- ✅ PIN provides basic access control
- ✅ WebRTC encryption handles transport security

### For Public/Internet Use
- ⚠️ Consider implementing:
  - PIN rotation (hourly or per-game)
  - Connection logging/audit trail
  - Rate limiting on failed attempts
  - Custom PeerJS server (not peerjs.com)
  - TLS certificate pinning
  - Firewall rules limiting access

### PIN Security Tips
1. **Display only on scoreboard** - don't share verbally or in chat
2. **Regenerate for each game** - don't reuse PINs
3. **Use 4+ digits** - current implementation uses 4 digits
4. **Block after 3 attempts** - prevents brute force
5. **Monitor connection logs** - audit who connected when

---

## 📊 Browser Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 60+ | ✅ Full |
| Firefox | 55+ | ✅ Full |
| Safari | 12+ | ✅ Full (PWA limited) |
| Edge | 79+ | ✅ Full |
| iOS Safari | 12+ | ⚠️ PWA install only |
| Chrome Android | 60+ | ✅ Full PWA |
| Firefox Android | 68+ | ✅ Full PWA |

### Known Limitations
- **iOS PWA**: No background service worker, no full offline
- **Private Browsing**: Service Worker & Local Storage disabled
- **IE11**: Not supported (no WebRTC, no Service Worker)

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **README.md** | Overview & deployment (this file) |
| **QUICK_START.md** | 5-minute setup implementation guide |
| **PEERJS_PIN_AUTHENTICATION_GUIDE.md** | Complete technical reference |
| **manifest.json** | PWA configuration |
| **sw.js** | Service Worker with offline caching |
| **index.html** | Scoreboard host with PIN auth |
| **controller.html** | Remote controller interface |

---

## 🐛 Troubleshooting

### Common Issues

**"PeerJS not defined"**
- Add PeerJS CDN to `<head>`: `<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>`

**Connection fails immediately**
- Check internet connection
- Verify PeerJS.com is accessible
- Try alternative PeerJS server
- Check browser console for specific errors

**PIN not displaying**
- Clear browser cache
- Ensure `pin-display` element exists in HTML
- Check that `displayPin()` function is called

**Service Worker not caching**
- Must use HTTPS (http://localhost OK for testing)
- Check manifest.json path is correct
- Open DevTools → Application → Service Workers
- Click "Update on reload" checkbox
- Hard refresh (Ctrl+Shift+R)

**Multiple controllers not syncing**
- Verify all are authenticated (check scoreboard status)
- Check console for STATE_UPDATE messages
- Ensure `broadcastGameState()` called after changes
- Test with console: `gameState.connectedPeers.size`

**Icons not showing on iOS**
- Use 180x180 PNG (iOS requirement)
- Ensure transparent background
- Verify file paths in manifest.json
- Clear Safari cache, re-add to home screen

---

## 🤝 Contributing

To extend this project:

1. **Add QR code scanning** - Encode Peer ID in QR
2. **Custom PeerJS server** - Deploy your own for privacy
3. **Multi-sport support** - Adapt for volleyball, handball, etc.
4. **Stats/Replay** - Record game events with timestamps
5. **Team management** - Save team rosters and stats
6. **Sound effects** - Audio for scoring, fouls, time-outs
7. **Accessibility** - High contrast mode, screen reader support
8. **Analytics** - Track app usage, connection reliability

---

## 📝 License

[Add your license here - MIT, Apache 2.0, etc.]

---

## 🙏 Acknowledgments

- **PeerJS** - WebRTC abstraction library
- **MDN Web Docs** - Web technologies documentation
- **Web.dev** - PWA best practices

---

## 📞 Support

For issues, questions, or contributions:
- Check troubleshooting section above
- Review detailed docs in `PEERJS_PIN_AUTHENTICATION_GUIDE.md`
- Follow setup steps in `QUICK_START.md`
- Open GitHub issue with console logs

---

## 🎉 Quick Links

- 🚀 [Quick Start Guide](QUICK_START.md)
- 📖 [Technical Documentation](PEERJS_PIN_AUTHENTICATION_GUIDE.md)
- 🔐 [Security & Authentication](PEERJS_PIN_AUTHENTICATION_GUIDE.md#security-considerations)
- 🌐 [Deployment Instructions](PEERJS_PIN_AUTHENTICATION_GUIDE.md#deployment-instructions)

---

**Built with ❤️ for basketball scorekeeping**

Last Updated: 2026-09-12
