var balance=1000000,bet=0,playerHand=[],dealerHand=[],deck=[],gameActive=false,histArr=[],playerName='Player',speechTimer=null;
var betChips=[]; // track each individual chip placed: [{amount:1000},{amount:50000},...]
var suits=['♠','♥','♦','♣'],ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
var PHASE_BET='bet',PHASE_PLAY='play';
var phase=PHASE_BET;

// Chip color mapping by amount
var CHIP_COLORS={
  1000:{cls:'chip-teal',bg:'radial-gradient(circle at 40% 38%,#5eecd0,#2dd4a8 35%,#0fa67a 70%,#087a5a)',bdr:'#26c9a0'},
  5000:{cls:'chip-blue',bg:'radial-gradient(circle at 40% 38%,#6cb3e6,#3498db 35%,#2471a3 70%,#1a5276)',bdr:'#2e86c1'},
  10000:{cls:'chip-red',bg:'radial-gradient(circle at 40% 38%,#f47066,#e74c3c 35%,#c0392b 70%,#962d22)',bdr:'#d44234'},
  50000:{cls:'chip-gold',bg:'radial-gradient(circle at 40% 38%,#f9e06b,#f1c40f 35%,#d4a20a 70%,#b7900a)',bdr:'#e6b80e'},
  100000:{cls:'chip-purple',bg:'radial-gradient(circle at 40% 38%,#c49dde,#9b59b6 35%,#7d3c98 70%,#5b2d71)',bdr:'#8e4dab'},
  500000:{cls:'chip-black',bg:'radial-gradient(circle at 40% 38%,#666,#444 35%,#2a2a2a 70%,#111)',bdr:'#555'}
};
function getChipColor(amt){return CHIP_COLORS[amt]||CHIP_COLORS[1000]}

// ===== AUDIO SYSTEM (Web Audio API) =====
var audioCtx=null;
function initAudio(){
  if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
}

// Background music system — mp3 based
var bgmCurrent=null; // 'lobby' or 'game'
function startBGM(mode){
  if(!mode)mode='lobby';
  var lobby=document.getElementById('bgmLobby');
  var game=document.getElementById('bgmGame');
  // Stop the other track
  if(mode==='lobby'){game.pause();game.currentTime=0;}
  else{lobby.pause();lobby.currentTime=0;}
  var el=mode==='lobby'?lobby:game;
  el.volume=mode==='lobby'?0.5:0.09;
  bgmCurrent=mode;
  var p=el.play();
  if(p&&p.catch)p.catch(function(){});
}
function stopBGM(){
  var lobby=document.getElementById('bgmLobby');
  var game=document.getElementById('bgmGame');
  lobby.pause();lobby.currentTime=0;
  game.pause();game.currentTime=0;
  bgmCurrent=null;
}

// SFX: chip clink (ceramic click)
function sfxChip(){
  initAudio();var ctx=audioCtx;var t=ctx.currentTime;
  var osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=3200;
  var osc2=ctx.createOscillator();osc2.type='sine';osc2.frequency.value=4800;
  var g=ctx.createGain();g.gain.value=0.15;
  var g2=ctx.createGain();g2.gain.value=0.08;
  osc.connect(g);osc2.connect(g2);g.connect(ctx.destination);g2.connect(ctx.destination);
  osc.start(t);osc2.start(t);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.06);
  g2.gain.exponentialRampToValueAtTime(0.001,t+0.04);
  osc.stop(t+0.08);osc2.stop(t+0.06);
}

// SFX: card swoosh (light airy flick)
function sfxCard(){
  initAudio();var ctx=audioCtx;var t=ctx.currentTime;
  var len=Math.floor(ctx.sampleRate*0.12);
  var buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var d=buf.getChannelData(0);
  for(var i=0;i<len;i++){
    var env=Math.pow(Math.sin(Math.PI*i/len),0.5);
    d[i]=(Math.random()*2-1)*env;
  }
  var ns=ctx.createBufferSource();ns.buffer=buf;
  var g=ctx.createGain();g.gain.value=0.09;
  var flt=ctx.createBiquadFilter();flt.type='bandpass';flt.Q.value=0.6;
  flt.frequency.setValueAtTime(2000,t);
  flt.frequency.exponentialRampToValueAtTime(5500,t+0.04);
  flt.frequency.exponentialRampToValueAtTime(1800,t+0.12);
  var hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=800;
  ns.connect(flt);flt.connect(hp);hp.connect(g);g.connect(ctx.destination);
  ns.start(t);
  g.gain.setValueAtTime(0.09,t);
  g.gain.linearRampToValueAtTime(0.12,t+0.03);
  g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
}

