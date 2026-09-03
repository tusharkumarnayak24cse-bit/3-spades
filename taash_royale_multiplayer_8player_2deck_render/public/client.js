
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let ws=null, myId=null, room=null, game=null, youIndex=0, selectedGame="teen";
let toastTimer=null, micStream=null, micOn=false;
const peers=new Map();

const SUITS=[{s:"♠",name:"Spades",red:false},{s:"♥",name:"Hearts",red:true},{s:"♦",name:"Diamonds",red:true},{s:"♣",name:"Clubs",red:false}];
const RANKS=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];

function show(id){ $$(".screen").forEach(x=>x.classList.remove("active")); $("#"+id).classList.add("active"); }
function toast(t){ const el=$("#toast"); el.textContent=t; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1800); }
function send(type,data={}){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({type,...data})); }
function initSocket(){
  const proto=location.protocol==="https:"?"wss":"ws";
  ws=new WebSocket(`${proto}://${location.host}`);
  ws.onmessage=e=>handle(JSON.parse(e.data));
  ws.onclose=()=>toast("Connection lost. Refresh to reconnect.");
}
function handle(m){
  if(m.type==="connected"){ myId=m.playerId; return; }
  if(m.type==="error"){ toast(m.message); return; }
  if(m.type==="notice"){ toast(m.message); return; }
  if(m.type==="room_created"){ toast(`Room ${m.code} created`); return; }
  if(m.type==="room_state"){
    room=m.room;
    if(room.started) show("game"); else { show("lobby"); renderLobby(); }
    syncPeers();
    return;
  }
  if(m.type==="game_state"){
    game=m.game; youIndex=m.youIndex; show("game"); renderGame(); return;
  }
  if(m.type==="signal"){ handleSignal(m.from,m.data); }
}

document.addEventListener("DOMContentLoaded",()=>{
  const saved=localStorage.getItem("taash_name")||"";
  $("#nameInput").value=saved;
  $$(".gameCard").forEach(b=>b.onclick=()=>selectGame(b.dataset.game));
  $("#createBtn").onclick=createRoom; $("#joinBtn").onclick=joinRoom;
  $("#copyBtn").onclick=copyCode; $("#startBtn").onclick=()=>send("start_game");
  $$(".gameSwitch button").forEach(b=>b.onclick=()=>{ if(room&&room.hostId===myId) send("set_game",{game:b.dataset.game}); });
  $("#homeBtn").onclick=leaveToHome;
  $("#micBtn").onclick=toggleMic;
  $("#helpBtn").onclick=help;
  $("#closeModal").onclick=()=>$("#modal").classList.remove("open");
  $("#modal").onclick=e=>{if(e.target.id==="modal") $("#modal").classList.remove("open")};
  initSocket();
});
function selectGame(g){
  selectedGame=g;
  $$(".gameCard").forEach(b=>b.classList.toggle("selected",b.dataset.game===g));
}
function getName(){
  const n=$("#nameInput").value.trim()||"Player";
  localStorage.setItem("taash_name",n); return n;
}
function createRoom(){ send("create_room",{name:getName(),game:selectedGame}); }
function joinRoom(){
  const c=$("#codeInput").value.trim().toUpperCase();
  if(c.length!==5) return toast("Enter the 5-character room code");
  send("join_room",{name:getName(),code:c});
}
function copyCode(){
  if(!room)return;
  navigator.clipboard?.writeText(room.code);
  toast("Room code copied");
}
function leaveToHome(){
  if(room) send("leave_room");
  room=null;game=null;closeVoice();show("landing");
}
function initials(n){ return n.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase(); }

