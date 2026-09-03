# Kaali Ni Tidi — 8 Player / 2 Deck UI Edition

Built from the supplied **3 OF SPADES / KAALI NI TIDI voice UI**.

## Included
- Same green 3 OF SPADES UI
- 4, 6, or 8 player private rooms
- 8-player mode = **2 full decks / 104 physical cards / 13 cards each**
- 4-player mode = 1 full deck / 13 cards each
- 6-player mode = 48-card deck / 8 cards each
- Empty seats can be bots
- Socket.IO online multiplayer
- WebRTC voice chat
- Table chat + emoji reactions
- Gujarati / English UI
- Bidding, Hukum, hidden partners, follow-suit trick play
- In 8-player mode, called partner cards include the exact **Deck 1 / Deck 2** copy
- Both physical **3♠ cards are worth 30 points and are absolute highest cards**; if both appear in one trick, the first played 3♠ keeps the tie
- Render deployment files
- Capacitor iOS / Android helper files

## Render
Create a **Web Service**.

- Build Command: `npm install`
- Start Command: `npm start`

If this project is inside a folder in your GitHub repository, set Render **Root Directory** to that folder.

## Local
```bash
npm install
npm start
```
Open `http://localhost:3000`.

## Important mobile note
`public/client.js` contains the hosted server URL used when running under `file:` or `capacitor:`. Change `GAME_SERVER` to your own Render URL before making the iOS/Android app.