// SFX: card flip (quick flick)
function sfxFlip(){
  initAudio();var ctx=audioCtx;var t=ctx.currentTime;
  var len=Math.floor(ctx.sampleRate*0.12);
  var buf=ctx.createBuffer(1,len,ctx.sampleRate);
  var d=buf.getChannelData(0);
  for(var i=0;i<len;i++){
    var env=i<len*0.1?i/(len*0.1):Math.pow(1-(i-len*0.1)/(len*0.9),2);
    d[i]=(Math.random()*2-1)*env;
  }
  var ns=ctx.createBufferSource();ns.buffer=buf;
  var g=ctx.createGain();g.gain.value=0.12;
  var flt=ctx.createBiquadFilter();flt.type='bandpass';flt.frequency.value=2500;flt.Q.value=0.6;
  ns.connect(flt);flt.connect(g);g.connect(ctx.destination);
  ns.start(t);g.gain.exponentialRampToValueAtTime(0.001,t+0.1);
}

// SFX: win chime
function sfxWin(){
  initAudio();var ctx=audioCtx;
  var notes=[523.25,659.25,783.99,1046.5];
  for(var i=0;i<notes.length;i++){
    (function(freq,delay){
      var osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=freq;
      var g=ctx.createGain();g.gain.value=0;
      osc.connect(g);g.connect(ctx.destination);
      osc.start(ctx.currentTime+delay);
      g.gain.linearRampToValueAtTime(0.12,ctx.currentTime+delay+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.5);
      osc.stop(ctx.currentTime+delay+0.55);
    })(notes[i],i*0.12);
  }
}

// SFX: lose
function sfxLose(){
  initAudio();var ctx=audioCtx;var t=ctx.currentTime;
  var osc=ctx.createOscillator();osc.type='sine';osc.frequency.value=250;
  var g=ctx.createGain();g.gain.value=0.1;
  osc.connect(g);g.connect(ctx.destination);
  osc.frequency.linearRampToValueAtTime(150,t+0.5);
  osc.start(t);g.gain.exponentialRampToValueAtTime(0.001,t+0.6);
  osc.stop(t+0.65);
}

// Start lobby BGM on page load; retry on any interaction if autoplay blocked
(function(){
  var lobbyWanted=true;
  startBGM('lobby');
  function retryBGM(){
    if(!lobbyWanted)return;
    if(bgmCurrent!=='lobby')startBGM('lobby');
    var el=document.getElementById('bgmLobby');
    if(el.paused){var p=el.play();if(p&&p.catch)p.catch(function(){});}
  }
  var evts=['click','touchstart','keydown','mousemove','pointerdown','scroll'];
  function addAll(){evts.forEach(function(e){document.addEventListener(e,retryBGM,{once:false})})}
  function removeAll(){evts.forEach(function(e){document.removeEventListener(e,retryBGM)})}
  addAll();
  window._stopLobbyRetry=function(){lobbyWanted=false;removeAll()};
  window._startLobbyRetry=function(){lobbyWanted=true;addAll()};
})();

document.getElementById('nameInput').addEventListener('keydown',function(e){if(e.key==='Enter')startGame()});


function startGame(){
  var n=document.getElementById('nameInput').value.trim();
  if(!n)n='Player';
  playerName=n;
  document.getElementById('playerNameTag').textContent=playerName;
  document.getElementById('startScreen').classList.add('hidden');
  if(window._stopLobbyRetry)window._stopLobbyRetry();
  startBGM('game');
  createDeck();updateBalance();
  switchPhase(PHASE_BET);
  say(playerName+'님 환영합니다!\n칩을 선택해 베팅하세요',3000);
}