function renderLobby(){
  $("#roomCode").textContent=room.code;
  $$(".gameSwitch button").forEach(b=>{
    b.classList.toggle("active",b.dataset.game===room.game);
    b.disabled=room.hostId!==myId;
  });
  let html="";
  const slots=room.game==="kali"?8:4;
  for(let i=0;i<slots;i++){
    const p=room.players[i];
    html += p ? `<div class="playerSlot"><div class="bigAvatar">${initials(p.name)}</div><b>${esc(p.name)}</b><small>${p.id===room.hostId?"HOST":"PLAYER "+(i+1)}</small></div>`
      : `<div class="playerSlot empty">Waiting for player…</div>`;
  }
  $("#playersGrid").innerHTML=html;
  const host=room.hostId===myId;
  $("#startBtn").style.display=host?"block":"none";
  const ok=room.game==="teen"?(room.players.length>=2&&room.players.length<=4):(room.players.length>=4&&room.players.length<=8);
  $("#startBtn").disabled=!ok;
  $("#lobbyHint").textContent=host
    ? (ok?"Everyone ready — start when you want.":room.game==="teen"?"Invite 1–3 friends (2–4 total).":"Kali Ni Teedi needs 4–8 players. 5–8 players automatically use 2 decks.")
    : "Waiting for the host to start.";
}
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }

function cardHTML(c,cls="",back=false){
  if(back)return `<div class="card back ${cls}"></div>`;
  return `<div class="card ${c.red?"redCard":""} ${(c.face||c.id).startsWith("3♠")?"special":""} ${cls}" data-id="${c.id}">
    <span class="r">${c.rank}</span><span class="s">${c.suit}</span><span class="p">${c.suit}</span></div>`;
}
function tinyBacks(n){ return Array.from({length:Math.min(n,5)},()=>`<div class="tinyBack"></div>`).join(""); }

