# Basketball Scoreboard - Quick Start Implementation Guide

## 5-Minute Setup for PeerJS PIN Authentication

This guide walks you through integrating PeerJS and PIN authentication into your existing Basketball Scoreboard app.

---

## Step 1: Add PeerJS CDN to Both HTML Files

### For `index.html` (Scoreboard Host)
Add this in the `<head>` section, before the closing `</head>` tag:

```html
<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>
```

### For `controller.html` (Smartphone Controller)
Add the same PeerJS CDN link in its `<head>`.

---

## Step 2: Update `index.html` - Add PeerJS Initialization

### A. Add PeerJS variables after `gameState` definition (around line 762):

```javascript
// PeerJS Configuration
let peer = null;
let scoreboardPeerId = null;
```

### B. Add PeerJS initialization function in the script section (before DOMContentLoaded):

```javascript
/**
 * Initialize PeerJS Server Connection
 */
function initializePeerServer() {
    console.log('[Scoreboard] Initializing PeerJS Server');
    
    peer = new Peer({
        debug: 2,
        host: 'peerjs.com',
        port: 443,
        path: '/',
        secure: true
    });

    peer.on('open', (id) => {
        console.log('[Scoreboard] Peer ID:', id);
        scoreboardPeerId = id;
        showNotification('🟢 Scoreboard Ready - ID: ' + id);
        // Optionally generate QR code from this ID
    });

    peer.on('connection', (conn) => {
        console.log('[Scoreboard] New connection from:', conn.peer);
        trackPeerConnection(conn.peer, conn);
        
        conn.on('data', (data) => {
            handlePeerMessage(conn.peer, data);
        });

        conn.on('close', () => {
            console.log('[Scoreboard] Connection closed:', conn.peer);
            removePeerConnection(conn.peer);
        });

        conn.on('error', (err) => {
            console.error('[Scoreboard] Connection error:', err);
        });
    });

    peer.on('error', (err) => {
        console.error('[Scoreboard] Peer error:', err);
        showNotification('Connection error: ' + err.type);
    });
}
```

### C. Update DOMContentLoaded to call PeerJS init:

Find this section (around line 779-788):

```javascript
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    updateDisplay();
    setupKeyboardShortcuts();
    // Enable offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('data:text/javascript,self.addEventListener("install",e=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(clients.claim()));')
            .catch(() => { /* offline app works without SW */ });
    }
});
```

**Replace it with:**

```javascript
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    
    // Generate and display PIN
    gameState.currentPin = generatePin();
    displayPin();
    
    updateDisplay();
    setupKeyboardShortcuts();
    
    // Initialize PeerJS server
    initializePeerServer();
    
    // Enable offline support
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker registered'))
            .catch(err => console.log('[PWA] Service Worker registration failed:', err));
    }
});
```

### D. Add these functions right before the closing `</script>` tag:

