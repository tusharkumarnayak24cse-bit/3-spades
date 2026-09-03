
const SUITS = [
  {s:'♠', name:'Spades', red:false},
  {s:'♥', name:'Hearts', red:true},
  {s:'♦', name:'Diamonds', red:true},
  {s:'♣', name:'Clubs', red:false}
];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const RVAL = Object.fromEntries(RANKS.map((r,i)=>[r,i+2]));
const names = ['You','Arjun','Riya','Kabir'];

let currentGame = null;
let soundOn = true;
let busy = false;
let teen = null;
let kali = null;
let toastTimer = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function deck(){
  return SUITS.flatMap(su => RANKS.map(rank => ({rank, suit:su.s, red:su.red, id:rank+su.s})));
}
function shuffle(a){
  a = [...a];
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function beep(freq=520, duration=.06){
  if(!soundOn) return;
  try{
    const A = window.AudioContext || window.webkitAudioContext;
    const ctx = beep.ctx || (beep.ctx = new A());
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.value=freq; g.gain.value=.035; o.connect(g); g.connect(ctx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration); o.stop(ctx.currentTime+duration);
  }catch(e){}
}
function showToast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('show'),1700);
}
function setStatus(msg){ $('#statusPill').textContent=msg; }
function setActiveSeat(i){
  $$('.seat').forEach(s=>s.classList.toggle('active',Number(s.dataset.seat)===i));
}
function showScreen(which){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $('#'+which).classList.add('active');
}
function cardHTML(c, cls='', back=false){
  if(back) return `<div class="card back ${cls}"></div>`;
  return `<div class="card ${c.red?'red-card':''} ${c.id==='3♠'?'special':''} ${cls}" data-id="${c.id}">
    <span class="rank">${c.rank}</span><span class="suit">${c.suit}</span><span class="pip">${c.suit}</span>
  </div>`;
}
function tinyBacks(n=3){ return Array.from({length:n},()=>'<div class="tiny-back"></div>').join(''); }
function updateSeatCards(counts, hidden=true){
  [1,2,3].forEach(i=>{
    const el=$('#seatCards'+i);
    el.innerHTML=tinyBacks(Math.min(counts[i]||0, 5));
  });
}
function resetTableVisual(){
  $$('.seat').forEach(s=>s.classList.remove('folded','active'));
  [0,1,2,3].forEach(i=>$('#meta'+i).textContent=i===0?'Player':'Bot');
  $('#centerArea').innerHTML='';
  $('#humanHand').innerHTML='';
  $('#humanHand').className='human-hand';
}

document.addEventListener('DOMContentLoaded',()=>{
  $$('.game-tile').forEach(b=>b.addEventListener('click',()=>startGame(b.dataset.game)));
  $('#homeBtn').addEventListener('click',home);
  $('#soundBtn').addEventListener('click',()=>{
    soundOn=!soundOn; $('#soundBtn').textContent=soundOn?'🔊':'🔇'; beep();
  });
  $('#helpBtn').addEventListener('click',showHelp);
  $('#modalClose').addEventListener('click',closeModal);
  $('#modal').addEventListener('click',e=>{ if(e.target.id==='modal') closeModal(); });
});

function home(){
  currentGame=null; teen=null; kali=null; busy=false;
  resetTableVisual(); $('#controls').innerHTML=''; showScreen('homeScreen'); setStatus('READY');
}
function startGame(type){
  currentGame=type; showScreen('gameScreen'); resetTableVisual();
  if(type==='teen') initTeen(); else initKali();
}
function showHelp(){
  const isTeen=currentGame==='teen';
  const html = !currentGame ? `
    <h2>Taash Royale</h2>
    <p>Choose Teen Patti or Kali Ni Teedi from the home screen. Both modes work offline against computer players.</p>
    <h3>Controls</h3><p>Sound can be toggled from the top-right. Use the home icon to switch games.</p>
  ` : isTeen ? `
    <h2>Teen Patti — Quick Rules</h2>
    <p>Everyone receives 3 cards. Strongest hand at show wins the pot. This game uses virtual chips only.</p>
    <h3>Hand order</h3>
    <p>Trail/Trio → Pure Sequence → Sequence → Colour → Pair → High Card.</p>
    <h3>Blind / Seen</h3>
    <p>You may stay blind or tap <b>See Cards</b>. Seen chaal costs 2× the current blind stake in this casual table version. Raise increases the table stake.</p>
  ` : `
    <h2>Kali Ni Teedi — Quick Rules</h2>
    <p>Four players get 13 cards each. You set a contract, choose hukum (trump), and call one hidden partner card.</p>
    <h3>Points</h3>
    <p>3♠ = 30 points and beats every card. A, K, Q, J and 10 = 10 points each. Every 5 = 5 points.</p>
    <h3>Tricks</h3>
    <p>You must follow the lead suit if possible. Otherwise you may play any card. Hukum beats non-hukum; 3♠ beats everything.</p>
  `;
  openModal(html);
}
function openModal(html){ $('#modalContent').innerHTML=html; $('#modal').classList.add('open'); }
function closeModal(){ $('#modal').classList.remove('open'); }