function switchPhase(p){
  phase=p;
  if(p===PHASE_BET){
    document.getElementById('betBar').classList.remove('hidden');
    document.getElementById('actionBar').classList.add('hidden');disableActions();
  } else {
    document.getElementById('betBar').classList.add('hidden');
    document.getElementById('actionBar').classList.remove('hidden');
  }
}

// ===== DECK =====
var TOTAL_DECK=312; // 6 decks x 52
var SHOE_MAX_CARDS=40; // max visual card slices in shoe

function createDeck(){
  deck=[];for(var d=0;d<6;d++)for(var s=0;s<4;s++)for(var r=0;r<13;r++)deck.push({suit:suits[s],rank:ranks[r]});
  shuffle(deck);updateShoeVisual();
}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}}
function drawCard(){
  if(deck.length<20){createDeck();say('새 카드를 채웁니다',1500)}
  var c=deck.pop();updateShoeVisual();return c;
}

function updateShoeVisual(){
  var el=document.getElementById('shoeCards');if(!el)return;
  var peek=document.getElementById('shoePeekCard');
  var ratio=deck.length/TOTAL_DECK;
  var numCards=Math.max(0,Math.round(ratio*SHOE_MAX_CARDS));
  var spacing=3.6;
  el.innerHTML='';
  // Show/hide peek card
  if(peek)peek.style.display=deck.length>0?'':'none';
  for(var i=0;i<numCards;i++){
    var card=document.createElement('div');
    card.className='shoe-card';
    card.style.bottom=(8+i*spacing)+'px';
    el.appendChild(card);
  }
  // Update label
  var lbl=document.getElementById('shoeLabel');
  if(lbl)lbl.textContent=deck.length+' / '+TOTAL_DECK;
}
function cardValue(h){var t=0,a=0;for(var i=0;i<h.length;i++){var r=h[i].rank;if(r==='A'){a++;t+=11}else if('KQJ'.indexOf(r[0])>=0&&r.length<=2)t+=10;else t+=parseInt(r)}while(t>21&&a>0){t-=10;a--}return t}
function isBlackjack(h){return h.length===2&&cardValue(h)===21}
function isBust(h){return cardValue(h)>21}
function isRed(s){return s==='♥'||s==='♦'}
function fmt(n){return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g,',')}

// ===== UI =====
function updateBalance(){document.getElementById('balanceDisplay').textContent='₩'+fmt(balance)}
function updateBetLabel(){document.getElementById('betAmountLabel').textContent=bet>0?'₩'+fmt(bet):''}

// Render pot chips with individual colors, last bet on top
function updatePotChips(){
  var el=document.getElementById('potChips');el.innerHTML='';
  var show=betChips.slice(-5); // max 5 visible
  for(var i=0;i<show.length;i++){
    var cc=getChipColor(show[i].amount);
    var c=document.createElement('div');
    c.className='pot-chip '+cc.cls;
    c.style.bottom=(i*5)+'px';
    el.appendChild(c);
  }
}

function renderHistory(){
  var el=document.getElementById('history');el.innerHTML='';
  var s=histArr.slice(-10);for(var i=s.length-1;i>=0;i--){var d=document.createElement('div');d.className='hist-dot '+s[i];el.appendChild(d)}
}
function say(text,dur){
  var el=document.getElementById('speech');el.textContent=text;el.classList.add('show');
  if(speechTimer)clearTimeout(speechTimer);
  speechTimer=setTimeout(function(){el.classList.remove('show');speechTimer=null},dur||2500);
}