function relativeSeat(playerIndex,total){
  return (playerIndex-youIndex+total)%total;
}
function seatPoint(rel,total){
  // Human player is always at the bottom; everyone else is distributed around the oval.
  const angle=(90 + rel*(360/total))*Math.PI/180;
  const rx=total>6?45:42, ry=total>6?43:41;
  return {x:50+Math.cos(angle)*rx,y:50+Math.sin(angle)*ry};
}
function playedStyle(playerIndex){
  const total=room.players.length;
  const rel=relativeSeat(playerIndex,total);
  const angle=(90 + rel*(360/total))*Math.PI/180;
  const rx=total>6?42:38, ry=total>6?39:35;
  const scale=total>=7?.62:total>=5?.72:.88;
  const x=50+Math.cos(angle)*rx, y=50+Math.sin(angle)*ry;
  return `left:${x}%;top:${y}%;transform:translate(-50%,-50%) scale(${scale});`;
}
function renderPlayersCommon(players, turn){
  const total=players.length;
  const layer=$("#seats");
  $("#table").classList.toggle("manyPlayers",total>4);
  layer.innerHTML="";
  players.forEach((p,i)=>{
    const rel=relativeSeat(i,total), pt=seatPoint(rel,total);
    const el=document.createElement("div");
    el.className=`seat dynamic ${i===turn?"active":""} ${p.folded?"folded":""}`;
    el.style.left=pt.x+"%"; el.style.top=pt.y+"%";
    el.innerHTML=`<div class="avatar">${initials(p.name)}</div><div class="seatInfo"><b>${esc(p.name)}${i===youIndex?" (You)":""}</b><small>${p.meta||""}</small></div>${i!==youIndex?`<div class="backs">${tinyBacks(p.handCount||0)}</div>`:""}`;
    layer.appendChild(el);
  });
}
function renderGame(){
  if(!game)return;
  if(game.type==="teen")renderTeen(); else renderKali();
}
function renderTeen(){
  $("#status").textContent=game.phase==="ended"?"ROUND OVER":game.turn===youIndex?"YOUR TURN":`${game.players[game.turn].name.toUpperCase()}'S TURN`;
  const ps=game.players.map(p=>({...p,meta:`${p.folded?"Folded • ":""}${p.seen?"Seen":"Blind"} • ◉ ${p.chips}`}));
  renderPlayersCommon(ps,game.phase==="play"?game.turn:-1);
  $("#center").innerHTML=`<div class="pot"><small>POT</small><b><span class="chip"></span>${game.pot}</b><div style="font-size:8px;color:#8fa398;margin-top:3px">Stake ${game.stake}</div></div>`;
  const me=game.players[youIndex];
  $("#hand").className="hand teen";
  if(me.hand) $("#hand").innerHTML=me.hand.map(c=>cardHTML(c,"",!me.seen && game.phase!=="ended")).join("");
  else $("#hand").innerHTML="";
  if(game.phase==="ended"){
    $$(".backs").forEach(()=>{});
  }
  renderTeenControls();
}
function renderTeenControls(){
  const me=game.players[youIndex], myTurn=game.phase==="play"&&game.turn===youIndex&&!me.folded;
  const active=game.players.filter(p=>!p.folded).length;
  if(game.phase==="ended"){
    $("#controls").innerHTML=`<div class="ctrlInfo"><small>RESULT</small><b>${esc(game.message)}</b></div>${room.hostId===myId?'<button class="action gold" data-act="new_round">NEW ROUND</button>':''}`;
  }else{
    const cost=(me.seen?2:1)*game.stake;
    $("#controls").innerHTML=`
      <div class="ctrlInfo"><small>YOUR CHIPS</small><b>◉ ${me.chips}</b></div>
      <button class="action" data-act="see" ${me.seen?"disabled":""}>SEE CARDS</button>
      <button class="action gold" data-act="call" ${myTurn?"":"disabled"}>CHAAL ${cost}</button>
      <button class="action" data-act="raise" ${myTurn?"":"disabled"}>RAISE</button>
      <button class="action red" data-act="fold" ${myTurn?"":"disabled"}>FOLD</button>
      <button class="action" data-act="show" ${myTurn&&active===2?"":"disabled"}>SHOW</button>`;
  }
  $$("#controls [data-act]").forEach(b=>b.onclick=()=>send("game_action",{action:b.dataset.act}));
  if(game.phase==="ended" && !$("#modal").classList.contains("open")) {
    const w=game.winner===youIndex?"You win!":`${game.players[game.winner]?.name||"Player"} wins`;
    modal(`<h2>${w}</h2><p>${esc(game.message)}</p>${room.hostId===myId?'<button class="goldBtn wide" onclick="send(\'game_action\',{action:\'new_round\'});document.querySelector(\'#modal\').classList.remove(\'open\')">PLAY NEXT ROUND</button>':"<p>Waiting for the host to start the next round.</p>"}`);
  }
}
function partnerChoices(){
  return game.callOptions||[];
}
function renderKali(){
  const players=room.players.map((p,i)=>({
    name:p.name,folded:false,handCount:game.handCounts[i],
    meta:`${game.partnerRevealed&&game.partner===i?"Partner • ":""}${game.scores[i]} pts`
  }));
  renderPlayersCommon(players,game.phase==="play"?game.turn:-1);
  $("#status").textContent=game.phase==="setup"?"SET CONTRACT":
    game.phase==="ended"?"HAND OVER":
    game.resolving&&game.trickWinner!==null?`${room.players[game.trickWinner].name.toUpperCase()} TAKES TRICK`:
    game.turn===youIndex?"YOUR TURN":`${room.players[game.turn].name.toUpperCase()}'S TURN`;

  if(game.trick.length){
    $("#center").innerHTML=`<div class="trick">${game.trick.map(x=>`<div class="played" style="${playedStyle(x.player)}">${cardHTML(x.card)}</div>`).join("")}</div>`;
  }else{
    $("#center").innerHTML=`<div class="pot"><small>TRICK</small><b>${Math.min(game.trickNo+1,13)} / 13</b><div style="font-size:8px;color:#8fa398;margin-top:3px">Hukum ${game.trump||"—"} • Bid ${game.bid||"—"}</div></div>`;
  }
  renderKaliHand();
  renderKaliControls();
}
function legalKaliIds(){
  if(game.phase!=="play"||game.resolving||game.turn!==youIndex)return new Set();
  if(!game.trick.length)return new Set(game.hand.map(c=>c.id));
  const lead=game.trick[0].card.suit;
  const follow=game.hand.filter(c=>c.suit===lead);
  return new Set((follow.length?follow:game.hand).map(c=>c.id));
}
function renderKaliHand(){
  const legal=legalKaliIds();
  $("#hand").className="hand";
  $("#hand").innerHTML=game.hand.map(c=>cardHTML(c,legal.has(c.id)?"playable":"disabled")).join("");
  $$("#hand .playable").forEach(c=>c.onclick=()=>send("game_action",{action:"play_card",cardId:c.dataset.id}));
}
function renderKaliControls(){
  if(game.phase==="setup"){
    if(youIndex!==game.bidder){
      $("#controls").innerHTML=`<div class="ctrlInfo"><small>WAITING</small><b>${esc(room.players[game.bidder].name)} is setting the contract</b></div>`;
      return;
    }
    const opts=partnerChoices().map(c=>`<option value="${c.id}">${c.label||((c.face||c.rank+c.suit))}</option>`).join("");
    $("#controls").innerHTML=`<div class="setup">
      <div class="field"><label>Contract</label><select id="bid">${(game.bidOptions||[]).map(v=>`<option ${v===game.bid?"selected":""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label>Hukum</label><select id="trump">${SUITS.map(s=>`<option value="${s.s}">${s.s} ${s.name}</option>`).join("")}</select></div>
      <div class="field"><label>Call Partner</label><select id="called">${opts}</select></div>
      <button class="action gold" id="beginKali">START HAND</button></div>`;
    $("#beginKali").onclick=()=>send("kali_setup",{bid:+$("#bid").value,trump:$("#trump").value,called:$("#called").value});
  } else if(game.phase==="ended"){
    const team=game.scores[0]+game.scores[game.partner];
    const def=game.scores.reduce((a,b)=>a+b,0)-team;
    $("#controls").innerHTML=`<div class="ctrlInfo"><small>FINAL</small><b>${game.message}</b></div>${room.hostId===myId?'<button class="action gold" data-new>NEW HAND</button>':''}`;
    $("#controls [data-new]")?.addEventListener("click",()=>send("game_action",{action:"new_hand"}));
    if(!$("#modal").classList.contains("open")){
      modal(`<h2>${game.winnerSide==="bidder"?"Bidder side wins":"Defenders win"}</h2>
      <div class="resultGrid"><div class="resultBox"><small>BIDDER SIDE</small><b>${team}</b></div><div class="resultBox"><small>DEFENDERS</small><b>${def}</b></div></div>
      <p>Hidden partner: <b>${esc(room.players[game.partner].name)}</b> • Called card: <b>${game.calledLabel||game.called}</b> • Contract: <b>${game.bid}</b></p>
      ${room.hostId===myId?'<button class="goldBtn wide" onclick="send(\'game_action\',{action:\'new_hand\'});document.querySelector(\'#modal\').classList.remove(\'open\')">PLAY NEW HAND</button>':"<p>Waiting for the host to start a new hand.</p>"}`);
    }
  } else {
    const pts=game.scores[youIndex];
    $("#controls").innerHTML=`<div class="ctrlInfo"><small>YOUR POINTS</small><b>${pts}</b></div><div class="ctrlInfo"><small>CALLED CARD</small><b>${game.calledLabel||game.called}</b></div><button class="action" onclick="help()">RULES</button>`;
  }
}
function modal(html){ $("#modalBody").innerHTML=html; $("#modal").classList.add("open"); }
function help(){
  if(!game){
    modal(`<h2>How to play</h2><p>Create a room and share the 5-character code. Everyone opens the same deployed website and joins the same room.</p><h3>Voice</h3><p>Tap 🎙️ to allow microphone access. Voice is peer-to-peer through WebRTC.</p>`);
  }else if(game.type==="teen"){
    modal(`<h2>Teen Patti</h2><p>Three cards each. Virtual chips only.</p><h3>Hand ranking</h3><p>Trail/Trio → Pure Sequence → Sequence → Colour → Pair → High Card.</p><h3>Blind / Seen</h3><p>Seen players pay 2× the table stake in this casual table version. Show becomes available when two players remain.</p>`);
  }else{
    modal(`<h2>Kali Ni Teedi</h2><p>Supports 4–8 players, 13 cards each. Four players use one deck; 5–8 players use two decks, so an 8-player hand deals all 104 cards.</p><h3>Hidden partner with 2 decks</h3><p>Duplicate cards are treated as Deck 1 / Deck 2 copies so the called card identifies exactly one hidden partner. If identical cards meet in a trick, the copy played first wins the tie.</p><h3>Points</h3><p>Each 3♠ = 30 and beats every non-3♠ card. A/K/Q/J/10 = 10 each. Every 5 = 5. Follow the lead suit when possible.</p>`);
  }
}

/* ---------------- WebRTC voice ---------------- */
async function toggleMic(){
  if(micOn){ closeVoice(); toast("Microphone off"); return; }
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    micOn=true; $("#micBtn").textContent="🔴"; $("#micBtn").title="Mute voice";
    syncPeers(true);
    toast("Microphone on");
  }catch(e){ toast("Microphone permission was not granted"); }
}
function closeVoice(){
  micOn=false; $("#micBtn").textContent="🎙️"; $("#micBtn").title="Voice chat";
  if(micStream){ micStream.getTracks().forEach(t=>t.stop()); micStream=null; }
  for(const [pid,pc] of peers){ try{pc.close()}catch{} }
  peers.clear(); $("#remoteAudio").innerHTML="";
}
function syncPeers(announce=false){
  if(!room)return;
  const ids=new Set(room.players.map(p=>p.id).filter(x=>x!==myId));
  for(const [pid,pc] of peers) if(!ids.has(pid)){ pc.close(); peers.delete(pid); document.getElementById("aud-"+pid)?.remove(); }
  if(micOn){
    for(const pid of ids){
      const pc=ensurePeer(pid);
      if(micStream && !pc.getSenders().some(s=>s.track)){
        micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
      }
      send("signal",{to:pid,data:{kind:"ready"}});
      if(myId < pid) makeOffer(pid);
    }
  }
}
function ensurePeer(pid){
  if(peers.has(pid)) return peers.get(pid);
  const pc=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});
  peers.set(pid,pc);
  if(micStream) micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
  pc.onicecandidate=e=>{ if(e.candidate) send("signal",{to:pid,data:{kind:"ice",candidate:e.candidate}}); };
  pc.ontrack=e=>{
    let a=document.getElementById("aud-"+pid);
    if(!a){ a=document.createElement("audio"); a.id="aud-"+pid; a.autoplay=true; a.playsInline=true; $("#remoteAudio").appendChild(a); }
    a.srcObject=e.streams[0];
    a.play().catch(()=>{});
  };
  return pc;
}
async function makeOffer(pid){
  try{
    const pc=ensurePeer(pid);
    if(pc.signalingState!=="stable") return;
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    send("signal",{to:pid,data:{kind:"offer",sdp:pc.localDescription}});
  }catch(e){}
}
async function handleSignal(from,data){
  try{
    if(data.kind==="ready"){
      const pc=ensurePeer(from);
      if(micStream && !pc.getSenders().some(s=>s.track)) micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
      if(myId < from) await makeOffer(from);
      return;
    }
    const pc=ensurePeer(from);
    if(data.kind==="offer"){
      await pc.setRemoteDescription(data.sdp);
      if(micStream && !pc.getSenders().some(s=>s.track)) micStream.getTracks().forEach(t=>pc.addTrack(t,micStream));
      const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
      send("signal",{to:from,data:{kind:"answer",sdp:pc.localDescription}});
    }else if(data.kind==="answer"){
      await pc.setRemoteDescription(data.sdp);
    }else if(data.kind==="ice" && data.candidate){
      await pc.addIceCandidate(data.candidate);
    }
  }catch(e){}
}