```javascript
/**
 * Track new peer connection
 */
function trackPeerConnection(peerId, conn) {
    gameState.connectedPeers.set(peerId, {
        conn: conn,
        authStatus: 'UNAUTHENTICATED',
        failedAttempts: 0
    });
    updateConnectionStatus();
    console.log(`[Scoreboard] Peer connected: ${peerId}`);
}

/**
 * Remove disconnected peer
 */
function removePeerConnection(peerId) {
    gameState.connectedPeers.delete(peerId);
    updateConnectionStatus();
    console.log(`[Scoreboard] Peer disconnected: ${peerId}`);
}

/**
 * Update connection status indicator on display
 */
function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;

    const authenticatedCount = Array.from(gameState.connectedPeers.values())
        .filter(p => p.authStatus === 'AUTHENTICATED').length;
    const totalCount = gameState.connectedPeers.size;

    if (totalCount === 0) {
        statusEl.textContent = 'No connections';
        statusEl.classList.remove('connected');
    } else {
        statusEl.textContent = `Connected: ${authenticatedCount}/${totalCount} authorized`;
        statusEl.classList.toggle('connected', authenticatedCount > 0);
    }
}

/**
 * Handle incoming message from controller
 */
function handlePeerMessage(peerId, data) {
    console.log(`[Scoreboard] Message from ${peerId}:`, data);

    const peerData = gameState.connectedPeers.get(peerId);
    if (!peerData) {
        console.warn(`[Scoreboard] Unknown peer: ${peerId}`);
        return;
    }

    // Handle authentication
    if (data.type === 'AUTHENTICATE') {
        handleAuthenticationAttempt(peerId, data.pin);
        return;
    }

    // Block unauthenticated commands
    if (peerData.authStatus !== 'AUTHENTICATED') {
        console.warn(`[Scoreboard] Blocked unauthenticated command from ${peerId}`);
        sendToPeer(peerId, {
            type: 'ERROR',
            message: 'Not authenticated. Please enter PIN.'
        });
        return;
    }

    // Process authenticated commands
    processGameCommand(peerId, data);
}

/**
 * Authenticate based on PIN
 */
function handleAuthenticationAttempt(peerId, submittedPin) {
    const peerData = gameState.connectedPeers.get(peerId);
    if (!peerData) return;

    if (submittedPin === gameState.currentPin) {
        // SUCCESS
        peerData.authStatus = 'AUTHENTICATED';
        peerData.failedAttempts = 0;
        console.log(`[Scoreboard] Peer ${peerId} authenticated successfully`);
        sendToPeer(peerId, { type: 'AUTH_SUCCESS' });
        showNotification(`✓ Controller Authenticated`);
        updateConnectionStatus();
    } else {
        // FAILURE
        peerData.failedAttempts = (peerData.failedAttempts || 0) + 1;
        console.warn(`[Scoreboard] Auth failed for ${peerId}. Attempts: ${peerData.failedAttempts}`);
        
        sendToPeer(peerId, {
            type: 'AUTH_FAILURE',
            message: 'Invalid PIN',
            attempts: peerData.failedAttempts
        });

        // Disconnect after 3 failed attempts
        if (peerData.failedAttempts >= 3) {
            console.warn(`[Scoreboard] Disconnecting ${peerId} after 3 failed attempts`);
            sendToPeer(peerId, {
                type: 'AUTH_LOCKED',
                message: 'Too many failed attempts. Connection closed.'
            });
            if (peerData.conn) peerData.conn.close();
        }
    }
}

/**
 * Process authenticated game commands
 */
function processGameCommand(peerId, data) {
    try {
        switch (data.type) {
            case 'SCORE_HOME':
                addPoints(1, data.points);
                break;
            case 'SCORE_AWAY':
                addPoints(2, data.points);
                break;
            case 'FOUL_HOME':
                addFoul(1);
                break;
            case 'FOUL_AWAY':
                addFoul(2);
                break;
            case 'TIMEOUT_HOME':
                timeout(1);
                break;
            case 'TIMEOUT_AWAY':
                timeout(2);
                break;
            case 'TOGGLE_GAME_CLOCK':
                toggleGameClock();
                break;
            case 'RESET_GAME_CLOCK':
                resetGameClock();
                break;
            case 'TOGGLE_SHOT_CLOCK':
                toggleShotClock();
                break;
            case 'RESET_SHOT_CLOCK':
                resetShotClock();
                break;
            default:
                console.warn(`[Scoreboard] Unknown command: ${data.type}`);
        }
        
        sendToPeer(peerId, {
            type: 'COMMAND_ACK',
            command: data.type
        });

        broadcastGameState();
    } catch (error) {
        console.error('[Scoreboard] Error processing command:', error);
        sendToPeer(peerId, {
            type: 'ERROR',
            message: 'Command processing error'
        });
    }
}

/**
 * Send message to specific peer
 */
function sendToPeer(peerId, message) {
    const peerData = gameState.connectedPeers.get(peerId);
    if (peerData && peerData.conn && peerData.conn.open) {
        peerData.conn.send(message);
    }
}

/**
 * Broadcast game state to all authenticated peers
 */
function broadcastGameState() {
    const state = {
        type: 'STATE_UPDATE',
        score1: gameState.score1,
        score2: gameState.score2,
        fouls1: gameState.fouls1,
        fouls2: gameState.fouls2,
        timeouts1: gameState.timeouts1,
        timeouts2: gameState.timeouts2,
        gameTime: gameState.gameTime,
        shotTime: gameState.shotTime,
        gameClockRunning: gameState.gameClockRunning,
        shotClockRunning: gameState.shotClockRunning
    };

    gameState.connectedPeers.forEach((peerData, peerId) => {
        if (peerData.authStatus === 'AUTHENTICATED') {
            sendToPeer(peerId, state);
        }
    });
}
```

### E. Update all game functions to broadcast state

Find the `addPoints()` function and add this at the end:

```javascript
function addPoints(team, points) {
    if (team === 1) {
        gameState.score1 = Math.max(0, gameState.score1 + points);
    } else {
        gameState.score2 = Math.max(0, gameState.score2 + points);
    }
    saveToLocalStorage();
    updateDisplay();
    broadcastGameState(); // ADD THIS LINE
}
```

**Do the same for these functions:**
- `addFoul(team)` - add `broadcastGameState();` at end
- `timeout(team)` - add `broadcastGameState();` at end
- `toggleGameClock()` - add `broadcastGameState();` at end
- `toggleShotClock()` - add `broadcastGameState();` at end
- `startGameClock()` - add `broadcastGameState();` when time expires
- `startShotClock()` - add `broadcastGameState();` when time expires
- `resetGameClock()` - add `broadcastGameState();` at end
- `resetShotClock()` - add `broadcastGameState();` at end
- `resetAll()` - add `broadcastGameState();` at end

### F. Update gameState initialization

Find the `gameState` object definition (around line 763) and add:

```javascript
const gameState = {
    score1: 0,
    score2: 0,
    fouls1: 0,
    fouls2: 0,
    timeouts1: 3,
    timeouts2: 3,
    gameTime: 720,
    shotTime: 24,
    gameClockRunning: false,
    shotClockRunning: false,
    gameTimeInterval: null,
    shotTimeInterval: null,
    // Add these lines:
    currentPin: null,
    connectedPeers: new Map() // Track connected controllers
};
```