// ===== CARD DOM =====
function buildCardBack(){
  var back=document.createElement('div');back.className='card card-back';back.style.cssText='position:absolute;inset:0;border-radius:6px';
  back.appendChild(document.createElement('div')).className='cb-frame';
  back.appendChild(document.createElement('div')).className='cb-band';
  back.appendChild(document.createElement('div')).className='cb-inner';
  back.appendChild(document.createElement('div')).className='cb-center';
  return back;
}
// Create a card-back DOM string for inline HTML use
var CARD_BACK_HTML='<div class="cb-frame"></div><div class="cb-band"></div><div class="cb-inner"></div><div class="cb-center"></div>';
function createCardEl(card,faceDown){
  if(faceDown){
    var w=document.createElement('div');w.className='card-flip-container';
    var inner=document.createElement('div');inner.className='card-flip-inner';
    var back=buildCardBack();
    var fw=document.createElement('div');fw.className='card-front-wrap';fw.appendChild(buildFront(card));
    inner.appendChild(back);inner.appendChild(fw);w.appendChild(inner);return w;
  }
  var c=buildFront(card);c.classList.add('card-deal');return c;
}
function buildFront(card){
  var c=document.createElement('div');c.className='card card-front'+(isRed(card.suit)?' red':'');
  c.innerHTML='<div class="card-rank">'+card.rank+'</div><div class="card-suit-tl">'+card.suit+'</div><div class="card-center">'+card.suit+'</div>';
  return c;
}
function updateScore(who,hand,hide){
  var el=document.getElementById(who+'Score');
  if(!hand||!hand.length){el.textContent='';el.className='score-badge';return}
  if(hide){el.textContent='?';el.className='score-badge';return}
  var v=cardValue(hand);el.textContent=v;el.className='score-badge';
  if(isBlackjack(hand))el.classList.add('bj');else if(isBust(hand))el.classList.add('bust');
}

// ===== BETTING (individual chip tracking) =====
function addBet(a,btnEl){
  if(phase!==PHASE_BET)return;
  if(a>balance-bet)a=balance-bet;
  if(a<=0)return;
  bet+=a;
  betChips.push({amount:a});
  sfxChip();
  updateBetLabel();
  document.getElementById('dealBtn').disabled=bet===0;
  if(btnEl){flyChipToPot(a,btnEl)}else{updatePotChips()}
}

function flyChipToPot(amt,btnEl){
  var cc=getChipColor(amt);
  var from=btnEl.getBoundingClientRect();
  var potEl=document.getElementById('betCircle');
  var to=potEl.getBoundingClientRect();
  var sz=from.width||42;
  var fly=document.createElement('div');
  fly.className='flying';
  fly.style.cssText='position:fixed;width:'+sz+'px;height:'+sz+'px;border-radius:50%;z-index:999;pointer-events:none;'+
    'border:3px solid '+cc.bdr+';background:'+cc.bg+';'+
    'left:'+from.left+'px;top:'+from.top+'px;'+
    'transition:left .35s cubic-bezier(.25,.46,.45,.94),top .35s cubic-bezier(.25,.46,.45,.94),transform .35s ease;'+
    'box-shadow:0 3px 10px rgba(0,0,0,.5)';
  var ring=document.createElement('div');
  ring.style.cssText='position:absolute;inset:3px;border-radius:50%;border:2px dashed rgba(255,255,255,.3)';
  fly.appendChild(ring);
  document.body.appendChild(fly);
  fly.offsetHeight;
  fly.style.left=(to.left+to.width/2-sz/2)+'px';
  fly.style.top=(to.top+to.height/2-sz/2)+'px';
  fly.style.transform='scale(.7)';
  setTimeout(function(){
    try{fly.remove()}catch(e){}
    updatePotChips();
  },370);
}
function clearBet(){
  if(phase!==PHASE_BET)return;
  bet=0;betChips=[];
  updateBetLabel();updatePotChips();
  document.getElementById('dealBtn').disabled=true;
}

// ===== DEAL =====
function getShoePos(){
  var peek=document.querySelector('.shoe-peek-card');
  if(peek){var r=peek.getBoundingClientRect();return{left:r.left+r.width/2,top:r.top+r.height/2}}
  var shoe=document.querySelector('.card-shoe');
  if(!shoe)return{left:window.innerWidth-80,top:40};
  var r=shoe.getBoundingClientRect();return{left:r.left+r.width/2,top:r.top+r.height*0.85};
}

