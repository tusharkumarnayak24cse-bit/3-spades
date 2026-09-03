const GAME_SERVER = (location.protocol === "file:" || location.protocol === "capacitor:") ? "https://kali-teedi.onrender.com" : null;
const socket = GAME_SERVER ? io(GAME_SERVER, { transports:["websocket","polling"] }) : io();
let state = null;

const $ = id => document.getElementById(id);
const suitSymbol = { S:"♠", H:"♥", D:"♦", C:"♣" };
const suitName = { S:"Spades", H:"Hearts", D:"Diamonds", C:"Clubs" };
const avatars = ["😎","🧔","👨","👩","🧑","🦁","🐯","🦊","🐼","🐺","🦅","👑"];
const emojis = ["😂","🔥","👏","😎","🤝","😤"];
const voicePeers=new Map(), voiceAudioEls=new Map(), voiceCandidateQueues=new Map(), voiceMeters=new Map(), individuallyMuted=new Set();
let localVoiceStream=null, voiceJoined=false, voiceMuted=false, voiceMeterFrame=null;
const rtcConfig={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]};

let soundOn = localStorage.getItem("knt_sound") !== "off";
let language = localStorage.getItem("knt_lang") || "en";
let selectedAvatar = localStorage.getItem("knt_avatar") || "😎";

const i18n = {
  en:{
    title:"Kaali Ni Tidi",subtitle:"Online multiplayer card table",profile:"PLAYER PROFILE",quickLogin:"Quick login",
    profileHelp:"Your name and avatar are saved on this browser.",yourName:"Your name",avatar:"Avatar",saveProfile:"Save profile",
    heroTitle:"Play Kaali Ni Tidi with your friends.",heroText:"8-player mode now follows the supplied KaliTiri rules: 2 decks, 500 points, bidding 250–500 by +5, PowerHouse, 3 hidden partners and official duplicate-card/scoring rules.",
    createRoom:"Create room",players:"Players",createPrivate:"Create private room",botsHelp:"Empty seats become bots when the host starts.",
    joinRoom:"Join room",roomCode:"Room code",join:"Join room",copyCode:"Copy room code",startGame:"Start game",round:"Round",bid:"Bid",
    hukum:"Hukum",trick:"Trick",yourHand:"Your hand",scoreboard:"Scoreboard",chat:"Table chat",send:"Send",gameLog:"Game log"
  },
  gu:{
    title:"કાળી ની તીડી",subtitle:"ઓનલાઇન મલ્ટિપ્લેયર કાર્ડ ટેબલ",profile:"ખેલાડી પ્રોફાઇલ",quickLogin:"ઝડપી લૉગિન",
    profileHelp:"તમારું નામ અને અવતાર આ બ્રાઉઝરમાં સેવ રહેશે.",yourName:"તમારું નામ",avatar:"અવતાર",saveProfile:"પ્રોફાઇલ સેવ કરો",
    heroTitle:"મિત્રો સાથે કાળી ની તીડી રમો.",heroText:"8 ખેલાડી મોડ હવે આપેલા KaliTiri નિયમો મુજબ છે: 2 ડેક, 500 પોઇન્ટ, 250–500 બિડ +5, PowerHouse, 3 ગુપ્ત પાર્ટનર અને સત્તાવાર ડુપ્લિકેટ/સ્કોરિંગ નિયમો.",
    createRoom:"રૂમ બનાવો",players:"ખેલાડીઓ",createPrivate:"પ્રાઇવેટ રૂમ બનાવો",botsHelp:"હોસ્ટ ગેમ શરૂ કરે ત્યારે ખાલી સીટ બોટ બનશે.",
    joinRoom:"રૂમ જોડાઓ",roomCode:"રૂમ કોડ",join:"જોડાઓ",copyCode:"રૂમ કોડ કૉપી",startGame:"ગેમ શરૂ કરો",round:"રાઉન્ડ",bid:"બિડ",
    hukum:"હુકમ",trick:"હાથ",yourHand:"તમારા પત્તા",scoreboard:"સ્કોરબોર્ડ",chat:"ટેબલ ચેટ",send:"મોકલો",gameLog:"ગેમ લોગ"
  }
};

