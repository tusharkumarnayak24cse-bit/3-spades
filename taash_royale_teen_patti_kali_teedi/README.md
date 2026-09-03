# Taash Royale — Teen Patti + Kali Ni Teedi

A self-contained browser card game with:
- Teen Patti vs 3 computer players
- Kali Ni Teedi vs 3 computer players
- Responsive desktop/mobile UI
- Sound toggle
- No backend and no dependencies
- Virtual chips only (no real-money wagering)

## Run locally
Open `index.html` in Chrome/Edge/Safari.

For VS Code, you can also use the Live Server extension.

## Deploy
This is a static site. Upload the three files (`index.html`, `style.css`, `game.js`) to any static host.

## Kali Ni Teedi rules used in this build
- 4 players, 13 cards each
- User is the bidder in this single-player edition
- Choose a contract, Hukum (trump), and a hidden partner card
- Must follow lead suit when possible
- 3♠ beats every card and is worth 30 points
- A/K/Q/J/10 = 10 points each
- 5 = 5 points
- Bidding side must reach the selected contract

Regional Kali Ni Teedi rules can vary. This build uses a common point-capture version.

## Render (Web Service)
This ZIP also includes a dependency-free Node server.
1. Upload the project to GitHub.
2. Create a Render Web Service from the repo.
3. Start command: `npm start`
4. No build command is required.

`render.yaml` is included for Blueprint-style deployment.