function dealCardFromShoe(cardEl,targetContainer,delay,cb){
  setTimeout(function(){
    sfxCard();
    var peekEl=document.querySelector('.shoe-peek-card');
    var shoePos=getShoePos();

    // Animate peek card sliding out
    if(peekEl){
      peekEl.style.transition='transform .25s ease-in';
      peekEl.style.transform='translateX(-50%) translateY(30px)';
      peekEl.style.opacity='0';
    }

    // Create flying card-back clone starting at peek card position
    // Start behind shoe (z-index lower than shoe's 5), invisible
    var cardStyle=getComputedStyle(document.querySelector('.card')||document.createElement('div'));
    var cw=parseInt(cardStyle.width)||64,ch=parseInt(cardStyle.height)||88;
    var flyBack=document.createElement('div');
    flyBack.className='card card-back card-flying-from-shoe';
    flyBack.style.width=cw+'px';flyBack.style.height=ch+'px';
    flyBack.style.left=(shoePos.left-cw/2)+'px';
    flyBack.style.top=(shoePos.top-ch/2)+'px';
    flyBack.style.transform='scale(.7) rotate(45deg)';
    flyBack.style.opacity='0';
    flyBack.style.zIndex='3';
    flyBack.innerHTML=CARD_BACK_HTML;
    document.body.appendChild(flyBack);

    // Add the real card to DOM hidden
    cardEl.style.visibility='hidden';
    targetContainer.appendChild(cardEl);

    // Brief delay — card emerges from under the shoe, then becomes visible and flies
    var tgtR=cardEl.getBoundingClientRect();
    flyBack.offsetHeight;
    setTimeout(function(){
      flyBack.style.zIndex='998';
      flyBack.style.opacity='1';
      flyBack.style.left=tgtR.left+'px';
      flyBack.style.top=tgtR.top+'px';
      flyBack.style.transform='scale(1) rotate(0deg)';
    },120);

    setTimeout(function(){
      cardEl.style.visibility='';
      try{flyBack.remove()}catch(e){}
      // Reset peek card (next card slides into place)
      if(peekEl){
        peekEl.style.transition='none';
        peekEl.style.transform='translateX(-50%) translateY(0)';
        peekEl.style.opacity='1';
        peekEl.offsetHeight;
        peekEl.style.transition='';
      }
      if(cb)cb();
    },400);
  },delay);
}

function startDeal(){
  if(bet===0||bet>balance||phase!==PHASE_BET)return;
  balance-=bet;updateBalance();
  switchPhase(PHASE_PLAY);
  playerHand=[];dealerHand=[];
  document.getElementById('dealerCards').innerHTML='';document.getElementById('playerCards').innerHTML='';
  updateScore('dealer',null);updateScore('player',null);
  if(deck.length<30)createDeck();
  say('카드를 배분합니다');

  // Draw all 4 cards
  var c1=drawCard(),c2=drawCard(),c3=drawCard(),c4=drawCard();
  playerHand.push(c1);dealerHand.push(c2);playerHand.push(c3);dealerHand.push(c4);

  var pC=document.getElementById('playerCards'),dC=document.getElementById('dealerCards');

  // Card 1: player face up
  dealCardFromShoe(createCardEl(c1,false),pC,280,function(){updateScore('player',[c1])});
  // Card 2: dealer face up
  dealCardFromShoe(createCardEl(c2,false),dC,650,function(){updateScore('dealer',dealerHand,true)});
  // Card 3: player face up
  dealCardFromShoe(createCardEl(c3,false),pC,1020,function(){updateScore('player',playerHand)});
  // Card 4: dealer face down
  dealCardFromShoe(createCardEl(c4,true),dC,1400,function(){updateScore('dealer',dealerHand,true)});

  setTimeout(function(){
    gameActive=true;
    if(isBlackjack(playerHand)){
      revealDealer(function(){
        if(isBlackjack(dealerHand)){say('둘 다 블랙잭!');endRound('push')}
        else{say('블랙잭! 축하합니다!');endRound('blackjack')}
      });return;
    }
    if(dealerHand[0].rank==='A'||['10','J','Q','K'].indexOf(dealerHand[0].rank)>=0){
      if(isBlackjack(dealerHand)){revealDealer(function(){say('딜러 블랙잭...');endRound('lose')});return}
    }
    enableActions();
  },1950);
}