/* ---------------- Teen Patti ---------------- */
function initTeen(){
  teen={
    players:names.map((name,i)=>({name,chips:1000,hand:[],folded:false,seen:false})),
    pot:0, stake:10, turn:0, round:0, dealer:Math.floor(Math.random()*4), ended:false
  };
  setStatus('TEEN PATTI');
  dealTeenRound();
}
function dealTeenRound(){
  if(!teen) return;
  teen.ended=false; teen.pot=0; teen.stake=10; teen.round++;
  const d=shuffle(deck());
  teen.players.forEach((p,i)=>{
    p.hand=d.slice(i*3,i*3+3); p.folded=false; p.seen=false;
    const boot=Math.min(10,p.chips); p.chips-=boot; teen.pot+=boot;
  });
  teen.turn=(teen.dealer+1)%4;
  $$('.seat').forEach(s=>s.classList.remove('folded'));
  renderTeen();
  showToast('Boot ₹10 equivalent chips placed');
  setTimeout(()=>teenAdvance(),500);
}
function teenMeta(){
  teen.players.forEach((p,i)=>{
    $('#meta'+i).textContent=`${p.folded?'Folded • ':''}${p.seen?'Seen • ':'Blind • '}◉ ${p.chips}`;
  });
}
function renderTeen(){
  teenMeta();
  updateSeatCards([3,3,3,3]);
  const p=teen.players[0];
  $('#humanHand').className='human-hand teen-hand';
  $('#humanHand').innerHTML=p.seen ? p.hand.map(c=>cardHTML(c)).join('') : p.hand.map(c=>cardHTML(c,'',true)).join('');
  $('#centerArea').innerHTML=`<div class="pot-box"><small>POT</small><strong><span class="chip"></span>${teen.pot}</strong><div style="font-size:9px;color:#9db0a3;margin-top:3px">Stake ${teen.stake}</div></div>`;
  renderTeenControls();
}
function renderTeenControls(){
  if(teen.ended){ $('#controls').innerHTML=`<button class="action-btn primary" onclick="dealTeenRound()">NEW ROUND</button>`; return; }
  const p=teen.players[0], isTurn=teen.turn===0 && !busy && !p.folded;
  const active=teen.players.filter(x=>!x.folded);
  const cost=p.seen?teen.stake*2:teen.stake;
  $('#controls').innerHTML=`
    <div class="control-copy"><small>YOUR CHIPS</small><b>◉ ${p.chips}</b></div>
    <button class="action-btn" ${p.seen?'disabled':''} onclick="teenSee()">SEE CARDS</button>
    <button class="action-btn primary" ${!isTurn?'disabled':''} onclick="teenAction('call')">CHAAL ${cost}</button>
    <button class="action-btn" ${!isTurn?'disabled':''} onclick="teenAction('raise')">RAISE</button>
    <button class="action-btn danger" ${!isTurn?'disabled':''} onclick="teenAction('fold')">FOLD</button>
    <button class="action-btn" ${!(isTurn&&active.length===2)?'disabled':''} onclick="teenAction('show')">SHOW</button>
  `;
}
function teenSee(){
  if(!teen || teen.players[0].seen) return;
  teen.players[0].seen=true; beep(650); renderTeen(); showToast('Cards seen — chaal is now 2×');
}
function teenHandScore(hand){
  const vals=hand.map(c=>RVAL[c.rank]).sort((a,b)=>b-a);
  const suits=hand.map(c=>c.suit);
  const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const freq=Object.entries(counts).sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const flush=new Set(suits).size===1;
  const sorted=[...new Set(vals)].sort((a,b)=>b-a);
  let seq=false, seqHigh=0;
  if(sorted.length===3){
    if(sorted[0]-sorted[1]===1 && sorted[1]-sorted[2]===1){seq=true;seqHigh=sorted[0];}
    if(sorted.join(',')==='14,3,2'){seq=true;seqHigh=3;}
  }
  if(freq[0][1]===3) return [6,+freq[0][0]];
  if(seq&&flush) return [5,seqHigh];
  if(seq) return [4,seqHigh];
  if(flush) return [3,...vals];
  if(freq[0][1]===2) return [2,+freq[0][0],+freq[1][0]];
  return [1,...vals];
}
function compareScore(a,b){
  const A=teenHandScore(a),B=teenHandScore(b);
  for(let i=0;i<Math.max(A.length,B.length);i++){ if((A[i]||0)!==(B[i]||0)) return (A[i]||0)-(B[i]||0); }
  return 0;
}
function handLabel(h){
  const s=teenHandScore(h)[0];
  return ['','High Card','Pair','Colour','Sequence','Pure Sequence','Trail / Trio'][s];
}
async function teenAction(type){
  if(!teen || teen.ended || teen.turn!==0 || busy) return;
  const p=teen.players[0];
  if(type==='fold'){ p.folded=true; document.querySelector('.seat[data-seat="0"]').classList.add('folded'); beep(210); showToast('You folded'); nextTeenTurn(); return; }
  if(type==='show'){ await teenShowdown(); return; }
  const cost=(p.seen?2:1)*teen.stake;
  if(type==='raise') teen.stake=Math.min(teen.stake*2,160);
  const actual=Math.min(type==='raise' ? (p.seen?2:1)*teen.stake : cost,p.chips);
  p.chips-=actual; teen.pot+=actual; beep(540);
  renderTeen(); nextTeenTurn();
}
function nextTeenTurn(){
  if(checkTeenEnd()) return;
  let n=teen.turn;
  do{ n=(n+1)%4; }while(teen.players[n].folded);
  teen.turn=n; renderTeen(); setTimeout(()=>teenAdvance(),300);
}
async function teenAdvance(){
  if(!teen || teen.ended || busy) return;
  if(checkTeenEnd()) return;
  setActiveSeat(teen.turn); renderTeenControls();
  if(teen.turn===0) { setStatus('YOUR TURN'); return; }
  busy=true; renderTeenControls();
  const i=teen.turn,p=teen.players[i];
  setStatus(`${p.name.toUpperCase()}'S TURN`);
  await sleep(650+Math.random()*500);
  const strength=teenHandScore(p.hand)[0];
  if(!p.seen && (Math.random()<.5 || strength>=4)) p.seen=true;
  const active=teen.players.filter(x=>!x.folded).length;
  const foldChance=strength<=1 ? .22 : strength===2 ? .09 : .025;
  if(active>2 && Math.random()<foldChance){
    p.folded=true; document.querySelector(`.seat[data-seat="${i}"]`).classList.add('folded'); showToast(`${p.name} folded`); beep(230);
  }else{
    if(strength>=4 && Math.random()<.26) teen.stake=Math.min(teen.stake*2,160);
    const cost=Math.min((p.seen?2:1)*teen.stake,p.chips);
    p.chips-=cost; teen.pot+=cost; beep(450);
  }
  busy=false; teenMeta(); renderTeen();
  if(checkTeenEnd()) return;
  nextTeenTurn();
}
function checkTeenEnd(){
  if(!teen || teen.ended) return true;
  const active=teen.players.map((p,i)=>({p,i})).filter(x=>!x.p.folded);
  if(active.length===1){ teenFinish(active[0].i,false); return true; }
  if(teen.players.every(p=>p.chips<=0 || p.folded) && active.length>1){ teenShowdown(); return true; }
  return false;
}
async function teenShowdown(){
  if(!teen || teen.ended) return;
  busy=true;
  const active=teen.players.map((p,i)=>({p,i})).filter(x=>!x.p.folded);
  active.forEach(x=>x.p.seen=true);
  teenMeta();
  $('#humanHand').innerHTML=teen.players[0].hand.map(c=>cardHTML(c)).join('');
  for(const x of active.filter(x=>x.i!==0)){
    $('#seatCards'+x.i).innerHTML=x.p.hand.map(c=>`<div style="transform:scale(.62);transform-origin:left top;margin-right:-25px">${cardHTML(c)}</div>`).join('');
  }
  setStatus('SHOW');
  await sleep(1000);
  let winner=active[0];
  for(const x of active.slice(1)) if(compareScore(x.p.hand,winner.p.hand)>0) winner=x;
  teenFinish(winner.i,true);
}
function teenFinish(wi,show){
  if(teen.ended) return;
  teen.ended=true; busy=false; setActiveSeat(-1);
  const w=teen.players[wi]; w.chips+=teen.pot;
  setStatus(wi===0?'YOU WIN':'ROUND OVER');
  teenMeta(); renderTeenControls();
  const detail=show ? `<p>${w.name}: <b>${handLabel(w.hand)}</b></p>` : `<p>Everyone else folded.</p>`;
  openModal(`<div class="result-title">${wi===0?'You won!':w.name+' wins'}</div>${detail}<p>Pot won: <b>◉ ${teen.pot}</b></p><button class="action-btn primary" onclick="closeModal();dealTeenRound()">PLAY NEXT ROUND</button>`);
  beep(wi===0?820:260,.15);
}

