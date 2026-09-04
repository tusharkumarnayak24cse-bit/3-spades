# Kaali Ni Tidi — Public Play v9

**v11 change:** Human bidding, Hukum/partner selection, and card-play turns now use a 60-second authoritative server timer.

A real-time multiplayer Kaali Ni Tidi / KaliTiri card game with the realistic casino-table interface from v8 and additional public-play reliability protections.

## Player/deck setup

- 4 players: 1 full deck, 13 cards each, 250 total scoring points, 1 hidden partner.
- 5 players: 2 reduced decks, 16 cards each, 500 total scoring points, 2 hidden partners.
- 6 players: 2 reduced decks, 16 cards each, 500 total scoring points, 2 hidden partners.
- 7 players: 2 reduced decks, 8 cards each, 500 total scoring points, 3 hidden partners.
- 8 players: 2 full decks, 13 cards each, 500 total scoring points, 3 hidden partners.

The existing two-decks-after-4-players rule is unchanged.

## Public Play v9 additions

### Authoritative 60-second action timer
The timer now lives on the server, not only in the browser UI. The server sends the deadline to every player so all clients show the same countdown.

- Bid timeout: automatically passes.
- Contract timeout: Hukum and valid hidden partner cards are selected automatically.
- Play timeout: a legal card is automatically played.
- Bots act quickly without waiting 60 seconds.

Set `TURN_TIMEOUT_MS` to change the timeout. The default is `60000` milliseconds.

### Reconnect to the same seat
Human players receive a cryptographically random private reconnect token that is stored only in their browser.

- Refreshing the page or briefly losing internet reconnects the player to the same room, seat, hand and score.
- During a started game, a disconnected player's seat is temporarily controlled by bot assist so the table does not freeze.
- When the player reconnects, bot assist immediately stops and control returns to the player.
- In the lobby, a disconnected seat is held for 90 seconds before being removed.
- A disconnected host gets a 60-second grace period before host control can move to another connected human.
- The new **Leave Room** button intentionally gives up the reconnect seat and prevents accidental auto-rejoin.

### Room cleanup
To prevent abandoned rooms from filling server memory:

- Rooms with no connected human players are removed after 20 minutes.
- Rooms with no meaningful activity are removed after 4 hours.
- Timers are cleared when a room is destroyed.
- The server limits the total number of in-memory rooms (default: 500, configurable with `MAX_ROOMS`).

### Multiplayer abuse protection
The Socket.IO server now includes:

- Room creation rate limiting by IP.
- Join attempt rate limiting by IP.
- Chat throttling.
- Bid, play, contract and next-round throttling.
- WebRTC signaling throttling and signal-size/type validation.
- Socket.IO payload limit of 64 KB.
- One active room per socket.
- Strict server validation still decides legal bids, contracts and cards; the browser cannot bypass the rules by changing HTML/JavaScript.

### Safer production HTTP / WebSocket settings
The server now adds basic security headers, a Content Security Policy, hides Express's `X-Powered-By` header, checks Socket.IO request origins, and exposes `/healthz` for Render health checks.

For a custom production domain, set:

```text
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

Multiple origins are comma-separated. Same-origin web traffic, local development, Render's default domain, and packaged Capacitor origins are handled automatically.

## Render deployment

Use the included `render.yaml`, or configure manually:

```text
Build Command: npm install
Start Command: npm start
Health Check Path: /healthz
NODE_ENV: production
TURN_TIMEOUT_MS: 60000
```

If you use a custom domain, also set `ALLOWED_ORIGINS` as described above.


## Packaged Android/iOS backend URL

The normal website connects to the same host automatically. The Capacitor build uses `public/config.js`. It is currently set to:

```text
https://three-spades.onrender.com
```

If your deployed backend uses a different domain, change `gameServer` in `public/config.js` before `npx cap sync`.

## Voice chat note

Voice chat still uses public STUN servers by default. That works on many networks, but some carrier NAT, school, office, hotel and restrictive Wi-Fi networks may require a TURN relay server. For a large public launch, adding a TURN service is recommended.

## Important hosting note

Rooms are currently stored in server memory. If the Node process restarts, crashes, redeploys, or a free hosting instance is recycled, active rooms are lost. This build is appropriate for a public beta / early public play on a single server instance. For a larger production launch with guaranteed recovery across server restarts or multiple server instances, move room/session state to Redis or another shared store.

## Quick local run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

## v9 launch checklist

Before sharing publicly:

1. Deploy v9 on Render or your production host.
2. Open two different browsers/devices and test create → join → start → bid → contract → full trick.
3. Refresh one player's page during a round and confirm they reclaim the same hand.
4. Disconnect Wi-Fi for one player and confirm bot assist keeps the game moving, then reconnect.
5. Wait through a 60-second turn once to verify the server performs the automatic action.
6. Test 4-player and at least one 2-deck mode (5–8 players).
7. Test mobile layout and voice chat on real phones.
8. Set `ALLOWED_ORIGINS` if using a custom domain.


## v12 — Cinematic animations + virtual ₹ rewards
- Upgraded 3D hand deal, card lift/play, table landing, active-seat glow and trick-win effects.
- Added a local virtual ₹ game wallet (starts at ₹1,000).
- Round completion reward: ₹100 virtual reward for the winning side, ₹25 participation reward otherwise.
- Virtual ₹ has no cash value: no deposit, wager, payment or cash-out functionality is included.
- Wallet is stored locally on the device/browser for cosmetic progression only.
