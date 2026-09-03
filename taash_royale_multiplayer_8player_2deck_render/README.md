# Taash Royale Multiplayer

Online browser game with:
- Teen Patti for 2–4 real players
- Kali Ni Teedi for 4–8 real players
- 5-character private room codes
- Player names and avatar initials
- WebRTC voice chat
- Responsive mobile/desktop UI
- Render-ready Node/WebSocket server
- Virtual chips only — no real-money wagering

## Local run
Requires Node.js 18+.

```bash
npm install
npm start
```

Then open:
`http://localhost:3000`

For multiplayer testing, open multiple browser windows/tabs and join the same room.

## Deploy on Render
1. Upload this folder to GitHub.
2. In Render choose **New → Web Service**.
3. Connect the GitHub repository.
4. Build command: `npm install`
5. Start command: `npm start`
6. Deploy.
7. Share the Render URL with friends.
8. Everyone joins the same room code.

`render.yaml` is included.

## Voice chat
Voice chat uses browser WebRTC. On a deployed HTTPS Render URL, tap the microphone button and allow microphone access.

A public STUN server is used for connection discovery. Some restrictive mobile/carrier networks may need a TURN server for 100% reliable voice connectivity.

## Kali Ni Teedi rules used
- 4–8 players / 13 cards each
- 4 players use one 52-card deck; 5–8 players use two decks (104 cards)
- With 8 players, all 104 cards are dealt
- Contract range automatically scales for one-deck vs two-deck tables
- Bidder selects Hukum (trump)
- Bidder calls a hidden partner card they do not hold
- Must follow suit when possible
- 3♠ beats every card and is worth 30 points
- A/K/Q/J/10 = 10 points each
- Every 5 = 5 points
- Bidder + hidden partner must reach the contract

## Two-deck duplicate rule
For 5–8 player Kali Ni Teedi, duplicate cards have a hidden Deck 1 / Deck 2 identity. The bidder calls one exact copy, so there is only one hidden partner. If two identical copies are played to the same trick, the copy played first wins the tie.