/* ---------------- Kali Ni Teedi ---------------- */
function initKali(){
  kali={
    hands:[[],[],[],[]], trick:[], leader:0, turn:0, trickNo:0,
    scores:[0,0,0,0], bid:160, trump:'♠', called:null, partner:null,
    partnerRevealed:false, phase:'setup', ended:false
  };
  const d=shuffle(deck());
  for(let i=0;i<4;i++) kali.hands[i]=d.slice(i*13,i*13+13).sort(sortCards);
  setStatus('KALI NI TEEDI');
  renderKaliSetup();
}
function sortCards(a,b){
  const si=SUITS.findIndex(x=>x.s===a.suit)-SUITS.findIndex(x=>x.s===b.suit);
  return si || RVAL[a.rank]-RVAL[b.rank];
}
function legalPartnerCards(){
  const mine=new Set(kali.hands[0].map(c=>c.id));
  return deck().filter(c=>!mine.has(c.id) && ['A','K','Q','J','10'].includes(c.rank));
}
function renderKaliSetup(){
  updateKaliMeta(); updateSeatCards(kali.hands.map(h=>h.length));
  renderKaliHand(false);
  $('#centerArea').innerHTML=`<div class="pot-box"><small>SET CONTRACT</small><strong>3♠</strong><div style="font-size:9px;color:#9db0a3">Black Three = 30 pts</div></div>`;
  const partnerOpts=legalPartnerCards().map(c=>`<option value="${c.id}">${c.rank}${c.suit}</option>`).join('');
  $('#controls').innerHTML=`
    <div class="setup-panel">
      <div class="field"><label>Contract</label><select id="bidSel">${[150,160,170,180,190,200,210].map(x=>`<option ${x===160?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Hukum</label><select id="trumpSel">${SUITS.map(s=>`<option value="${s.s}">${s.s} ${s.name}</option>`).join('')}</select></div>
      <div class="field"><label>Call Partner</label><select id="partnerSel">${partnerOpts}</select></div>
      <button class="action-btn primary" onclick="startKaliPlay()">START HAND</button>
    </div>`;
}
function startKaliPlay(){
  kali.bid=+$('#bidSel').value; kali.trump=$('#trumpSel').value; kali.called=$('#partnerSel').value;
  for(let i=1;i<4;i++) if(kali.hands[i].some(c=>c.id===kali.called)) kali.partner=i;
  kali.phase='play'; kali.leader=0; kali.turn=0;
  $('#meta0').textContent=`Bid ${kali.bid} • Hukum ${kali.trump}`;
  renderKali(); showToast(`Partner card called: ${kali.called}`); kaliAdvance();
}
function kaliCardPoints(c){
  if(c.id==='3♠') return 30;
  if(['A','K','Q','J','10'].includes(c.rank)) return 10;
  if(c.rank==='5') return 5;
  return 0;
}
function updateKaliMeta(){
  if(!kali) return;
  [0,1,2,3].forEach(i=>{
    if(i===0 && kali.phase==='play') $('#meta0').textContent=`Bid ${kali.bid} • ${kali.trump}`;
    else if(i===0) $('#meta0').textContent='Bidder';
    else {
      const tag = kali.partnerRevealed && i===kali.partner ? 'Partner' : 'Bot';
      $('#meta'+i).textContent=`${tag} • ${kali.scores[i]} pts`;
    }
  });
}
function renderKali(){
  updateKaliMeta(); updateSeatCards(kali.hands.map(h=>h.length)); renderKaliHand(true); renderKaliCenter(); renderKaliControls();
}
function renderKaliHand(interactive){
  const hand=kali.hands[0]; let legal=hand;
  if(kali.phase==='play' && kali.turn===0 && kali.trick.length){
    const lead=kali.trick[0].card.suit, follows=hand.filter(c=>c.suit===lead);
    if(follows.length) legal=follows;
  }
  const legalIds=new Set(legal.map(c=>c.id));
  $('#humanHand').className='human-hand';
  $('#humanHand').innerHTML=hand.map(c=>{
    const ok=interactive && kali.phase==='play' && kali.turn===0 && !busy && legalIds.has(c.id);
    return cardHTML(c,ok?'playable':'disabled');
  }).join('');
  $$('#humanHand .playable').forEach(el=>el.addEventListener('click',()=>humanKaliPlay(el.dataset.id)));
}
function renderKaliCenter(){
  if(kali.trick.length){
    $('#centerArea').innerHTML=`<div class="trick">${kali.trick.map(x=>`<div class="trick-card p${x.player}">${cardHTML(x.card)}</div>`).join('')}</div>`;
  }else{
    $('#centerArea').innerHTML=`<div class="pot-box"><small>TRICK</small><strong>${Math.min(kali.trickNo+1,13)} / 13</strong><div style="font-size:9px;color:#9db0a3">Hukum ${kali.trump} • Bid ${kali.bid}</div></div>`;
  }
  let score=$('.kali-score');
  if(!score){ score=document.createElement('div'); score.className='kali-score'; $('#table').appendChild(score); }
  const teamPts=kali.scores[0]+(kali.partner!==null?kali.scores[kali.partner]:0);
  score.innerHTML=`Your side: <b>${teamPts}</b><br>Contract: <b>${kali.bid}</b><br>Called: <b>${kali.called||'—'}</b>`;
}
function renderKaliControls(){
  if(kali.ended){ $('#controls').innerHTML=`<button class="action-btn primary" onclick="initKali()">NEW HAND</button>`; return; }
  $('#controls').innerHTML=`<div class="control-copy"><small>FOLLOW SUIT</small><b>${kali.turn===0?'YOUR TURN':names[kali.turn]+"'s turn"}</b></div><button class="action-btn" onclick="showHelp()">RULES</button>`;
}
function humanKaliPlay(id){
  if(!kali || kali.turn!==0 || busy || kali.phase!=='play') return;
  const idx=kali.hands[0].findIndex(c=>c.id===id); if(idx<0)return;
  const lead=kali.trick[0]?.card.suit;
  if(lead && kali.hands[0].some(c=>c.suit===lead) && kali.hands[0][idx].suit!==lead){ showToast('You must follow suit'); return; }
  const c=kali.hands[0].splice(idx,1)[0];
  addKaliCard(0,c); kaliAfterPlay();
}
function addKaliCard(player,card){
  kali.trick.push({player,card}); beep(card.id==='3♠'?760:480);
  if(card.id===kali.called && !kali.partnerRevealed){
    kali.partnerRevealed=true;
    showToast(`${names[player]} is your hidden partner!`);
  }
  renderKali();
}
async function kaliAfterPlay(){
  if(kali.trick.length===4){
    busy=true; renderKali();
    await sleep(750);
    const winner=kaliTrickWinner();
    const pts=kali.trick.reduce((s,x)=>s+kaliCardPoints(x.card),0);
    kali.scores[winner]+=pts; kali.trickNo++;
    showToast(`${names[winner]} takes ${pts} points`);
    setActiveSeat(winner);
    await sleep(650);
    kali.trick=[]; kali.leader=winner; kali.turn=winner; busy=false;
    if(kali.trickNo>=13){ finishKali(); return; }
    renderKali(); kaliAdvance();
  }else{
    kali.turn=(kali.turn+1)%4; renderKali(); kaliAdvance();
  }
}
function kaliBeats(a,b,lead,trump){
  // true if card a beats card b
  if(a.id==='3♠') return true;
  if(b.id==='3♠') return false;
  const at=a.suit===trump, bt=b.suit===trump;
  if(at!==bt) return at;
  if(a.suit===b.suit) return RVAL[a.rank]>RVAL[b.rank];
  if(a.suit===lead && b.suit!==lead) return true;
  return false;
}
function kaliTrickWinner(){
  const lead=kali.trick[0].card.suit;
  let best=kali.trick[0];
  for(const x of kali.trick.slice(1)) if(kaliBeats(x.card,best.card,lead,kali.trump)) best=x;
  return best.player;
}
async function kaliAdvance(){
  if(!kali || kali.ended || busy || kali.phase!=='play') return;
  setActiveSeat(kali.turn); setStatus(kali.turn===0?'YOUR TURN':`${names[kali.turn].toUpperCase()}'S TURN`);
  renderKali();
  if(kali.turn===0) return;
  busy=true; renderKali();
  await sleep(520+Math.random()*360);
  const p=kali.turn, hand=kali.hands[p], lead=kali.trick[0]?.card.suit;
  let legal=lead ? hand.filter(c=>c.suit===lead) : hand;
  if(lead && !legal.length) legal=hand;
  const c=botChooseKaliCard(p,legal,lead);
  kali.hands[p].splice(kali.hands[p].findIndex(x=>x.id===c.id),1);
  busy=false; addKaliCard(p,c); kaliAfterPlay();
}
function botChooseKaliCard(player,legal,lead){
  // Basic but useful AI: protect points, win cheaply when there are points on table.
  const tablePts=kali.trick.reduce((s,x)=>s+kaliCardPoints(x.card),0);
  const sorted=[...legal].sort((a,b)=>RVAL[a.rank]-RVAL[b.rank]);
  if(!kali.trick.length){
    const zero=sorted.filter(c=>kaliCardPoints(c)===0 && c.id!=='3♠');
    return (zero.length?zero:sorted)[Math.floor(Math.random()*Math.min(3,(zero.length?zero:sorted).length))];
  }
  const currentWinner=kaliTrickWinner();
  const currCard=kali.trick.find(x=>x.player===currentWinner).card;
  const leadSuit=kali.trick[0].card.suit;
  const winners=sorted.filter(c=>kaliBeats(c,currCard,leadSuit,kali.trump));
  const isPartnerSide = kali.partnerRevealed && (player===kali.partner);
  if((tablePts>=10 || isPartnerSide) && winners.length) return winners[0];
  const nonPoint=sorted.filter(c=>kaliCardPoints(c)===0 && c.id!=='3♠');
  return nonPoint.length?nonPoint[0]:sorted[0];
}
function finishKali(){
  kali.ended=true; busy=false; setActiveSeat(-1);
  const team=kali.scores[0]+kali.scores[kali.partner];
  const def=kali.scores.reduce((a,b)=>a+b,0)-team;
  const made=team>=kali.bid;
  setStatus(made?'CONTRACT MADE':'CONTRACT FAILED');
  renderKali();
  openModal(`
    <div class="result-title">${made?'Contract made!':'Contract failed'}</div>
    <p>Your hidden partner was <b>${names[kali.partner]}</b> (${kali.called}).</p>
    <div class="result-grid">
      <div class="result-box"><small>YOUR SIDE</small><b>${team}</b></div>
      <div class="result-box"><small>DEFENDERS</small><b>${def}</b></div>
    </div>
    <p>Target: <b>${kali.bid}</b> • Hukum: <b>${kali.trump}</b></p>
    <button class="action-btn primary" onclick="closeModal();initKali()">PLAY NEW HAND</button>
  `);
  beep(made?820:250,.15);
}