// ===== ACTIONS =====
function enableActions(){
  document.getElementById('btnHit').disabled=false;
  document.getElementById('btnStand').disabled=false;
  document.getElementById('btnDouble').disabled=!(playerHand.length===2&&balance>=bet);
  document.getElementById('btnSplit').disabled=!(playerHand.length===2&&playerHand[0].rank===playerHand[1].rank&&balance>=bet);
}
function disableActions(){
  document.getElementById('btnHit').disabled=true;document.getElementById('btnStand').disabled=true;
  document.getElementById('btnDouble').disabled=true;document.getElementById('btnSplit').disabled=true;
}

function doHit(){
  if(!gameActive)return;disableActions();
  var c=drawCard();playerHand.push(c);
  dealCardFromShoe(createCardEl(c,false),document.getElementById('playerCards'),0,function(){
    updateScore('player',playerHand);
    if(isBust(playerHand)){gameActive=false;say('플레이어 버스트!');setTimeout(function(){revealDealer(function(){endRound('lose')})},500)}
    else if(cardValue(playerHand)===21){doStand()}
    else{enableActions()}
  })
}
function doStand(){if(!gameActive)return;gameActive=false;disableActions();revealDealer(function(){dealerPlay()})}
function doDouble(){
  if(!gameActive||playerHand.length!==2||balance<bet)return;disableActions();
  balance-=bet;bet*=2;updateBalance();updateBetLabel();
  // duplicate the chip stack for visual
  var dup=betChips.slice();for(var i=0;i<dup.length;i++)betChips.push({amount:dup[i].amount});
  updatePotChips();
  say('더블다운!');
  var c=drawCard();playerHand.push(c);
  dealCardFromShoe(createCardEl(c,false),document.getElementById('playerCards'),0,function(){
    updateScore('player',playerHand);
    setTimeout(function(){gameActive=false;revealDealer(function(){if(isBust(playerHand))endRound('lose');else dealerPlay()})},500);
  });
}
function doSplit(){say('스플릿은 준비 중입니다')}

// ===== DEALER =====
function revealDealer(cb){
  var fc=document.querySelector('#dealerCards .card-flip-container');
  if(fc){sfxFlip();fc.querySelector('.card-flip-inner').classList.add('flipped');setTimeout(function(){updateScore('dealer',dealerHand,false);if(cb)cb()},650)}
  else{updateScore('dealer',dealerHand,false);if(cb)cb()}
}
function dealerPlay(){
  if(cardValue(dealerHand)>=17){resolveGame();return}
  setTimeout(function(){
    var c=drawCard();dealerHand.push(c);
    dealCardFromShoe(createCardEl(c,false),document.getElementById('dealerCards'),0,function(){
      updateScore('dealer',dealerHand,false);say('딜러 히트');
      setTimeout(dealerPlay,380);
    });
  },550);
}
function resolveGame(){
  var p=cardValue(playerHand),d=cardValue(dealerHand);
  if(isBust(dealerHand)){say('딜러 버스트! 플레이어 승리!');endRound('win')}
  else if(p>d){say('플레이어 승리!');endRound('win')}
  else if(p<d){say('플레이어 패배...');endRound('lose')}
  else{say('무승부!');endRound('push')}
}