function tr(key){ return i18n[language]?.[key] || i18n.en[key] || key; }

function applyLanguage(){
  document.documentElement.lang = language === "gu" ? "gu" : "en";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = tr(key);
  });
  $("langBtn").textContent = language === "en" ? "ગુજરાતી" : "English";
  if(state) render();
}

function toast(text){
  const el=$("toast"); el.textContent=text; el.classList.remove("hidden");
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.add("hidden"),2200);
}

function beep(kind="tap"){
  if(!soundOn) return;
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;
    if(!AudioCtx) return;
    const ctx=beep.ctx||(beep.ctx=new AudioCtx());
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    const freq={tap:420,deal:560,bid:660,win:820,chat:520}[kind]||420;
    osc.frequency.value=freq; gain.gain.setValueAtTime(.04,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12);
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.12);
  }catch{}
}

function renderAvatarPicker(){
  const wrap=$("avatarPicker"); wrap.innerHTML="";
  avatars.forEach(a=>{
    const b=document.createElement("button"); b.type="button";
    b.className=`avatar-option ${a===selectedAvatar?"selected":""}`; b.textContent=a;
    b.addEventListener("click",()=>{selectedAvatar=a;localStorage.setItem("knt_avatar",a);renderAvatarPicker();beep();});
    wrap.appendChild(b);
  });
}

function currentProfile(){
  const name=($("profileName").value||localStorage.getItem("knt_name")||"Player").trim().slice(0,18);
  return {name:name||"Player",avatar:selectedAvatar};
}

function saveProfile(){
  const p=currentProfile();
  localStorage.setItem("knt_name",p.name); localStorage.setItem("knt_avatar",p.avatar);
  $("profileName").value=p.name; toast(language==="gu"?"પ્રોફાઇલ સેવ થયું.":"Profile saved."); beep("win");
}

function showGame(){
  $("homeScreen").classList.add("hidden"); $("profilePanel").classList.add("hidden"); $("gameScreen").classList.remove("hidden");
}

function createCard(card,opts={}){
  const el=document.createElement("div");
  const red=card.suit==="H"||card.suit==="D";
  el.className=`card ${red?"red":""} ${opts.playable?"playable":""} ${opts.dim?"dim":""}`;
  el.dataset.cardId=card.id;
  const copyText=(state?.deckCount||1)===2?`D${card.copy}`:"";
  el.innerHTML=`<div class="rank">${card.rank}${suitSymbol[card.suit]}</div><div class="suit">${suitSymbol[card.suit]}</div><div class="copy">${copyText}</div>`;
  return el;
}

function legalCardIds(){
  if(!state||state.phase!=="playing"||state.turnIndex!==state.viewerIndex)return new Set();
  if(!state.leadSuit)return new Set(state.hand.map(c=>c.id));
  const same=state.hand.filter(c=>c.suit===state.leadSuit);
  return new Set((same.length?same:state.hand).map(c=>c.id));
}

