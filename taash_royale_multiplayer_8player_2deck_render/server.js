
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "public");
const rooms = new Map();

const SUITS = [
  { s: "♠", red: false }, { s: "♥", red: true },
  { s: "♦", red: true }, { s: "♣", red: false }
];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RVAL = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));

function id(){ return crypto.randomUUID(); }
function code(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for(let i=0;i<5;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
function freshCode(){
  let c;
  do { c = code(); } while(rooms.has(c));
  return c;
}
function deck(){
  return SUITS.flatMap(su=>RANKS.map(rank=>({
    rank, suit: su.s, red: su.red, id: rank + su.s
  })));
}
function kaliDeck(copies=1){
  const cards=[];
  for(let copy=1; copy<=copies; copy++){
    for(const su of SUITS){
      for(const rank of RANKS){
        const face=rank+su.s;
        cards.push({rank,suit:su.s,red:su.red,face,copy,id:`${face}#${copy}`});
      }
    }
  }
  return cards;
}
function cardFace(c){ return c.face || c.id; }
function kaliBidOptions(deckCount){
  return deckCount===1 ? [150,160,170,180,190,200,210] : [250,270,290,310,330,350,370,390,410,430,450];
}
function shuffle(a){
  a=[...a];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function send(ws, type, data={}){
  if(ws.readyState===1) ws.send(JSON.stringify({type,...data}));
}
function roomOf(ws){ return ws.roomCode ? rooms.get(ws.roomCode) : null; }
function playerOf(room, ws){ return room.players.find(p=>p.id===ws.playerId); }
function clientFor(player){ return player.ws; }

const mime = {
  ".html":"text/html; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml; charset=utf-8",
  ".png":"image/png",
  ".ico":"image/x-icon"
};

const server = http.createServer((req,res)=>{
  let u = decodeURIComponent(req.url.split("?")[0]);
  if(u === "/") u = "/index.html";
  const file = path.normalize(path.join(ROOT, u));
  if(!file.startsWith(ROOT)){
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(file,(err,data)=>{
    if(err){ res.writeHead(404,{"Content-Type":"text/plain"}); return res.end("Not found"); }
    res.writeHead(200,{"Content-Type": mime[path.extname(file)] || "application/octet-stream"});
    res.end(data);
  });
});

const wss = new WebSocketServer({server});

wss.on("connection", ws=>{
  ws.playerId = id();
  ws.roomCode = null;
  send(ws,"connected",{playerId:ws.playerId});

  ws.on("message", raw=>{
    let m;
    try{ m=JSON.parse(raw.toString()); }catch{ return; }
    handle(ws,m);
  });
  ws.on("close",()=>leaveRoom(ws,true));
});

function handle(ws,m){
  switch(m.type){
    case "create_room": return createRoom(ws,m);
    case "join_room": return joinRoom(ws,m);
    case "leave_room": return leaveRoom(ws,false);
    case "set_game": return setGame(ws,m);
    case "start_game": return startGame(ws);
    case "kali_setup": return kaliSetup(ws,m);
    case "game_action": return gameAction(ws,m);
    case "signal": return relaySignal(ws,m);
    default: send(ws,"error",{message:"Unknown action"});
  }
}

function cleanName(v){
  return String(v||"Player").replace(/[<>]/g,"").trim().slice(0,18) || "Player";
}
function createRoom(ws,m){
  leaveRoom(ws,false);
  const c=freshCode();
  const room={
    code:c,
    hostId:ws.playerId,
    game:m.game==="kali"?"kali":"teen",
    players:[],
    started:false,
    state:null
  };
  rooms.set(c,room);
  ws.roomCode=c;
  room.players.push({id:ws.playerId,name:cleanName(m.name),ws,connected:true});
  send(ws,"room_created",{code:c});
  broadcastRoom(room);
}
function joinRoom(ws,m){
  const c=String(m.code||"").trim().toUpperCase();
  const room=rooms.get(c);
  if(!room) return send(ws,"error",{message:"Room not found"});
  if(room.started) return send(ws,"error",{message:"Game already started"});
  const maxPlayers=room.game==="kali"?8:4;
  if(room.players.length>=maxPlayers) return send(ws,"error",{message:`Room is full (${maxPlayers} players max)`});
  leaveRoom(ws,false);
  ws.roomCode=c;
  room.players.push({id:ws.playerId,name:cleanName(m.name),ws,connected:true});
  broadcastRoom(room);
}
function leaveRoom(ws, disconnected){
  const room=roomOf(ws);
  if(!room) return;
  room.players = room.players.filter(p=>p.id!==ws.playerId);
  ws.roomCode=null;

  if(!room.players.length){
    rooms.delete(room.code);
    return;
  }
  if(room.hostId===ws.playerId) room.hostId=room.players[0].id;

  if(room.started){
    room.started=false;
    room.state=null;
    for(const p of room.players) send(p.ws,"notice",{message:"A player left. The table returned to the lobby."});
  }
  broadcastRoom(room);
}
function setGame(ws,m){
  const room=roomOf(ws);
  if(!room || room.hostId!==ws.playerId || room.started) return;
  const next=m.game==="kali"?"kali":"teen";
  if(next==="teen" && room.players.length>4)
    return send(ws,"error",{message:"Teen Patti supports a maximum of 4 players. Remove extra players first."});
  room.game=next;
  broadcastRoom(room);
}
function broadcastRoom(room){
  const payload={
    code:room.code,
    hostId:room.hostId,
    game:room.game,
    started:room.started,
    players:room.players.map((p,i)=>({id:p.id,name:p.name,index:i}))
  };
  for(const p of room.players) send(p.ws,"room_state",{room:payload});
  if(room.started) broadcastGame(room);
}
function relaySignal(ws,m){
  const room=roomOf(ws);
  if(!room) return;
  const target=room.players.find(p=>p.id===m.to);
  if(target) send(target.ws,"signal",{from:ws.playerId,data:m.data});
}
function startGame(ws){
  const room=roomOf(ws);
  if(!room || room.hostId!==ws.playerId || room.started) return;
  if(room.game==="teen" && (room.players.length<2 || room.players.length>4))
    return send(ws,"error",{message:"Teen Patti needs 2–4 players"});
  if(room.game==="kali" && (room.players.length<4 || room.players.length>8))
    return send(ws,"error",{message:"Kali Ni Teedi needs 4–8 players"});
  room.started=true;
  if(room.game==="teen") startTeen(room);
  else startKali(room);
  broadcastRoom(room);
}

/* ---------------- Teen Patti ---------------- */
function startTeen(room){
  const d=shuffle(deck());
  room.state={
    type:"teen", phase:"play",
    dealer:Math.floor(Math.random()*room.players.length),
    turn:0, pot:0, stake:10, winner:null, message:"",
    players:room.players.map((p,i)=>({
      id:p.id,name:p.name,chips:1000,folded:false,seen:false,hand:d.slice(i*3,i*3+3)
    }))
  };
  const s=room.state;
  for(const p of s.players){ p.chips-=10; s.pot+=10; }
  s.turn=(s.dealer+1)%s.players.length;
}
function teenScore(hand){
  const vals=hand.map(c=>RVAL[c.rank]).sort((a,b)=>b-a);
  const suits=hand.map(c=>c.suit);
  const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const freq=Object.entries(counts).sort((a,b)=>b[1]-a[1] || Number(b[0])-Number(a[0]));
  const flush=new Set(suits).size===1;
  const sorted=[...new Set(vals)].sort((a,b)=>b-a);
  let seq=false, high=0;
  if(sorted.length===3){
    if(sorted[0]-sorted[1]===1 && sorted[1]-sorted[2]===1){ seq=true; high=sorted[0]; }
    if(sorted.join(",")==="14,3,2"){ seq=true; high=3; }
  }
  if(freq[0][1]===3) return [6,Number(freq[0][0])];
  if(seq&&flush) return [5,high];
  if(seq) return [4,high];
  if(flush) return [3,...vals];
  if(freq[0][1]===2) return [2,Number(freq[0][0]),Number(freq[1][0])];
  return [1,...vals];
}
function cmpHands(a,b){
  const A=teenScore(a),B=teenScore(b);
  for(let i=0;i<Math.max(A.length,B.length);i++){
    const x=A[i]||0,y=B[i]||0;
    if(x!==y) return x-y;
  }
  return 0;
}
function handLabel(hand){
  return ["","High Card","Pair","Colour","Sequence","Pure Sequence","Trail / Trio"][teenScore(hand)[0]];
}
function teenActive(s){ return s.players.map((p,i)=>({p,i})).filter(x=>!x.p.folded); }
function nextTeenTurn(s){
  const act=teenActive(s);
  if(act.length<=1) return teenFinishSingle(s,act[0]?.i);
  let n=s.turn;
  do{ n=(n+1)%s.players.length; }while(s.players[n].folded);
  s.turn=n;
}
function teenFinishSingle(s,idx){
  if(idx==null) return;
  s.phase="ended"; s.winner=idx;
  s.players[idx].chips+=s.pot;
  s.message=`${s.players[idx].name} wins the pot`;
}
function teenShowdown(s){
  const active=teenActive(s);
  let win=active[0];
  for(const x of active.slice(1)) if(cmpHands(x.p.hand,win.p.hand)>0) win=x;
  s.phase="ended"; s.winner=win.i;
  s.players[win.i].chips+=s.pot;
  s.message=`${s.players[win.i].name} wins with ${handLabel(s.players[win.i].hand)}`;
}
function teenAction(room,idx,action){
  const s=room.state,p=s.players[idx];
  if(s.phase!=="play") return;
  if(action==="see"){
    p.seen=true; return;
  }
  if(idx!==s.turn || p.folded) return;
  if(action==="fold"){
    p.folded=true;
    nextTeenTurn(s);
    return;
  }
  if(action==="show"){
    if(teenActive(s).length===2) teenShowdown(s);
    return;
  }
  if(action==="raise"){
    s.stake=Math.min(s.stake*2,160);
  }
  if(action==="call" || action==="raise"){
    const cost=Math.min((p.seen?2:1)*s.stake,p.chips);
    p.chips-=cost; s.pot+=cost;
    nextTeenTurn(s);
  }
}
function newTeenRound(room){
  const old=room.state;
  const balances=old.players.map(p=>p.chips);
  const d=shuffle(deck());
  room.state={
    type:"teen", phase:"play",
    dealer:(old.dealer+1)%room.players.length,
    turn:0,pot:0,stake:10,winner:null,message:"",
    players:room.players.map((p,i)=>({
      id:p.id,name:p.name,chips:balances[i]||1000,folded:false,seen:false,hand:d.slice(i*3,i*3+3)
    }))
  };
  const s=room.state;
  for(const p of s.players){
    if(p.chips<10) p.chips=1000;
    p.chips-=10; s.pot+=10;
  }
  s.turn=(s.dealer+1)%s.players.length;
}

/* ---------------- Kali Ni Teedi ---------------- */
function startKali(room){
  const playerCount=room.players.length;
  const deckCount=playerCount>4?2:1;
  const d=shuffle(kaliDeck(deckCount));
  const hands=Array.from({length:playerCount},(_,i)=>d.slice(i*13,i*13+13));
  room.state={
    type:"kali", phase:"setup", bidder:0, playerCount, deckCount,
    hands,
    bid:deckCount===1?160:310,trump:"♠",called:null,calledLabel:null,partner:null,partnerRevealed:false,
    trick:[],leader:0,turn:0,trickNo:0,scores:Array(playerCount).fill(0),
    winnerSide:null,message:"",resolving:false,trickWinner:null,trickPoints:0
  };
}
function kaliCallOptions(s){
  const bidderHand=new Set(s.hands[s.bidder].map(c=>c.id));
  const dealt=s.hands.flat();
  return dealt
    .filter(c=>!bidderHand.has(c.id) && ["A","K","Q","J","10"].includes(c.rank))
    .map(c=>({id:c.id,rank:c.rank,suit:c.suit,face:c.face,copy:c.copy,label:s.deckCount>1?`${c.face} • Deck ${c.copy}`:c.face}));
}
function kaliSetup(ws,m){
  const room=roomOf(ws);
  if(!room || !room.started || room.game!=="kali") return;
  const idx=room.players.findIndex(p=>p.id===ws.playerId);
  const s=room.state;
  if(idx!==s.bidder || s.phase!=="setup") return;
  const bid=Number(m.bid), trump=String(m.trump||"");
  const called=String(m.called||"");
  const bids=kaliBidOptions(s.deckCount);
  if(!bids.includes(bid)) return send(ws,"error",{message:"Invalid contract"});
  if(!["♠","♥","♦","♣"].includes(trump)) return send(ws,"error",{message:"Invalid hukum"});
  const options=kaliCallOptions(s);
  const calledCard=options.find(c=>c.id===called);
  if(!calledCard) return send(ws,"error",{message:"Choose a valid hidden partner card"});
  let partner=-1;
  for(let i=0;i<s.playerCount;i++) if(s.hands[i].some(c=>c.id===called)) partner=i;
  if(partner<0 || partner===idx) return send(ws,"error",{message:"Partner card unavailable"});
  s.bid=bid; s.trump=trump; s.called=called; s.calledLabel=calledCard.label; s.partner=partner;
  s.phase="play"; s.turn=0; s.leader=0;
  broadcastGame(room);
}
function kaliPoints(c){
  if(cardFace(c)==="3♠") return 30;
  if(["A","K","Q","J","10"].includes(c.rank)) return 10;
  if(c.rank==="5") return 5;
  return 0;
}
function kaliBeats(a,b,lead,trump){
  const af=cardFace(a), bf=cardFace(b);
  if(af==="3♠" && bf==="3♠") return false; // identical duplicate: first played stays ahead
  if(af==="3♠") return true;
  if(bf==="3♠") return false;
  const at=a.suit===trump, bt=b.suit===trump;
  if(at!==bt) return at;
  if(a.suit===b.suit){
    if(RVAL[a.rank]===RVAL[b.rank]) return false; // identical duplicate: first played wins tie
    return RVAL[a.rank]>RVAL[b.rank];
  }
  if(a.suit===lead && b.suit!==lead) return true;
  return false;
}
function kaliTrickWinner(s){
  const lead=s.trick[0].card.suit;
  let best=s.trick[0];
  for(const x of s.trick.slice(1))
    if(kaliBeats(x.card,best.card,lead,s.trump)) best=x;
  return best.player;
}
function kaliPlay(room,idx,cardId){
  const s=room.state;
  if(s.phase!=="play" || s.resolving || s.turn!==idx) return;
  const hand=s.hands[idx];
  const ci=hand.findIndex(c=>c.id===cardId);
  if(ci<0) return;
  const card=hand[ci];
  if(s.trick.length){
    const lead=s.trick[0].card.suit;
    const hasLead=hand.some(c=>c.suit===lead);
    if(hasLead && card.suit!==lead) return;
  }
  hand.splice(ci,1);
  s.trick.push({player:idx,card});
  if(card.id===s.called) s.partnerRevealed=true;

  if(s.trick.length===s.playerCount){
    const winner=kaliTrickWinner(s);
    const pts=s.trick.reduce((sum,x)=>sum+kaliPoints(x.card),0);
    s.resolving=true;
    s.trickWinner=winner;
    s.trickPoints=pts;
    s.scores[winner]+=pts;
    s.message=`${room.players[winner].name} takes the trick for ${pts} points`;

    setTimeout(()=>{
      if(!rooms.has(room.code) || room.state!==s || s.phase!=="play") return;
      s.trickNo++;
      s.trick=[];
      s.leader=winner;
      s.turn=winner;
      s.resolving=false;
      s.trickWinner=null;
      s.trickPoints=0;

      if(s.trickNo===13){
        const team=s.scores[0]+s.scores[s.partner];
        s.phase="ended";
        s.winnerSide=team>=s.bid?"bidder":"defenders";
        s.message=team>=s.bid ? `Contract made with ${team} points` : `Contract failed with ${team} points`;
      }else{
        s.message="";
      }
      broadcastGame(room);
    },1200);
  }else{
    s.turn=(s.turn+1)%s.playerCount;
  }
}
function newKaliHand(room){ startKali(room); }

/* ---------------- Shared actions / personalized state ---------------- */
function gameAction(ws,m){
  const room=roomOf(ws);
  if(!room || !room.started || !room.state) return;
  const idx=room.players.findIndex(p=>p.id===ws.playerId);
  if(idx<0) return;

  if(room.game==="teen"){
    if(m.action==="new_round" && room.hostId===ws.playerId && room.state.phase==="ended") newTeenRound(room);
    else teenAction(room,idx,m.action);
  }else{
    if(m.action==="play_card") kaliPlay(room,idx,String(m.cardId||""));
    else if(m.action==="new_hand" && room.hostId===ws.playerId && room.state.phase==="ended") newKaliHand(room);
  }
  broadcastGame(room);
}
function broadcastGame(room){
  if(!room.state) return;
  for(let i=0;i<room.players.length;i++){
    send(room.players[i].ws,"game_state",{game:publicGameFor(room,i),youIndex:i});
  }
}
function publicGameFor(room,you){
  const s=room.state;
  if(s.type==="teen"){
    const showdown=s.phase==="ended";
    return {
      type:"teen",phase:s.phase,dealer:s.dealer,turn:s.turn,pot:s.pot,stake:s.stake,
      winner:s.winner,message:s.message,
      players:s.players.map((p,i)=>({
        id:p.id,name:p.name,chips:p.chips,folded:p.folded,seen:p.seen,
        handCount:3,
        hand:(i===you || showdown)?p.hand:null
      }))
    };
  }
  const partnerVisible=s.partnerRevealed || s.phase==="ended";
  return {
    type:"kali",phase:s.phase,bidder:s.bidder,playerCount:s.playerCount,deckCount:s.deckCount,
    bid:s.bid,trump:s.trump,called:s.called,calledLabel:s.calledLabel,
    bidOptions:kaliBidOptions(s.deckCount),callOptions:you===s.bidder&&s.phase==="setup"?kaliCallOptions(s):[],
    partner:partnerVisible?s.partner:null,partnerRevealed:partnerVisible,
    turn:s.turn,leader:s.leader,trickNo:s.trickNo,trick:s.trick,
    scores:s.scores,winnerSide:s.winnerSide,message:s.message,
    resolving:s.resolving,trickWinner:s.trickWinner,trickPoints:s.trickPoints,
    hand:s.hands[you],
    handCounts:s.hands.map(h=>h.length)
  };
}

server.listen(PORT,()=>console.log(`Taash Royale Multiplayer listening on ${PORT}`));