// ===== END ROUND =====
function endRound(res){
  gameActive=false;disableActions();
  var b=document.getElementById('resultBanner'),pay=0;
  if(res==='blackjack'){pay=Math.floor(bet*2.5);b.className='result-banner blackjack-win';b.innerHTML='BLACKJACK!<div class="result-sub">플레이어 승리 +₩'+fmt(pay-bet)+'</div>';histArr.push('win')}
  else if(res==='win'){pay=bet*2;b.className='result-banner win';b.innerHTML='플레이어 승리<div class="result-sub">+₩'+fmt(bet)+'</div>';histArr.push('win')}
  else if(res==='push'){pay=bet;b.className='result-banner push';b.innerHTML='무승부<div class="result-sub">베팅금 반환</div>';histArr.push('push')}
  else{pay=0;b.className='result-banner lose';b.innerHTML='플레이어 패배<div class="result-sub">-₩'+fmt(bet)+'</div>';histArr.push('lose')}

  b.style.display='';
  if(res==='blackjack'||res==='win')sfxWin();else if(res==='lose')sfxLose();

  // Save chip info before bet resets
  var savedChips=betChips.slice(-4); // fly up to 4

  setTimeout(function(){balance+=pay;updateBalance();renderHistory();tryFlyChips(res,savedChips)},1400);
  setTimeout(function(){b.style.display='none';document.getElementById('potChips').innerHTML='';document.getElementById('betAmountLabel').textContent='';bet=0;betChips=[]},2800);
  setTimeout(function(){
    document.querySelectorAll('.flying').forEach(function(e){try{e.remove()}catch(x){}});
    var cards=document.querySelectorAll('#dealerCards .card, #dealerCards .card-flip-container, #playerCards .card');
    var exitEl=document.querySelector('.shoe-exit');
    var tgt=exitEl?exitEl.getBoundingClientRect():(function(){var shoe=document.querySelector('.card-shoe');return shoe?shoe.getBoundingClientRect():{left:window.innerWidth*.8,top:30,width:60,height:50}})();
    cards.forEach(function(card,i){
      setTimeout(function(){
        try{
          var r=card.getBoundingClientRect();
          var cl=document.createElement('div');cl.className='card card-back flying';
          cl.innerHTML=CARD_BACK_HTML;
          cl.style.cssText='position:fixed;z-index:998;width:'+r.width+'px;height:'+r.height+'px;left:'+r.left+'px;top:'+r.top+'px;transition:all .3s ease-in';
          document.body.appendChild(cl);card.style.visibility='hidden';cl.offsetHeight;
          cl.style.left=(tgt.left+tgt.width/2-r.width/2)+'px';
          cl.style.top=(tgt.top+tgt.height/2-r.height/2)+'px';
          cl.style.opacity='0';cl.style.transform='scale(.3) rotate(10deg)';
          setTimeout(function(){try{cl.remove()}catch(e){}},450);
        }catch(e){}
      },i*100);
    });
  },3300);

  setTimeout(function(){
    document.querySelectorAll('.flying').forEach(function(e){try{e.remove()}catch(x){}});
    document.getElementById('dealerCards').innerHTML='';document.getElementById('playerCards').innerHTML='';
    updateScore('dealer',null);updateScore('player',null);
    if(balance<1000){document.getElementById('gameoverOverlay').classList.add('show')}
    else{bet=0;betChips=[];updateBetLabel();updatePotChips();switchPhase(PHASE_BET);document.getElementById('dealBtn').disabled=true}
  },4200);
}