async function joinVoice(){
  if(voiceJoined)return;
  if(!navigator.mediaDevices?.getUserMedia){toast("Voice is not supported here.");return;}
  try{
    localVoiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
    voiceJoined=true;voiceMuted=false;updateVoiceControls();attachSpeakingMeter(state?.viewerIndex,localVoiceStream);
    socket.emit("voiceJoin",{},async res=>{
      if(!res?.ok){leaveVoice(false);toast(res?.error||"Could not join voice.");return;}
      for(const i of res.peers||[])await makeVoiceOffer(i);
      toast("Voice connected.");
    });
  }catch(e){console.error(e);toast("Allow microphone permission to use voice.");}
}
function leaveVoice(notify=true){
  if(notify&&voiceJoined)socket.emit("voiceLeave");
  voiceJoined=false;voiceMuted=false;
  localVoiceStream?.getTracks().forEach(t=>t.stop());localVoiceStream=null;
  [...voicePeers.keys()].forEach(closeVoicePeer);voiceCandidateQueues.clear();voiceMeters.clear();
  if(voiceMeterFrame)cancelAnimationFrame(voiceMeterFrame);voiceMeterFrame=null;updateVoiceControls();
}
function toggleVoiceMute(){
  if(!localVoiceStream)return;
  voiceMuted=!voiceMuted;
  localVoiceStream.getAudioTracks().forEach(t=>t.enabled=!voiceMuted);
  socket.emit("voiceMuteState",{muted:voiceMuted});updateVoiceControls();
}
function updateVoiceControls(){
  const a=$("joinVoiceBtn"),b=$("muteVoiceBtn"),c=$("leaveVoiceBtn"),d=$("voiceStatus");if(!a||!b||!c||!d)return;
  a.classList.toggle("hidden",voiceJoined);b.classList.toggle("hidden",!voiceJoined);c.classList.toggle("hidden",!voiceJoined);
  b.textContent=voiceMuted?"🎙 Unmute":"🔇 Mute";d.textContent=voiceJoined?(voiceMuted?"Voice · muted":"Voice · connected"):"Voice off";
}
function getVoicePeer(i){
  if(voicePeers.has(i))return voicePeers.get(i);
  const pc=new RTCPeerConnection(rtcConfig);voicePeers.set(i,pc);
  localVoiceStream?.getTracks().forEach(t=>pc.addTrack(t,localVoiceStream));
  pc.onicecandidate=e=>{if(e.candidate)socket.emit("voiceSignal",{targetIndex:i,signal:{kind:"candidate",candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate}})};
  pc.ontrack=e=>{const stream=e.streams?.[0]||new MediaStream([e.track]);attachRemoteAudio(i,stream);attachSpeakingMeter(i,stream)};
  pc.onconnectionstatechange=()=>{if(["failed","closed"].includes(pc.connectionState))closeVoicePeer(i)};
  return pc;
}
async function makeVoiceOffer(i){
  if(!voiceJoined||i===state?.viewerIndex)return;
  try{const pc=getVoicePeer(i),offer=await pc.createOffer();await pc.setLocalDescription(offer);socket.emit("voiceSignal",{targetIndex:i,signal:{kind:"offer",description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}});}catch(e){console.error(e)}
}
async function handleVoiceSignal(i,sig){
  if(!voiceJoined||!sig)return;
  try{
    const pc=getVoicePeer(i);
    if(sig.kind==="offer"){
      await pc.setRemoteDescription(sig.description);await flushCandidates(i,pc);
      const ans=await pc.createAnswer();await pc.setLocalDescription(ans);
      socket.emit("voiceSignal",{targetIndex:i,signal:{kind:"answer",description:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}}});
    }else if(sig.kind==="answer"){
      await pc.setRemoteDescription(sig.description);await flushCandidates(i,pc);
    }else if(sig.kind==="candidate"&&sig.candidate){
      if(pc.remoteDescription)await pc.addIceCandidate(sig.candidate);
      else{const q=voiceCandidateQueues.get(i)||[];q.push(sig.candidate);voiceCandidateQueues.set(i,q);}
    }
  }catch(e){console.error("voice",e)}
}
async function flushCandidates(i,pc){for(const c of voiceCandidateQueues.get(i)||[]){try{await pc.addIceCandidate(c)}catch{}}voiceCandidateQueues.delete(i)}
function attachRemoteAudio(i,stream){
  let a=voiceAudioEls.get(i);if(!a){a=document.createElement("audio");a.autoplay=true;a.playsInline=true;$("voiceAudioContainer")?.appendChild(a);voiceAudioEls.set(i,a)}
  a.srcObject=stream;a.muted=individuallyMuted.has(i);const pp=a.play();if(pp?.catch)pp.catch(()=>{});
}
function closeVoicePeer(i){
  try{voicePeers.get(i)?.close()}catch{}voicePeers.delete(i);
  const a=voiceAudioEls.get(i);if(a){a.srcObject=null;a.remove();voiceAudioEls.delete(i)}
  voiceCandidateQueues.delete(i);voiceMeters.delete(i);setSeatSpeaking(i,false);
}
function toggleIndividualVoice(i){
  if(individuallyMuted.has(i))individuallyMuted.delete(i);else individuallyMuted.add(i);
  const a=voiceAudioEls.get(i);if(a)a.muted=individuallyMuted.has(i);renderSeats();
}
function attachSpeakingMeter(i,stream){
  if(i==null||!stream)return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    if(!attachSpeakingMeter.ctx)attachSpeakingMeter.ctx=new AC();const ctx=attachSpeakingMeter.ctx,source=ctx.createMediaStreamSource(stream),an=ctx.createAnalyser();
    an.fftSize=256;an.smoothingTimeConstant=.75;source.connect(an);voiceMeters.set(i,{an,data:new Uint8Array(an.frequencyBinCount),speaking:false});if(!voiceMeterFrame)runVoiceMeter();
  }catch{}
}
function runVoiceMeter(){
  let last=0;const tick=t=>{voiceMeterFrame=requestAnimationFrame(tick);if(t-last<120)return;last=t;for(const [i,m] of voiceMeters){m.an.getByteFrequencyData(m.data);let s=0;for(const v of m.data)s+=v;const speaking=s/Math.max(1,m.data.length)>18;if(speaking!==m.speaking){m.speaking=speaking;setSeatSpeaking(i,speaking)}}};voiceMeterFrame=requestAnimationFrame(tick);
}
function setSeatSpeaking(i,on){document.querySelector(`.seat[data-player-index="${i}"]`)?.classList.toggle("speaking",!!on)}