---

## Step 3: Create/Update `controller.html` with PeerJS

You already have this file. Key things to verify are in place:

1. ✅ PeerJS CDN link in `<head>`
2. ✅ PIN entry screen with numpad
3. ✅ Game control buttons (hidden until authenticated)
4. ✅ Connection status indicator
5. ✅ JavaScript functions for PIN entry and command sending

The file includes all necessary authentication logic. Just ensure it's properly deployed.

---

## Step 4: Test Locally

### Test Scenario 1: PIN Generation & Display

1. Open `index.html` in browser
2. Check browser console (F12) for: `[Scoreboard] Peer ID: xxx`
3. Verify PIN is displayed (masked as ●●●●) in the header
4. PIN should regenerate on page refresh

### Test Scenario 2: Single Controller Connection

1. Open `index.html` on Device A (Scoreboard)
2. Open `controller.html` on Device B (Smartphone)
3. In console, controller should ask for Scoreboard Peer ID
4. Enter Peer ID from scoreboard console
5. Connection status should update to "Ready to authenticate"
6. Enter incorrect PIN → see error message
7. Enter correct PIN → game controls appear

### Test Scenario 3: Command Broadcasting

1. Both connected and authenticated
2. Click "+1" on controller → score increases on scoreboard
3. Scoreboard display updates
4. Console shows `STATE_UPDATE` messages

---

## Step 5: Deploy to HTTPS

Service Workers (PWA) require HTTPS. Options:

### Option A: GitHub Pages (Free)
```bash
git add .
git commit -m "Add PeerJS PIN authentication"
git push origin main
```
Then enable GitHub Pages in repository settings.

### Option B: Netlify (Free Tier)
1. Connect your GitHub repo
2. Auto-deploys on push
3. Gets free HTTPS certificate

### Option C: Vercel (Free Tier)
1. Import your GitHub repo
2. Auto-deploys and gets HTTPS

### Option D: Firebase Hosting
```bash
npm install -g firebase-tools
firebase init
firebase deploy
```

---

## Step 6: Generate QR Code (Optional)

To scan PIN instead of entering manually, add QRCode.js:

### Add to `index.html` in `<head>`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

### Add this div after PIN display:

```html
<div id="qr-code" style="text-align: center; margin-top: 20px;"></div>
```

### Add this function in script:

```javascript
function generateQRCode(peerId) {
    const qrContainer = document.getElementById('qr-code');
    if (!qrContainer) return;
    
    qrContainer.innerHTML = ''; // Clear previous
    
    // Format: controller.html?peer=PEER_ID
    const qrText = window.location.origin + '/controller.html?peer=' + peerId;
    
    new QRCode(qrContainer, {
        text: qrText,
        width: 200,
        height: 200,
        colorDark: '#ff8c00',
        colorLight: '#000'
    });
}

// Call in peer 'open' event:
peer.on('open', (id) => {
    console.log('[Scoreboard] Peer ID:', id);
    scoreboardPeerId = id;
    showNotification('🟢 Scoreboard Ready');
    generateQRCode(id); // ADD THIS
});
```

---

## Troubleshooting Checklist

| Issue | Solution |
|-------|----------|
| "Peer is not defined" | Add PeerJS CDN link to `<head>` |
| Connection fails | Check internet; PeerJS.com must be accessible |
| PIN not syncing | Verify `broadcastGameState()` in all functions |
| Commands not received | Check controller is authenticated first |
| Service Worker not caching | Must use HTTPS; clear cache and reload |
| Icons not showing (iOS) | Use 180x180 and 192x192 PNG files |

---

## Key Functions Reference

### Scoreboard (index.html)

```javascript
generatePin()                    // Creates 4-digit PIN
displayPin()                     // Shows ●●●● mask
trackPeerConnection(peerId)      // Register new controller
handleAuthenticationAttempt()     // Verify PIN
processGameCommand()             // Execute game action
broadcastGameState()             // Sync all controllers
```

### Controller (controller.html)

```javascript
initPeerConnection()             // Connect to PeerJS
connectToScoreboard(peerId)      // Join specific scoreboard
pinAddDigit(digit)               // Input PIN digit
pinSubmit()                      // Send PIN for auth
sendCommand(type, value)         // Send game command
handleAuthSuccess()              // Show controls after auth
```

---

## Next Steps

1. ✅ Deploy to HTTPS
2. ✅ Test on multiple devices
3. ✅ Generate QR code for easy scanning
4. ✅ Monitor browser console for debug logs
5. ✅ Consider adding PIN rotation timer
6. ✅ Log connections for audit trail
7. ✅ Add UI for displaying connected controller count

---

## Support

For detailed information, refer to:
- `PEERJS_PIN_AUTHENTICATION_GUIDE.md` - Complete technical docs
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker/offline support

---

**You're all set! 🏀🎮**

Test the system locally first, then deploy to a live server. The PIN authentication provides security while PeerJS enables real-time multi-device synchronization.