// Fly chips from the actual pot stack — stack visibly shrinks as each chip leaves
function tryFlyChips(res,chips){
  try{
    var potEl=document.getElementById('potChips');
    var toEl=res==='lose'?document.querySelector('.dealer-avatar'):document.getElementById('balanceDisplay');
    var to=toEl.getBoundingClientRect();
    var potChildren=potEl.children;
    var n=potChildren.length;if(n===0)return;

    for(var i=0;i<n;i++){
      (function(idx){
        setTimeout(function(){
          try{
            // Get the top chip (last child) from the stack
            var topChip=potEl.lastElementChild;
            if(!topChip)return;
            var r=topChip.getBoundingClientRect();
            var cc=chips[chips.length-1-(idx)]?getChipColor(chips[chips.length-1-(idx)].amount):getChipColor(1000);

            // Create flying clone at the chip's exact position
            var sz=r.width||40;
            var c=document.createElement('div');c.className='flying';
            c.style.cssText='position:fixed;width:'+sz+'px;height:'+sz+'px;border-radius:50%;z-index:999;pointer-events:none;'+
              'border:2px solid '+cc.bdr+';'+
              'box-shadow:0 3px 12px rgba(0,0,0,.5),inset 0 2px 3px rgba(255,255,255,.15),inset 0 -2px 3px rgba(0,0,0,.2);'+
              'transition:left .7s cubic-bezier(.25,.46,.45,.94),top .7s cubic-bezier(.25,.46,.45,.94),opacity .28s ease .45s,transform .7s ease;'+
              'left:'+r.left+'px;top:'+r.top+'px;background:'+cc.bg;
            var ring=document.createElement('div');
            ring.style.cssText='position:absolute;inset:4px;border-radius:50%;border:2px dashed rgba(255,255,255,.3)';
            c.appendChild(ring);
            var gloss=document.createElement('div');
            gloss.style.cssText='position:absolute;inset:0;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.2) 0%,transparent 40%,transparent 60%,rgba(0,0,0,.12) 100%)';
            c.appendChild(gloss);

            // Remove the top chip from pot (stack shrinks)
            potEl.removeChild(topChip);

            // Animate flying clone to target
            document.body.appendChild(c);c.offsetHeight;
            c.style.left=(to.left+to.width/2-sz/2)+'px';
            c.style.top=(to.top+to.height/2-sz/2)+'px';
            c.style.opacity='0';c.style.transform='scale(.5)';
            setTimeout(function(){try{c.remove()}catch(e){}},1000);
          }catch(e){}
        },idx*180);
      })(i);
    }
  }catch(e){}
}

var selectedPayAmount=0;
function openPayment(){
  if(gameActive)return;
  selectedPayAmount=0;
  document.getElementById('payTotalAmount').textContent='₩0';
  document.querySelectorAll('.pay-amount-btn').forEach(function(b){b.classList.remove('selected')});
  document.getElementById('payOverlay').classList.add('show');
}
function closePayment(){document.getElementById('payOverlay').classList.remove('show')}
function selectPayAmount(el,amt){
  document.querySelectorAll('.pay-amount-btn').forEach(function(b){b.classList.remove('selected')});
  el.classList.add('selected');selectedPayAmount=amt;
  document.getElementById('payTotalAmount').textContent='₩'+fmt(amt);
}
function selectPayMethod(el){
  document.querySelectorAll('.pay-method-btn').forEach(function(b){b.classList.remove('selected')});
  el.classList.add('selected');
}
function submitPayment(){
  if(selectedPayAmount<=0)return;
  balance+=selectedPayAmount;updateBalance();
  closePayment();
  say('₩'+fmt(selectedPayAmount)+' 충전 완료!',2000);
  document.getElementById('gameoverOverlay').classList.remove('show');
  if(phase!==PHASE_BET){switchPhase(PHASE_BET);document.getElementById('dealBtn').disabled=true}
}

function quitGame(){
  if(gameActive){say('게임 진행 중에는 종료할 수 없습니다',2000);return}
  gameActive=false;disableActions();
  bet=0;betChips=[];
  document.getElementById('gameoverOverlay').classList.remove('show');
  document.getElementById('dealerCards').innerHTML='';document.getElementById('playerCards').innerHTML='';
  document.getElementById('potChips').innerHTML='';document.getElementById('betAmountLabel').textContent='';
  updateScore('dealer',null);updateScore('player',null);
  document.getElementById('startScreen').classList.remove('hidden');
  if(window._startLobbyRetry)window._startLobbyRetry();startBGM('lobby');
}

function fullReset(){
  balance=1000000;bet=0;betChips=[];histArr=[];playerHand=[];dealerHand=[];
  document.getElementById('gameoverOverlay').classList.remove('show');
  document.getElementById('dealerCards').innerHTML='';document.getElementById('playerCards').innerHTML='';
  document.getElementById('potChips').innerHTML='';document.getElementById('betAmountLabel').textContent='';
  updateBalance();updateScore('dealer',null);updateScore('player',null);renderHistory();
  document.getElementById('startScreen').classList.remove('hidden');
  if(window._startLobbyRetry)window._startLobbyRetry();startBGM('lobby');
}

// Service Worker Registration
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(function(){});
}