function render(){
  if(!state)return;
  showGame();
  $("roomBadge").classList.remove("hidden"); $("roomBadge").textContent=`ROOM ${state.code}`;
  const phases={lobby:"Lobby",bidding:language==="gu"?"બિડિંગ":"Bidding",contract:language==="gu"?"હુકમ પસંદગી":"Contract",playing:language==="gu"?"ચાલુ ગેમ":"Playing",roundEnd:language==="gu"?"રાઉન્ડ પૂર્ણ":"Round finished"};
  $("phaseText").textContent=phases[state.phase]||state.phase;
  $("roundNo").textContent=state.round||"—"; $("currentBid").textContent=state.bid.current??"—";
  $("trumpText").textContent=state.trump?`${suitSymbol[state.trump]} ${language==="gu"?"હુકમ":suitName[state.trump]}`:"—";
  $("trickNo").textContent=`${state.trickNumber}/${state.totalTricks || 8}`;
  renderLobby();
  const visible=state.phase!=="lobby"; $("tablePanel").classList.toggle("hidden",!visible); $("lobbyPanel").classList.toggle("hidden",visible);
  if(!visible)return;
  renderSeats();renderTrick();renderHand();renderActions();renderScoreboard();renderLog();renderChat();renderTurnText();
}

function renderLobby(){
  $("lobbyPlayers").innerHTML="";
  state.players.forEach(p=>{
    const div=document.createElement("div");div.className="player-card";
    div.innerHTML=`<div class="player-avatar">${p.avatar||"😎"}</div><div><strong>${escapeHtml(p.name)}</strong><span>${p.bot?"Bot":"Player"} · Seat ${p.index+1}</span></div>`;
    $("lobbyPlayers").appendChild(div);
  });
  $("lobbyHelp").textContent=`${state.players.length}/${state.playerCount} ${language==="gu"?"ખેલાડીઓ જોડાયા":"players joined"}.`;
  $("startBtn").classList.toggle("hidden",!state.host);
}

