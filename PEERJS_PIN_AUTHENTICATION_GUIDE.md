# Basketball Scoreboard PWA - PIN Authentication & PeerJS Integration Guide

## Overview

This guide provides complete instructions for implementing a secure PIN-authenticated remote control system for the Basketball Scoreboard using PeerJS, with full PWA (Progressive Web App) support for offline functionality.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [File Structure](#file-structure)
3. [PIN Authentication Flow](#pin-authentication-flow)
4. [PeerJS Integration](#peerjs-integration)
5. [Scoreboard Implementation](#scoreboard-implementation)
6. [Controller Implementation](#controller-implementation)
7. [PWA Setup](#pwa-setup)
8. [Deployment Instructions](#deployment-instructions)
9. [Security Considerations](#security-considerations)

---

## System Architecture

### Overview Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   MAIN DISPLAY (Scoreboard)             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Generates & Displays 4-Digit PIN (e.g., "4829") │  │
│  │  Shows Connected/Authenticated Controllers Count  │  │
│  ├──────────────────────────────────────────────────┤  │
│  │  Game State:                                      │  │
│  │  - Scores, Fouls, Timeouts                        │  │
│  │  - Game Clock, Shot Clock                         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                           ↑↓ PeerJS P2P
        ┌──────────────────────────────────────────────┐
        │                                              │
┌───────────────────┐                    ┌───────────────────┐
│   CONTROLLER #1   │                    │   CONTROLLER #2   │
│ (Smartphone View) │                    │ (Smartphone View) │
│  ┌──────────────┐ │                    │  ┌──────────────┐ │
│  │ PIN Entry    │ │                    │  │ PIN Entry    │ │
│  │ (4-digit)    │ │                    │  │ (4-digit)    │ │
│  └──────────────┘ │                    │  └──────────────┘ │
│        ↓          │                    │        ↓          │
│  ┌──────────────┐ │                    │  ┌──────────────┐ │
│  │ Game Control │ │ (authenticated)    │  │ Game Control │ │
│  │ - Score      │ │                    │  │ - Score      │ │
│  │ - Fouls      │ │                    │  │ - Fouls      │ │
│  │ - Timeouts   │ │                    │  │ - Timeouts   │ │
│  │ - Clocks     │ │                    │  │ - Clocks     │ │
│  └──────────────┘ │                    │  └──────────────┘ │
└───────────────────┘                    └───────────────────┘
```

### Key Components

| Component | Role | Language |
|-----------|------|----------|
| `index.html` | Scoreboard Host (Main Display) | HTML/CSS/JavaScript |
| `controller.html` | Remote Controller (Smartphone) | HTML/CSS/JavaScript |
| `sw.js` | Service Worker (Offline Caching) | JavaScript |
| `manifest.json` | PWA Configuration | JSON |

---

## File Structure

```
basketball-scoreboard-app/
├── index.html              # Main scoreboard display with PIN generation
├── controller.html         # Smartphone controller interface
├── sw.js                   # Service Worker for offline support
├── manifest.json           # PWA manifest
├── peerjs-setup.js         # PeerJS integration helper (optional)
└── images/
    ├── icon-192.png        # App icon (192x192)
    ├── icon-192-maskable.png
    ├── icon-512.png        # App icon (512x512)
    └── icon-512-maskable.png
```

---

## PIN Authentication Flow

### Sequence Diagram

```
SCOREBOARD              CONTROLLER              DESCRIPTION
    │                       │
    ├──────────────────────→│ 1. PeerJS Connection Established
    │                       │    - Controller connects via peer ID
    │                       │
    │                       ├─ PIN Entry Screen Shows
    │                       │  (User enters 4-digit PIN)
    │                       │
    │←──────AUTHENTICATE────┤ 2. Send PIN in AUTH message
    │      { pin: "4829" }   │
    │                       │
    ├─ Validate PIN         │
    │  gameState.currentPin  │
    │                       │
    ├─ Check Status:        │
    │  ├─ If MATCH:         │
    │  │  AUTH_SUCCESS ──→  ├─ Reveal Game Controls
    │  │                    │  (Hide PIN screen)
    │  │                    │
    │  └─ If NO MATCH:      │
    │     AUTH_FAILURE ──→  ├─ Show Error
    │     (Try again)       │  (Up to 3 attempts)
    │                       │
    │  After 3 failures:    │
    │     AUTH_LOCKED ──→   ├─ Disconnect
    │                       │  (Force reconnect)
    │                       │
    ├─ Once Authenticated:  │
    │  Block unauthenticated│
    │  commands             │
    │←────GAME COMMAND──────┤ 3. Controller sends commands
    │   (SCORE_HOME, etc.)  │    - Only accepted if AUTH_SUCCESS
    │                       │
    ├─ Process & Broadcast  │
    │  STATE_UPDATE ────────→├─ Update Display
    │                        │  (Sync game state)
```

### Authentication States

1. **UNAUTHENTICATED** (Initial)
   - Connection established but PIN not verified
   - All game commands blocked
   - User sees PIN entry screen

2. **AUTHENTICATED** (After correct PIN)
   - PIN verified successfully
   - Game commands accepted
   - User sees control interface

3. **LOCKED** (After 3 failed attempts)
   - Connection terminated
   - User must reconnect

---

## PeerJS Integration

### CDN Links Required

Add these to your `<head>` in both `index.html` and `controller.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js"></script>
```

### PeerJS Initialization (Scoreboard - index.html)

```javascript
// After gameState definition, add:

let peer = null;

function initializePeerServer() {
    console.log('[Scoreboard] Initializing PeerJS');
    
    peer = new Peer({
        debug: 2, // 0=none, 1=error, 2=warning, 3=all
        host: 'peerjs.com', // or your own PeerJS server
        port: 443,
        path: '/'
    });

    peer.on('open', (id) => {
        console.log('[Scoreboard] Peer ID:', id);
        scoreboardPeerId = id;
        updateScoreboardPeerDisplay();
    });

    peer.on('connection', (conn) => {
        console.log('[Scoreboard] New connection from:', conn.peer);
        
        // Track this peer
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

// Call this in DOMContentLoaded:
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    gameState.currentPin = generatePin();
    displayPin();
    updateDisplay();
    setupKeyboardShortcuts();
    
    // Initialize PeerJS
    initializePeerServer();
    
    // PWA Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker registered'))
            .catch(err => console.log('[PWA] Service Worker registration failed:', err));
    }
});
```

### PeerJS Initialization (Controller - controller.html)

```javascript
// Enhanced initialization with PeerJS

let peer = null;

function initPeerConnection() {
    console.log('[Controller] Initializing PeerJS');
    
    peer = new Peer({
        debug: 2,
        host: 'peerjs.com',
        port: 443,
        path: '/'
    });

    peer.on('open', (id) => {
        console.log('[Controller] Peer ID:', id);
        controllerState.peerId = id;
        
        // Prompt user for scoreboard peer ID (from QR code or manual entry)
        promptForScoreboardId();
    });

    peer.on('error', (err) => {
        console.error('[Controller] Peer error:', err);
        showNotification('Connection failed: ' + err.type);
    });
}

function promptForScoreboardId() {
    // In production, this would be scanned from QR code
    // For now, show a dialog:
    const scoreboardId = prompt('Enter Scoreboard Peer ID:');
    
    if (scoreboardId) {
        connectToScoreboard(scoreboardId);
    } else {
        showNotification('No scoreboard ID provided');
    }
}

function connectToScoreboard(scoreboardPeerId) {
    console.log('[Controller] Connecting to scoreboard:', scoreboardPeerId);
    
    const conn = peer.connect(scoreboardPeerId, {
        reliable: true
    });

    conn.on('open', () => {
        console.log('[Controller] Connected to scoreboard');
        controllerState.peerConnection = conn;
        onPeerConnectionEstablished();
    });

    conn.on('data', (data) => {
        handleScoreboardMessage(data);
    });

    conn.on('close', () => {
        console.log('[Controller] Connection to scoreboard closed');
        controllerState.peerConnection = null;
        updateConnectionStatus('Disconnected', '');
    });

    conn.on('error', (err) => {
        console.error('[Controller] Connection error:', err);
        showNotification('Connection error: ' + err.type);
    });
}

// Call in DOMContentLoaded:
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Controller] Page loaded, initializing...');
    initPeerConnection();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('[PWA] Service Worker registered'))
            .catch(err => console.log('[PWA] Service Worker registration failed:', err));
    }
});
```

---

## Scoreboard Implementation

### PIN Generation & Display

```javascript
/**
 * Generate a random 4-digit PIN (1000-9999)
 */
function generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Display PIN with masked format (●●●●)
 */
function displayPin() {
    const pinDisplay = document.getElementById('pin-display');
    if (pinDisplay) {
        pinDisplay.textContent = gameState.currentPin
            .split('')
            .map(d => '●')
            .join(' ');
    }
}
```

### Connection Management

```javascript
const gameState = {
    // ... existing state ...
    currentPin: null,
    connectedPeers: new Map() // Map<peerId, { conn, authStatus, failedAttempts }>
};

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
 * Update connection status indicator
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
```

### Message Handler

```javascript
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

    // Handle authentication attempt
    if (data.type === 'AUTHENTICATE') {
        handleAuthenticationAttempt(peerId, data.pin);
        return;
    }

    // Block non-authenticated commands
    if (peerData.authStatus !== 'AUTHENTICATED') {
        console.warn(`[Scoreboard] Blocking command from unauthenticated peer ${peerId}`);
        sendToPeer(peerId, {
            type: 'ERROR',
            message: 'Not authenticated. Please enter PIN first.'
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
        
        console.log(`[Scoreboard] Peer ${peerId} authenticated`);
        sendToPeer(peerId, { type: 'AUTH_SUCCESS' });
        showNotification(`✓ Controller Connected`);
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
            if (peerData.conn) {
                peerData.conn.close();
            }
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
        
        // Send acknowledgement
        sendToPeer(peerId, {
            type: 'COMMAND_ACK',
            command: data.type
        });

        // Broadcast state to all authenticated peers
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

### Update All Score/Clock Functions

Modify existing functions to broadcast state after changes:

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

// Do the same for: addFoul(), timeout(), toggleGameClock(), 
// toggleShotClock(), resetGameClock(), resetShotClock(), resetAll()
```

---

## Controller Implementation

### PIN Entry UI

```javascript
const controllerState = {
    peerId: null,
    peerConnection: null,
    pin: '',
    pinMaxLength: 4,
    authStatus: 'UNAUTHENTICATED',
    failedAttempts: 0
};

function pinAddDigit(digit) {
    if (controllerState.pin.length < controllerState.pinMaxLength) {
        controllerState.pin += digit;
        updatePinDisplay();
        clearPinError();
    }
}

function updatePinDisplay() {
    const display = document.getElementById('pin-display');
    if (display) {
        const masked = controllerState.pin.split('').map(() => '●').join('');
        const empty = '●'.repeat(Math.max(0, 4 - controllerState.pin.length));
        display.textContent = masked + empty;
    }
}

function pinSubmit() {
    if (controllerState.pin.length !== 4) {
        displayPinError('PIN must be 4 digits');
        return;
    }

    console.log('[Controller] Submitting PIN');
    sendMessage({
        type: 'AUTHENTICATE',
        pin: controllerState.pin
    });
}
```

### Message Handling

```javascript
function handleScoreboardMessage(data) {
    console.log('[Controller] Message from scoreboard:', data);

    switch (data.type) {
        case 'AUTH_SUCCESS':
            handleAuthSuccess();
            break;
        
        case 'AUTH_FAILURE':
            handleAuthFailure(data.message, data.attempts);
            break;
        
        case 'AUTH_LOCKED':
            handleAuthLocked(data.message);
            break;
        
        case 'STATE_UPDATE':
            updateGameStateDisplay(data);
            break;
        
        case 'COMMAND_ACK':
            console.log('[Controller] Command acknowledged:', data.command);
            break;
        
        case 'ERROR':
            showNotification('Error: ' + data.message);
            break;
    }
}

function handleAuthSuccess() {
    console.log('[Controller] Authentication successful');
    controllerState.authStatus = 'AUTHENTICATED';
    controllerState.failedAttempts = 0;
    updateConnectionStatus('Connected & Authenticated', 'connected');
    showControllerScreen(true); // Show game controls
    showNotification('✓ Authenticated Successfully!');
}

function handleAuthFailure(message, attempts) {
    console.warn('[Controller] Authentication failed');
    controllerState.failedAttempts = attempts || 0;
    controllerState.pin = '';
    updatePinDisplay();
    displayPinError(message);
    showNotification('❌ Invalid PIN');
}

function handleAuthLocked(message) {
    console.error('[Controller] Authentication locked:', message);
    showNotification('❌ Too many attempts. Disconnected.');
    setTimeout(() => disconnect(), 2000);
}

function updateGameStateDisplay(state) {
    document.getElementById('team1-score').textContent = state.score1;
    document.getElementById('team2-score').textContent = state.score2;
    document.getElementById('game-clock-display').textContent = formatTime(state.gameTime);
}
```

### Command Sending

```javascript
function sendCommand(command, value) {
    const message = { type: command };
    if (value !== undefined) {
        message.points = value;
    }
    sendMessage(message);
}

function sendMessage(message) {
    if (!controllerState.peerConnection || !controllerState.peerConnection.open) {
        showNotification('Not connected to scoreboard');
        return;
    }

    if (controllerState.authStatus !== 'AUTHENTICATED' && message.type !== 'AUTHENTICATE') {
        showNotification('Not authenticated');
        return;
    }

    console.log('[Controller] Sending message:', message);
    try {
        controllerState.peerConnection.send(message);
    } catch (error) {
        console.error('[Controller] Error sending message:', error);
        showNotification('Failed to send command');
    }
}
```

---

## PWA Setup

### Service Worker (sw.js)

Already created - handles offline caching for:
- App shell files (HTML, CSS)
- External libraries (PeerJS, QRCode)
- Cache-First with Network fallback strategy

### Manifest Configuration (manifest.json)

Already created with:
- App name, icons, colors
- Standalone display mode
- Maskable icon support for adaptive icons

### HTML Head Tags

**index.html** and **controller.html** both include:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-touch-icon" href="./images/icon-192.png">
<meta name="theme-color" content="#ff5500">
<link rel="manifest" href="manifest.json">
```

### Service Worker Registration

```html
<script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('[PWA] Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('[PWA] Service Worker registration failed:', error);
                });
        });
    }
</script>
```

---

## Deployment Instructions

### 1. Create Icon Assets

Generate icons from a 512x512 PNG image:
- `images/icon-192.png` (192x192)
- `images/icon-192-maskable.png` (192x192 with safe zone)
- `images/icon-512.png` (512x512)
- `images/icon-512-maskable.png` (512x512 with safe zone)

### 2. Deploy to HTTPS Server

PWA features require HTTPS. Options:
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Any HTTPS web host

### 3. Test on Devices

**Android:**
1. Open app in Chrome/Firefox
2. Tap menu → "Install app"
3. App installs to home screen

**iOS:**
1. Open app in Safari
2. Tap Share → "Add to Home Screen"
3. Name the app and add it

### 4. Test Offline

1. Install app to home screen
2. Open DevTools → Application → Service Workers
3. Check "Offline"
4. Reload - app should work completely offline

---

## Security Considerations

### PIN Security

⚠️ **Current Implementation:**
- PIN displayed as masked dots (●●●●) on scoreboard
- PIN transmitted over WebRTC DataChannel (encrypted by default)
- Recommended: Use this over local network only

### Improvements for Production

1. **Rotate PIN periodically:**
   ```javascript
   setInterval(() => {
       gameState.currentPin = generatePin();
       displayPin();
   }, 3600000); // Every hour
   ```

2. **Use HTTPS/WSS only:**
   - Ensure PeerJS server uses secure connections
   - Never use over unencrypted HTTP

3. **Implement rate limiting:**
   ```javascript
   const MAX_FAILED_ATTEMPTS = 3;
   const LOCKOUT_DURATION = 300000; // 5 minutes
   ```

4. **Log all connections:**
   ```javascript
   function logConnection(peerId, authStatus) {
       const log = {
           timestamp: new Date().toISOString(),
           peerId,
           authStatus,
           failedAttempts: gameState.connectedPeers.get(peerId)?.failedAttempts
       };
       console.log('[AUDIT]', log);
       // Send to server in production
   }
   ```

5. **Validate message origins:**
   - Check peer ID matches expected controller
   - Validate command types before processing

---

## Troubleshooting

### "PeerJS not defined"
- Add PeerJS CDN link to `<head>` before custom scripts
- Check internet connection for CDN access

### Connection not establishing
- Verify PeerJS server (peerjs.com) is accessible
- Check browser console for CORS errors
- Ensure both devices on same network or public internet

### PIN not syncing
- Verify `broadcastGameState()` is called after state changes
- Check PeerJS connections are open: `conn.open === true`
- Monitor DataChannel in DevTools

### Service Worker not caching
- Check manifest path in HTML
- Ensure HTTPS is used
- Clear site data and re-register SW

### Icons not showing on iOS
- Verify icon files exist at specified paths
- Ensure transparent background with content in safe zone (90%)
- Try clearing Safari cache and re-adding to home screen

---

## Message Protocol Reference

### Authentication Flow

**Controller → Scoreboard:**
```json
{
  "type": "AUTHENTICATE",
  "pin": "4829"
}
```

**Scoreboard → Controller:**
```json
{
  "type": "AUTH_SUCCESS"
}
// or
{
  "type": "AUTH_FAILURE",
  "message": "Invalid PIN",
  "attempts": 1
}
// or
{
  "type": "AUTH_LOCKED",
  "message": "Too many failed attempts. Connection closed."
}
```

### Game Commands

**Controller → Scoreboard:**
```json
{
  "type": "SCORE_HOME",
  "points": 2
}
// or
{
  "type": "FOUL_HOME"
}
// or
{
  "type": "TOGGLE_GAME_CLOCK"
}
```

### State Broadcast

**Scoreboard → All Authenticated Controllers:**
```json
{
  "type": "STATE_UPDATE",
  "score1": 45,
  "score2": 38,
  "fouls1": 2,
  "fouls2": 3,
  "timeouts1": 2,
  "timeouts2": 3,
  "gameTime": 342,
  "shotTime": 12.5,
  "gameClockRunning": true,
  "shotClockRunning": false
}
```

---

## Additional Resources

- [PeerJS Documentation](https://peerjs.com/)
- [MDN Web Docs - Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [WebRTC Security](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Security)

---

## License & Support

For issues or questions, refer to the main repository documentation or contact the development team.
