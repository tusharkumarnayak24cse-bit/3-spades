const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true, methods: ["GET", "POST"] } });

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const rooms = new Map();

const SUITS = ["S", "H", "D", "C"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VALUE = Object.fromEntries(RANKS.map((r, i) => [r, i + 2]));

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function cleanName(name) {
  return String(name || "").replace(/[<>]/g, "").trim().slice(0, 18) || "Player";
}

function cleanAvatar(avatar) {
  const allowed = ["😎","🧔","👨","👩","🧑","🦁","🐯","🦊","🐼","🐺","🦅","👑"];
  return allowed.includes(String(avatar)) ? String(avatar) : "😎";
}

function cleanChat(text) {
  return String(text || "").replace(/[<>]/g, "").trim().slice(0, 180);
}

function makeDeck(playerCount) {
  const cards = [];
  if (playerCount === 8) {
    for (let copy = 1; copy <= 2; copy++) {
      for (const suit of SUITS) {
        for (const rank of RANKS) {
          cards.push({ suit, rank, copy, id: `${copy}-${suit}-${rank}` });
        }
      }
    }
  } else {
    const ranks = playerCount === 6 ? RANKS.filter(r => r !== "2") : RANKS;
    for (const suit of SUITS) {
      for (const rank of ranks) {
        cards.push({ suit, rank, copy: 1, id: `1-${suit}-${rank}` });
      }
    }
  }
  return shuffle(cards);
}

function shuffle(cards) {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardPoints(card) {
  if (card.suit === "S" && card.rank === "3") return 30;
  if (["10","J","Q","K","A"].includes(card.rank)) return 10;
  if (card.rank === "5") return 5;
  return 0;
}

function publicCard(card) {
  return { suit: card.suit, rank: card.rank, copy: card.copy, id: card.id };
}

function cardLabel(card) {
  const copyLabel = card.copy > 1 ? ` · Deck ${card.copy}` : "";
  return `${card.rank}${card.suit}${copyLabel}`;
}

function minBidFor(room) {
  return room.playerCount === 8 ? 300 : 150;
}

function maxBidFor(room) {
  return room.playerCount === 8 ? 500 : 250;
}

function partnerCountFor(room) {
  if (room.playerCount === 4) return 1;
  if (room.playerCount === 6) return 2;
  if (room.playerCount === 8) return 2; // Larger-table house-rule variant: bidder + 2 hidden partners.
  return 1;
}

function createRoomState(code, hostSocket, name, avatar, playerCount) {
  return {
    code,
    hostSocket,
    playerCount,
    phase: "lobby",
    dealerIndex: playerCount - 1,
    players: [{
      id: hostSocket,
      name,
      avatar,
      bot: false,
      connected: true,
      voiceJoined: false,
      voiceMuted: false,
      hand: [],
      score: 0,
      team: null,
      roundPoints: 0
    }],
    deck: [],
    bid: {
      current: null,
      bidderIndex: null,
      turnIndex: 0,
      passed: [],
      acted: []
    },
    trump: null,
    calledPartners: [],
    revealedPartners: [],
    bidderTeam: [],
    turnIndex: 0,
    leadSuit: null,
    trick: [],
    trickNumber: 0,
    lastTrick: null,
    log: [],
    chat: [],
    round: 0
  };
}

function addBot(room, index) {
  room.players.push({
    id: `bot-${room.code}-${room.round}-${index}-${Math.random().toString(36).slice(2,7)}`,
    name: `Bot ${index}`,
    avatar: ["🤖","🦊","🐯","🦁"][index % 4],
    bot: true,
    connected: true,
    voiceJoined: false,
    voiceMuted: false,
    hand: [],
    score: 0,
    team: null,
    roundPoints: 0
  });
}

function addLog(room, text) {
  room.log.unshift(text);
  room.log = room.log.slice(0, 14);
}

function emitRoom(room) {
  room.players.forEach((p, index) => {
    if (p.bot || !p.connected) return;
    io.to(p.id).emit("state", serializeRoom(room, index));
  });
}

function serializeRoom(room, viewerIndex) {
  const viewer = room.players[viewerIndex];
  return {
    code: room.code,
    playerCount: room.playerCount,
    phase: room.phase,
    round: room.round,
    dealerIndex: room.dealerIndex,
    viewerIndex,
    host: viewer.id === room.hostSocket,
    players: room.players.map((p, i) => ({
      index: i,
      name: p.name,
      avatar: p.avatar || "😎",
      bot: p.bot,
      connected: p.connected,
      voiceJoined: Boolean(p.voiceJoined),
      voiceMuted: Boolean(p.voiceMuted),
      cards: p.hand.length,
      score: p.score,
      roundPoints: p.roundPoints,
      team: room.phase === "roundEnd" || room.playerCount === 8 ? p.team : (i === room.bid.bidderIndex ? "bidder" : null)
    })),
    hand: viewer.hand.map(publicCard),
    bid: {
      current: room.bid.current,
      bidderIndex: room.bid.bidderIndex,
      turnIndex: room.bid.turnIndex,
      passed: room.bid.passed.slice(),
      min: minBidFor(room),
      max: maxBidFor(room)
    },
    trump: room.trump,
    calledPartners: room.calledPartners.map(c => ({ suit: c.suit, rank: c.rank, copy: c.copy || 1, id: c.id || `${c.copy || 1}-${c.suit}-${c.rank}` })),
    revealedPartners: room.revealedPartners.slice(),
    bidderTeam: room.phase === "roundEnd" ? room.bidderTeam.slice() : room.revealedPartners.length ? room.bidderTeam.slice() : [room.bid.bidderIndex].filter(i => i !== null),
    turnIndex: room.turnIndex,
    leadSuit: room.leadSuit,
    trick: room.trick.map(t => ({ playerIndex: t.playerIndex, card: publicCard(t.card) })),
    trickNumber: room.trickNumber,
    lastTrick: room.lastTrick,
    partnerCount: partnerCountFor(room),
    log: room.log.slice(),
    chat: room.chat.slice(-40)
  };
}

function startRound(room) {
  room.round += 1;
  room.phase = "bidding";
  room.deck = makeDeck(room.playerCount);
  room.trump = null;
  room.calledPartners = [];
  room.revealedPartners = [];
  room.bidderTeam = [];
  room.leadSuit = null;
  room.trick = [];
  room.trickNumber = 0;
  room.lastTrick = null;

  room.players.forEach(p => {
    p.hand = [];
    p.roundPoints = 0;
    p.team = null;
  });

  const cardsEach = room.deck.length / room.playerCount;
  for (let c = 0; c < cardsEach; c++) {
    for (let p = 0; p < room.playerCount; p++) {
      room.players[p].hand.push(room.deck.pop());
    }
  }
  room.players.forEach(p => sortHand(p.hand));

  room.dealerIndex = (room.dealerIndex + 1) % room.playerCount;
  const firstBidder = (room.dealerIndex + 1) % room.playerCount;
  room.bid = {
    current: null,
    bidderIndex: null,
    turnIndex: firstBidder,
    passed: [],
    acted: []
  };
  addLog(room, `Round ${room.round} started. Bidding begins.`);
  emitRoom(room);
  scheduleBot(room);
}

function sortHand(hand) {
  const suitOrder = { S: 0, H: 1, D: 2, C: 3 };
  hand.sort((a, b) => suitOrder[a.suit] - suitOrder[b.suit] || RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
}

function nextActiveBidder(room, from) {
  for (let step = 1; step <= room.playerCount; step++) {
    const i = (from + step) % room.playerCount;
    if (!room.bid.passed.includes(i)) return i;
  }
  return from;
}

function handleBid(room, playerIndex, amount, pass) {
  if (room.phase !== "bidding" || room.bid.turnIndex !== playerIndex) return false;

  if (pass) {
    if (!room.bid.passed.includes(playerIndex)) room.bid.passed.push(playerIndex);
    addLog(room, `${room.players[playerIndex].name} passed.`);
  } else {
    const value = Number(amount);
    const minimum = room.bid.current === null ? minBidFor(room) : room.bid.current + 5;
    if (!Number.isInteger(value) || value < minimum || value > maxBidFor(room) || value % 5 !== 0) return false;
    room.bid.current = value;
    room.bid.bidderIndex = playerIndex;
    addLog(room, `${room.players[playerIndex].name} bid ${value}.`);
  }

  if (!room.bid.acted.includes(playerIndex)) room.bid.acted.push(playerIndex);

  if (room.bid.current === null && room.bid.passed.length >= room.playerCount) {
    addLog(room, "Everyone passed. Redealing.");
    setTimeout(() => startRound(room), 700);
    return true;
  }

  const activeNonBidder = room.players
    .map((_, i) => i)
    .filter(i => i !== room.bid.bidderIndex && !room.bid.passed.includes(i));

  if (room.bid.current !== null && activeNonBidder.length === 0) {
    finishBidding(room);
    return true;
  }

  room.bid.turnIndex = nextActiveBidder(room, playerIndex);
  emitRoom(room);
  scheduleBot(room);
  return true;
}

function finishBidding(room) {
  const bidder = room.bid.bidderIndex;
  if (bidder === null) return;
  addLog(room, `${room.players[bidder].name} wins the bid at ${room.bid.current}.`);

  room.phase = "contract";
  room.bidderTeam = [bidder];
  room.players[bidder].team = "bidder";
  emitRoom(room);
  scheduleBot(room);
}

function chooseContract(room, playerIndex, trump, partnerCards) {
  if (room.phase !== "contract" || room.bid.bidderIndex !== playerIndex) return false;
  if (!SUITS.includes(trump)) return false;

  room.trump = trump;
  const need = partnerCountFor(room);

  if (need > 0) {
    if (!Array.isArray(partnerCards) || partnerCards.length !== need) return false;
    const cleaned = [];
    const seen = new Set();
    for (const c of partnerCards) {
      if (!c || !SUITS.includes(c.suit) || !RANKS.includes(String(c.rank))) return false;
      const copy = room.playerCount === 8 ? Number(c.copy) : 1;
      if (![1,2].includes(copy) || (room.playerCount !== 8 && copy !== 1)) return false;
      const key = `${copy}-${c.suit}-${c.rank}`;
      if (seen.has(key)) return false;
      const owns = room.players[playerIndex].hand.some(h => h.id === key);
      if (owns) return false;
      seen.add(key);
      cleaned.push({ suit: c.suit, rank: String(c.rank), copy, id: key });
    }
    room.calledPartners = cleaned;
  }

  room.phase = "playing";
  room.turnIndex = room.bid.bidderIndex;
  room.leadSuit = null;
  room.trick = [];
  addLog(room, `${room.players[playerIndex].name} chose ${trump} as Hukum.`);
  emitRoom(room);
  scheduleBot(room);
  return true;
}

function legalCards(room, playerIndex) {
  const hand = room.players[playerIndex].hand;
  if (!room.leadSuit) return hand;
  const following = hand.filter(c => c.suit === room.leadSuit);
  return following.length ? following : hand;
}

function resolvePartnerReveal(room, playerIndex, card) {
  const isCalled = room.calledPartners.some(c => (c.id || `${c.copy || 1}-${c.suit}-${c.rank}`) === card.id);
  if (!isCalled || playerIndex === room.bid.bidderIndex) return;
  if (!room.bidderTeam.includes(playerIndex)) {
    room.bidderTeam.push(playerIndex);
    room.revealedPartners.push(playerIndex);
    room.players[playerIndex].team = "bidder";
    addLog(room, `${room.players[playerIndex].name} is revealed as a partner.`);
  }
  if (room.bidderTeam.length === 1 + partnerCountFor(room)) {
    room.players.forEach((p, i) => {
      if (!room.bidderTeam.includes(i)) p.team = "defense";
    });
  }
}

function playCard(room, playerIndex, cardId) {
  if (room.phase !== "playing" || room.turnIndex !== playerIndex) return false;
  const player = room.players[playerIndex];
  const idx = player.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return false;

  const card = player.hand[idx];
  const legal = legalCards(room, playerIndex);
  if (!legal.some(c => c.id === card.id)) return false;

  player.hand.splice(idx, 1);
  if (!room.leadSuit) room.leadSuit = card.suit;
  room.trick.push({ playerIndex, card });
  resolvePartnerReveal(room, playerIndex, card);
  addLog(room, `${player.name} played ${cardLabel(card)}.`);

  if (room.trick.length === room.playerCount) {
    resolveTrick(room);
  } else {
    room.turnIndex = (playerIndex + 1) % room.playerCount;
    emitRoom(room);
    scheduleBot(room);
  }
  return true;
}

function resolveTrick(room) {
  const lead = room.leadSuit;
  let winner = room.trick[0];

  function strength(play) {
    const c = play.card;
    // Kaali ni Tidi: every physical 3♠ is the absolute highest card.
    // With two decks, equal 3♠ cards tie, so the first one played remains the winner.
    if (c.suit === "S" && c.rank === "3") return 10000;
    const trumpBonus = c.suit === room.trump ? 1000 : 0;
    const leadBonus = c.suit === lead ? 500 : 0;
    return trumpBonus + leadBonus + RANK_VALUE[c.rank];
  }

  for (const p of room.trick.slice(1)) {
    if (strength(p) > strength(winner)) winner = p;
  }

  const points = room.trick.reduce((sum, p) => sum + cardPoints(p.card), 0);
  room.players[winner.playerIndex].roundPoints += points;
  room.lastTrick = {
    winnerIndex: winner.playerIndex,
    points,
    cards: room.trick.map(t => ({ playerIndex: t.playerIndex, card: publicCard(t.card) }))
  };
  room.trickNumber += 1;
  addLog(room, `${room.players[winner.playerIndex].name} won the trick (+${points}).`);

  room.turnIndex = winner.playerIndex;
  room.trick = [];
  room.leadSuit = null;

  const noCards = room.players.every(p => p.hand.length === 0);
  if (noCards) {
    finishRound(room);
  } else {
    emitRoom(room);
    scheduleBot(room);
  }
}

function finishRound(room) {
  room.players.forEach((p, i) => {
    if (room.bidderTeam.includes(i)) p.team = "bidder";
    else p.team = "defense";
  });

  const bidderPoints = room.players.reduce((sum, p, i) => sum + (room.bidderTeam.includes(i) ? p.roundPoints : 0), 0);
  const made = bidderPoints >= room.bid.current;
  const contract = room.bid.current;

  room.players.forEach((p, i) => {
    const onBidderTeam = room.bidderTeam.includes(i);
    if (made) {
      p.score += onBidderTeam ? contract : 0;
    } else {
      p.score += onBidderTeam ? -contract : contract;
    }
  });

  room.phase = "roundEnd";
  addLog(room, made
    ? `Bidder team made ${bidderPoints}/${contract}. Contract won.`
    : `Bidder team made ${bidderPoints}/${contract}. Contract failed.`);
  emitRoom(room);
}

function botBid(room, index) {
  const p = room.players[index];
  const points = p.hand.reduce((s, c) => s + cardPoints(c), 0);
  const trumpsPotential = Math.max(...SUITS.map(s => p.hand.filter(c => c.suit === s).length));
  const minimum = room.bid.current === null ? minBidFor(room) : room.bid.current + 5;
  const target = minBidFor(room) + Math.floor((points + trumpsPotential * 5) / 20) * 5;
  const shouldBid = target >= minimum && Math.random() > 0.28;
  if (shouldBid && minimum <= maxBidFor(room)) {
    handleBid(room, index, Math.min(maxBidFor(room), Math.max(minimum, target)), false);
  } else {
    handleBid(room, index, null, true);
  }
}

function botContract(room, index) {
  const hand = room.players[index].hand;
  const counts = SUITS.map(s => [s, hand.filter(c => c.suit === s).length]);
  counts.sort((a,b) => b[1] - a[1]);
  const trump = counts[0][0];
  const need = partnerCountFor(room);
  const choices = [];

  if (need > 0) {
    const preferred = [];
    const copies = room.playerCount === 8 ? [1,2] : [1];
    for (const suit of SUITS) {
      for (const rank of ["A","K","Q","J","10","5","3","9","8","7","6","4","2"]) {
        for (const copy of copies) {
          const id = `${copy}-${suit}-${rank}`;
          if (!hand.some(c => c.id === id)) preferred.push({ suit, rank, copy });
        }
      }
    }
    for (const c of preferred) {
      if (choices.length >= need) break;
      const key = `${c.copy}-${c.suit}-${c.rank}`;
      if (!choices.some(x => `${x.copy}-${x.suit}-${x.rank}` === key)) choices.push(c);
    }
  }
  chooseContract(room, index, trump, choices);
}

function botPlay(room, index) {
  const legal = legalCards(room, index);
  if (!legal.length) return;
  const sorted = legal.slice().sort((a,b) => {
    const pa = cardPoints(a), pb = cardPoints(b);
    if (pa !== pb) return pa - pb;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
  let choice = sorted[0];

  if (room.trick.length) {
    const currentPoints = room.trick.reduce((s,p) => s + cardPoints(p.card), 0);
    if (currentPoints >= 20) choice = sorted[sorted.length - 1];
  } else if (Math.random() > 0.65) {
    choice = sorted[sorted.length - 1];
  }
  playCard(room, index, choice.id);
}

function scheduleBot(room) {
  clearTimeout(room.botTimer);
  room.botTimer = setTimeout(() => {
    if (!rooms.has(room.code)) return;
    if (room.phase === "bidding") {
      const i = room.bid.turnIndex;
      if (room.players[i] && room.players[i].bot) botBid(room, i);
    } else if (room.phase === "contract") {
      const i = room.bid.bidderIndex;
      if (room.players[i] && room.players[i].bot) botContract(room, i);
    } else if (room.phase === "playing") {
      const i = room.turnIndex;
      if (room.players[i] && room.players[i].bot) botPlay(room, i);
    }
  }, 650);
}

function findRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    const index = room.players.findIndex(p => p.id === socketId);
    if (index >= 0) return { room, index };
  }
  return null;
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name, avatar, playerCount }, ack) => {
    const pc = Number(playerCount);
    if (![4,6,8].includes(pc)) return ack?.({ ok:false, error:"Choose 4, 6, or 8 players." });

    const code = roomCode();
    const room = createRoomState(code, socket.id, cleanName(name), cleanAvatar(avatar), pc);
    rooms.set(code, room);
    socket.join(code);
    ack?.({ ok:true, code });
    emitRoom(room);
  });

  socket.on("joinRoom", ({ name, avatar, code }, ack) => {
    const key = String(code || "").trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) return ack?.({ ok:false, error:"Room not found." });
    if (room.phase !== "lobby") return ack?.({ ok:false, error:"This game already started." });
    if (room.players.length >= room.playerCount) return ack?.({ ok:false, error:"Room is full." });

    room.players.push({
      id: socket.id,
      name: cleanName(name),
      avatar: cleanAvatar(avatar),
      bot: false,
      connected: true,
      voiceJoined: false,
      voiceMuted: false,
      hand: [],
      score: 0,
      team: null,
      roundPoints: 0
    });
    socket.join(key);
    ack?.({ ok:true, code:key });
    emitRoom(room);
  });

  socket.on("startGame", (_, ack) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostSocket !== socket.id) return ack?.({ ok:false, error:"Only the host can start." });
    if (room.phase !== "lobby" && room.phase !== "roundEnd") return;
    while (room.players.length < room.playerCount) addBot(room, room.players.length + 1);
    ack?.({ ok:true });
    startRound(room);
  });

  socket.on("bid", ({ amount, pass }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    handleBid(found.room, found.index, amount, Boolean(pass));
  });

  socket.on("contract", ({ trump, partnerCards }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    chooseContract(found.room, found.index, trump, partnerCards);
  });

  socket.on("playCard", ({ cardId }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    playCard(found.room, found.index, String(cardId || ""));
  });

  socket.on("nextRound", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room } = found;
    if (room.hostSocket !== socket.id || room.phase !== "roundEnd") return;
    startRound(room);
  });


  socket.on("chatMessage", ({ text }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, index } = found;
    const msg = cleanChat(text);
    if (!msg) return;
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      playerIndex: index,
      name: room.players[index].name,
      avatar: room.players[index].avatar || "😎",
      text: msg,
      ts: Date.now()
    };
    room.chat.push(item);
    room.chat = room.chat.slice(-40);
    emitRoom(room);
  });


  socket.on("voiceJoin", (_, ack) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return ack?.({ ok:false, error:"Room not found." });
    const { room, index } = found;
    const me = room.players[index];
    if (me.bot) return ack?.({ ok:false, error:"Bots cannot use voice." });
    const peers = room.players.map((p,i)=>({p,i})).filter(x=>x.i!==index && !x.p.bot && x.p.connected && x.p.voiceJoined).map(x=>x.i);
    me.voiceJoined = true; me.voiceMuted = false;
    socket.to(room.code).emit("voicePeerJoined", { playerIndex:index, name:me.name });
    emitRoom(room);
    ack?.({ ok:true, peers });
  });

  socket.on("voiceLeave", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, index } = found;
    room.players[index].voiceJoined = false; room.players[index].voiceMuted = false;
    socket.to(room.code).emit("voicePeerLeft", { playerIndex:index });
    emitRoom(room);
  });

  socket.on("voiceMuteState", ({ muted }) => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    found.room.players[found.index].voiceMuted = Boolean(muted);
    emitRoom(found.room);
  });

  socket.on("voiceSignal", ({ targetIndex, signal }) => {
    const found = findRoomBySocket(socket.id);
    if (!found || !signal || typeof signal !== "object") return;
    const { room, index } = found;
    const target = room.players[Number(targetIndex)];
    if (!room.players[index]?.voiceJoined || !target || target.bot || !target.connected || !target.voiceJoined) return;
    if (!["offer","answer","candidate"].includes(signal.kind)) return;
    io.to(target.id).emit("voiceSignal", { fromIndex:index, signal });
  });

  socket.on("disconnect", () => {
    const found = findRoomBySocket(socket.id);
    if (!found) return;
    const { room, index } = found;
    const p = room.players[index];

    if (p.voiceJoined) {
      p.voiceJoined = false; p.voiceMuted = false;
      socket.to(room.code).emit("voicePeerLeft", { playerIndex:index });
    }

    if (room.phase === "lobby") {
      room.players.splice(index, 1);
      if (!room.players.length) {
        rooms.delete(room.code);
        return;
      }
      if (room.hostSocket === socket.id) room.hostSocket = room.players[0].id;
    } else {
      p.connected = false;
      p.bot = true;
      p.id = `bot-reconnect-${room.code}-${index}`;
      p.name = `${p.name} (Bot)`;
      addLog(room, `${p.name} is now controlled by a bot.`);
      if (room.hostSocket === socket.id) {
        const nextHuman = room.players.find(x => !x.bot && x.connected);
        room.hostSocket = nextHuman ? nextHuman.id : room.players[0].id;
      }
    }
    emitRoom(room);
    scheduleBot(room);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Kaali Ni Tidi running on port ${PORT}`);
});