function renderSeats(){
  const ring=$("seatRing");ring.innerHTML="";const n=state.players.length;
  state.players.forEach((p,i)=>{
    const angle=(-90+(360*i/n))*Math.PI/180,x=50+43*Math.cos(angle),y=50+39*Math.sin(angle);
    const seat=document.createElement("div");seat.dataset.playerIndex=String(i);seat.className=`seat ${state.turnIndex===i&&state.phase==="playing"?"active":""} ${p.voiceJoined?"voice-connected":""} ${p.voiceMuted?"voice-muted":""}`;
    seat.style.left=`${x}%`;seat.style.top=`${y}%`;
    const role=p.team==="bidder"?(language==="gu"?"બિડર ટીમ":"Bidder team"):p.team==="defense"?(language==="gu"?"ડિફેન્સ":"Defense"):"";
    seat.innerHTML=`<div class="avatar">${p.avatar||"😎"}</div><span class="name">${escapeHtml(p.name)}${i===state.viewerIndex?" (You)":""}</span><span class="meta">${p.cards} cards${role?" · "+role:""}${p.voiceJoined?" · voice":""}</span>${p.voiceJoined&&i!==state.viewerIndex?`<button type="button" class="voice-person-btn">${individuallyMuted.has(i)?"🔇 Unmute":"🔊 Mute"}</button>`:""}`;
    const vb=seat.querySelector(".voice-person-btn");if(vb)vb.addEventListener("click",()=>toggleIndividualVoice(i));if(voiceMeters.get(i)?.speaking)seat.classList.add("speaking");
    ring.appendChild(seat);
  });
}

function renderTrick(){
  const area=$("trickArea");area.innerHTML="";const n=Math.max(state.playerCount,4);
  state.trick.forEach(play=>{
    const angle=(-90+(360*play.playerIndex/n))*Math.PI/180,x=50+33*Math.cos(angle),y=50+33*Math.sin(angle);
    const wrap=document.createElement("div");wrap.className="played-card";wrap.style.left=`${x}%`;wrap.style.top=`${y}%`;wrap.appendChild(createCard(play.card));area.appendChild(wrap);
  });
  let msg="";
  if(state.phase==="bidding")msg=language==="gu"?"બિડિંગ ચાલુ છે":"Auction in progress";
  else if(state.phase==="contract")msg=language==="gu"?"હુકમ અને પાર્ટનર પસંદ થઈ રહ્યા છે":"Choosing Hukum & partners";
  else if(state.phase==="playing")msg=state.leadSuit?`${language==="gu"?"લીડ":"Lead"}: ${suitSymbol[state.leadSuit]}`:(language==="gu"?"નવો હાથ":"New trick");
  else msg=language==="gu"?"રાઉન્ડ પૂર્ણ":"Round complete";
  $("centerMessage").textContent=msg;
}

function renderHand(){
  const hand=$("hand");hand.innerHTML="";const legal=legalCardIds();
  state.hand.forEach(card=>{
    const can=legal.has(card.id),el=createCard(card,{playable:can,dim:state.phase==="playing"&&state.turnIndex===state.viewerIndex&&!can});
    if(can){
      el.tabIndex=0;el.setAttribute("role","button");el.setAttribute("aria-label",`Play ${card.rank} of ${suitName[card.suit]}`);
      const play=()=>{beep("deal");socket.emit("playCard",{cardId:card.id});};
      el.addEventListener("click",play);el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();play();}});
    }
    hand.appendChild(el);
  });
  $("handCount").textContent=`${state.hand.length} ${language==="gu"?"પત્તા":"cards"}`;
  if(state.phase==="playing"&&state.turnIndex===state.viewerIndex){
    if(!state.leadSuit) $("legalHint").textContent=language==="gu"?"તમારી લીડ":"Your lead";
    else if(state.hand.some(c=>c.suit===state.leadSuit)) $("legalHint").textContent=`${suitSymbol[state.leadSuit]} ${language==="gu"?"ફોલો કરવો જરૂરી":"must follow suit"}`;
    else $("legalHint").textContent=language==="gu"?"લીડ સુટ નથી — હુકમ અથવા કોઈ પત્તો કાઢો":"Void in lead suit — play Hukum or discard";
  } else $("legalHint").textContent="";
}

