# Kaali Ni Tidi — 4 to 8 Player Edition

Built from the supplied **3 OF SPADES / KAALI NI TIDI green-table voice UI**.

## Supported table sizes

| Players | Deck setup | Cards each | Total points | Bidding | Hidden partners | Teams |
|---|---|---:|---:|---|---:|---|
| 4 | 1 full deck | 13 | 250 | 150–250, +5 | 1 | 2 vs 2 |
| 5 | 1 reduced deck; remove 2, 4, 6 | 8 | 250 | 150–250, +5 | 2 | 3 vs 2 |
| 6 | 1 reduced deck; remove 2 | 8 | 250 | 150–250, +5 | 2 | 3 vs 3 |
| 7 | 2 reduced decks; keep 3, 5, 10, J, Q, K, A | 8 | 500 | 300–500, +10 | 3 | 4 vs 3 |
| 8 | 2 full decks | 13 | 500 | 300–500, +10 | 3 | 4 vs 4 |

For **5 and 7 players**, only zero-point ranks are removed. This means there is no kitty and all scoring points remain available in play.

## Core rules

- Bidding starts with the player after the dealer and continues clockwise.
- Each new bid must be higher by the table's bid increment.
- Highest bidder chooses Hukum and calls the required hidden partner card(s).
- In 2-deck modes, the exact Deck 1 / Deck 2 physical card is called.
- Called cards must belong to different players.
- Highest bidder leads the first trick.
- Players must follow the lead suit when possible.
- If void in the lead suit, Hukum or another discard may be played.
- Each physical **3♠ is worth 30 points and is the absolute highest card**.
- A/K/Q/J/10 = 10 points each; every 5 = 5 points.
- If identical cards from the two decks appear in one trick, the first one played wins the tie.
- Partners reveal only when their called card is played.
- The bidder side must capture at least the winning bid to make the contract.

## Included

- 4, 5, 6, 7 and 8-player rooms
- Empty seats filled with bots
- Socket.IO multiplayer
- WebRTC voice chat
- Table chat + emoji reactions
- Gujarati / English UI
- Dynamic player seating
- Rules screen
- Render deployment files
- Capacitor iOS / Android helper files

## Render deployment

Create a **Web Service**.

- Build Command: `npm install`
- Start Command: `npm start`

If the project is stored in a subfolder of your GitHub repository, set Render **Root Directory** to the folder containing `package.json` and `server.js`.
