# Kaali Ni Tidi — KaliTiri Rules Edition

Built from the supplied green-table UI.

## 8-player mode follows the supplied KaliTiri rules

- 8 players
- 2 full decks = 104 cards
- 13 cards each / 13 tricks
- 500 scoring points
- Bidding starts at 250
- Maximum bid 500
- Minimum bid increment +5
- Highest bidder chooses PowerHouse (Hukum)
- Highest bidder calls 3 hidden partner cards to form a team of 4
- Highest bidder leads the first trick
- Must follow suit
- If void: PowerHouse can win; another off-suit discard cannot win
- 3♠ = 30 scoring points, but it is not an automatic super-trump in this ruleset
- Duplicate winning cards: the later/second identical copy wins the tie

### Points
- 3♠ = 30 each
- A/K/Q/J/10 = 10 each
- 5 = 5
- Others = 0

### Scoring implemented
- Bid team must score **higher than** the bid.
- If successful, each bidding-team player is awarded the team's captured points.
- Opposing players are awarded their opposing team's captured points.
- If the bid fails, the bid winner receives no round award; bidding partners receive half of the opposing team's captured points.

## Other player counts

The game still supports 4, 5, 6 and 7 players. The 5- and 7-player setups are explicitly marked as custom adaptations:
- 5P: 2 reduced decks, remove zero-point ranks 2/4/6 from each deck, 16 cards each, 500 points, 2 hidden partners.
- 6P: 2 reduced decks, remove the 2s from each deck, 16 cards each, 500 points, 2 hidden partners.
- 7P: 2 reduced decks using 3/5/10/J/Q/K/A, 8 cards each, 500 points, 3 hidden partners.

## Features
- Private rooms + bots
- Socket.IO multiplayer
- WebRTC voice chat
- Table chat and emojis
- Gujarati / English UI
- Dynamic green table
- Render-ready
- Capacitor iOS / Android helper files

## Render
- Build Command: `npm install`
- Start Command: `npm start`
- If uploaded under a GitHub subfolder, set Root Directory to the folder containing `package.json` and `server.js`.

## Realistic table UI (v8)

The gameplay screen now uses a casino-style green felt table with a wood rim, relative seating that always keeps the local player at the bottom, card-back stacks for opponents, a center contract HUD, a fanned hand, turn/dealer indicators, and a compact right-side score/chat/game-log rail. The existing game rules and the two-deck-after-4-players setup are unchanged.