function renderActions(){
  const panel=$("actionPanel");panel.innerHTML="";
  if(state.phase==="bidding"){
    if(state.bid.turnIndex!==state.viewerIndex){panel.innerHTML=`<strong>${escapeHtml(state.players[state.bid.turnIndex].name)} ${language==="gu"?"ની બિડની રાહ":"is bidding…"} </strong>`;return;}
    const inc=state.bid.increment || ((state.deckCount||1)===2?10:5);
    const min=state.bid.current==null?state.bid.min:state.bid.current+inc;
    const canBid=min<=state.bid.max;
    panel.innerHTML=`<div class="action-row"><label>${language==="gu"?"બિડ રકમ":"Bid amount"}<input id="bidAmount" type="number" min="${min}" max="${state.bid.max}" step="${inc}" value="${Math.min(min,state.bid.max)}" ${canBid?"":"disabled"}></label><button id="bidBtn" class="primary" type="button" ${canBid?"":"disabled"}>${language==="gu"?"બિડ":"Bid"}</button><button id="passBtn" type="button">${language==="gu"?"પાસ":"Pass"}</button></div><p class="note">${state.bid.min}–${state.bid.max}, +${inc} · ${language==="gu"?"સૌથી મોટી બિડ કરનાર પ્રથમ હાથ લીડ કરશે":"highest bidder leads the first trick"}${!canBid?` · ${language==="gu"?"મહત્તમ બિડ થઈ ગઈ — પાસ કરો":"maximum bid reached — pass"}`:""}</p>`;
    $("bidBtn").addEventListener("click",()=>{beep("bid");socket.emit("bid",{amount:Number($("bidAmount").value),pass:false},res=>{if(res&&!res.ok)toast(res.error);});});
    $("passBtn").addEventListener("click",()=>socket.emit("bid",{pass:true},res=>{if(res&&!res.ok)toast(res.error);}));return;
  }

  if(state.phase==="contract"){
    if(state.bid.bidderIndex!==state.viewerIndex){panel.innerHTML=`<strong>${escapeHtml(state.players[state.bid.bidderIndex].name)} ${language==="gu"?`હુકમ અને ${state.partnerCount} ગુપ્ત પાર્ટનર પસંદ કરી રહ્યા છે`:`is choosing Hukum and ${state.partnerCount} hidden partner${state.partnerCount===1?"":"s"}…`} </strong>`;return;}

    const copies=(state.deckCount||1)===2?[1,2]:[1];
    const owned=new Set(state.hand.map(c=>c.id));
    const options=[];
    for(const copy of copies){
      for(const suit of ["S","H","D","C"]){
        for(const rank of (state.availableRanks||["2","3","4","5","6","7","8","9","10","J","Q","K","A"]).slice().reverse()){
          const id=`${copy}-${suit}-${rank}`;
          if(!owned.has(id)) options.push({id,copy,suit,rank});
        }
      }
    }
    const selectOptions=i=>options.map((c,j)=>`<option value="${c.id}" ${j===i?"selected":""}>${c.rank}${suitSymbol[c.suit]}${(state.deckCount||1)===2?` · Deck ${c.copy}`:""}</option>`).join("");
    const partnerHTML=Array.from({length:state.partnerCount},(_,i)=>`<label>${language==="gu"?"ગુપ્ત પાર્ટનર":"Hidden partner"} ${i+1}<select id="partnerCard${i}">${selectOptions(i)}</select></label>`).join("");
    panel.innerHTML=`<div class="contract-grid"><label>${language==="gu"?"હુકમ":"Hukum / Trump"}<select id="trumpPick">${["S","H","D","C"].map(s=>`<option value="${s}">${suitSymbol[s]} ${suitName[s]}</option>`).join("")}</select></label><div class="partner-picks">${partnerHTML}</div><button id="lockContract" class="primary" type="button">${language==="gu"?"ગેમ શરૂ":"Start play"}</button></div><p class="note">${language==="gu"?`${state.partnerCount} અલગ પત્તા પસંદ કરો. દરેક પત્તો અલગ ખેલાડી પાસે હોવો જરૂરી છે. પાર્ટનર તેનો called card રમે ત્યારે જ જાહેર થશે.`:`Choose ${state.partnerCount} different physical card${state.partnerCount===1?"":"s"}. Each must belong to a different player. Partners are revealed only when their called cards are played.`}</p>`;
    $("lockContract").addEventListener("click",()=>{
      const ids=Array.from({length:state.partnerCount},(_,i)=>$(`partnerCard${i}`).value);
      if(new Set(ids).size!==ids.length){toast(language==="gu"?"દરેક પાર્ટનર માટે અલગ પત્તો પસંદ કરો.":"Choose a different card for each hidden partner.");return;}
      const partnerCards=ids.map(id=>{const [copy,suit,...rankParts]=id.split("-");return {copy:Number(copy),suit,rank:rankParts.join("-")};});
      beep("win");socket.emit("contract",{trump:$("trumpPick").value,partnerCards},res=>{if(res&&!res.ok)toast(res.error||"Could not lock contract.");});
    });return;
  }

  if(state.phase==="playing"){
    const called=(state.calledPartners||[]).map(c=>`${c.rank}${suitSymbol[c.suit]}${(state.deckCount||1)===2?` D${c.copy}`:""}`).join(" · ");
    const turnLine=state.turnIndex===state.viewerIndex?`<strong class="success">${language==="gu"?"તમારી ચાલ — હાઇલાઇટ થયેલો પત્તો રમો.":"Your turn — play a highlighted card."}</strong>`:`<strong>${escapeHtml(state.players[state.turnIndex].name)} ${language==="gu"?"ની ચાલ":"to play…"} </strong>`;
    panel.innerHTML=`${turnLine}<div class="live-contract"><span>${language==="gu"?"ટાર્ગેટ":"Target"}: <b>${state.bid.current}/${state.totalPoints||500}</b></span><span>${language==="gu"?"હુકમ":"Hukum"}: <b>${suitSymbol[state.trump]}</b></span><span>${language==="gu"?"કૉલ પત્તા":"Called cards"}: <b>${called}</b></span><span>${language==="gu"?"પાર્ટનર જાહેર":"Partners revealed"}: <b>${state.revealedPartners.length}/${state.partnerCount}</b></span></div>`;return;
  }

  if(state.phase==="roundEnd"){
    const points=state.players.filter((_,i)=>state.bidderTeam.includes(i)).reduce((s,p)=>s+p.roundPoints,0),made=points>state.bid.current;
    panel.innerHTML=`<div class="section-title"><div><h3 class="${made?"success":"danger"}">${made?(language==="gu"?"કોન્ટ્રાક્ટ સફળ":"Contract made"):(language==="gu"?"કોન્ટ્રાક્ટ નિષ્ફળ":"Contract failed")}</h3><p>${points} ${language==="gu"?"પોઇન્ટ · બિડ":"points · bid"} ${state.bid.current} (${language==="gu"?"બિડ કરતાં વધારે જરૂરી":"must be higher than bid"})</p></div>${state.host?`<button id="nextRoundBtn" class="primary" type="button">${language==="gu"?"આગલો રાઉન્ડ":"Deal next round"}</button>`:""}</div>`;
    if(state.host)$("nextRoundBtn").addEventListener("click",()=>socket.emit("nextRound"));
  }
}

function renderScoreboard(){
  $("scoreboard").innerHTML=`<div class="score-row"><strong>${language==="gu"?"ખેલાડી":"Player"}</strong><span>Total</span><span>${language==="gu"?"કૅપ્ચર":"Captured"}</span><span>${language==="gu"?"એવોર્ડ":"Award"}</span><span>Team</span></div>${state.players.map(p=>`<div class="score-row"><strong>${escapeHtml(p.name)}</strong><span>${p.score}</span><span>${p.roundPoints}</span><span>${p.lastAward||0}</span><span>${p.team||"?"}</span></div>`).join("")}`;
}

function renderLog(){$("gameLog").innerHTML=state.log.map(x=>`<div class="log-line">${escapeHtml(x)}</div>`).join("");}

function renderChat(){
  const wrap=$("chatMessages");wrap.innerHTML="";
  (state.chat||[]).forEach(m=>{
    const d=document.createElement("div");d.className="chat-msg";
    d.innerHTML=`<div>${m.avatar||"😎"}</div><div><div class="who">${escapeHtml(m.name)}</div><div class="bubble">${escapeHtml(m.text)}</div></div>`;
    wrap.appendChild(d);
  });
  wrap.scrollTop=wrap.scrollHeight;
}

function renderTurnText(){
  let text="";
  if(state.phase==="lobby")text=`${state.players.length}/${state.playerCount}`;
  if(state.phase==="bidding")text=`${language==="gu"?"બિડ":"Bid"}: ${state.players[state.bid.turnIndex].name}`;
  if(state.phase==="contract")text=`${state.players[state.bid.bidderIndex].name} ${language==="gu"?"બિડ જીત્યા":"won bid"}`;
  if(state.phase==="playing")text=`${language==="gu"?"ચાલ":"Turn"}: ${state.players[state.turnIndex].name}`;
  if(state.phase==="roundEnd")text=`${language==="gu"?"રાઉન્ડ":"Round"} ${state.round}`;
  $("turnText").textContent=text;
}

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}


function showRules(){
  const m=$("rulesModal");if(m)m.classList.remove("hidden");
}
function hideRules(){const m=$("rulesModal");if(m)m.classList.add("hidden");}
$("rulesBtn")?.addEventListener("click",showRules);
$("rulesClose")?.addEventListener("click",hideRules);
$("rulesModal")?.addEventListener("click",e=>{if(e.target.id==="rulesModal")hideRules();});

$("saveProfileBtn").addEventListener("click",saveProfile);
$("langBtn").addEventListener("click",()=>{language=language==="en"?"gu":"en";localStorage.setItem("knt_lang",language);applyLanguage();});
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;localStorage.setItem("knt_sound",soundOn?"on":"off");$("soundBtn").textContent=soundOn?"🔊":"🔇";if(soundOn)beep("win");});

$("createForm").addEventListener("submit",e=>{
  e.preventDefault();const p=currentProfile();saveProfile();
  socket.emit("createRoom",{name:p.name,avatar:p.avatar,playerCount:Number($("playerCount").value)},res=>{if(!res?.ok)toast(res?.error||"Could not create room.");});
});
$("joinForm").addEventListener("submit",e=>{
  e.preventDefault();const p=currentProfile();saveProfile();
  socket.emit("joinRoom",{name:p.name,avatar:p.avatar,code:$("joinCode").value.toUpperCase()},res=>{if(!res?.ok)toast(res?.error||"Could not join room.");});
});
$("startBtn").addEventListener("click",()=>socket.emit("startGame",{},res=>{if(res&&!res.ok)toast(res.error);}));
$("copyCodeBtn").addEventListener("click",async()=>{
  if(!state)return;
  try{await navigator.clipboard.writeText(state.code);toast(`Room code ${state.code} copied.`);}
  catch{toast(`Room code: ${state.code}`);}
});

$("chatForm").addEventListener("submit",e=>{
  e.preventDefault();const text=$("chatInput").value.trim();if(!text)return;
  socket.emit("chatMessage",{text});$("chatInput").value="";beep("chat");
});
const emojiBar=$("emojiBar");
emojis.forEach(em=>{
  const b=document.createElement("button");b.type="button";b.className="emoji-btn";b.textContent=em;
  b.addEventListener("click",()=>{socket.emit("chatMessage",{text:em});beep("chat");});
  emojiBar.appendChild(b);
});

socket.on("state",next=>{const prev=state;state=next;if(prev&&prev.phase==="playing"&&next.phase==="roundEnd")beep("win");render();});
$("joinVoiceBtn")?.addEventListener("click",joinVoice);
$("muteVoiceBtn")?.addEventListener("click",toggleVoiceMute);
$("leaveVoiceBtn")?.addEventListener("click",()=>leaveVoice(true));
socket.on("voicePeerLeft",({playerIndex})=>closeVoicePeer(Number(playerIndex)));
socket.on("voiceSignal",({fromIndex,signal})=>handleVoiceSignal(Number(fromIndex),signal));
window.addEventListener("beforeunload",()=>{if(voiceJoined)socket.emit("voiceLeave")});
updateVoiceControls();

socket.on("connect_error",()=>toast("Connection problem. Is the server running?"));

$("profileName").value=localStorage.getItem("knt_name")||"";
$("soundBtn").textContent=soundOn?"🔊":"🔇";
renderAvatarPicker();
applyLanguage();
