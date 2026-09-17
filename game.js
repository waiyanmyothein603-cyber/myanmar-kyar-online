/* =========================
   MATCH CONTROLLER
   ========================= */
const Game={
  board:Rules.initial(),turn:1,mode:"ai",mySide:1,minutes:5,moveNo:1,selected:null,candidates:[],history:[],aiBusy:false,matchId:null,moveVersion:0,drawPending:false,onlineMovePending:false,onlineTimeoutPending:false,lastDrawOffer:null,serverGame:null,snapshots:[],
  timer:null,result:new ResultEngine(),
  init(){this.timer=new TimerEngine((b,w)=>this.renderClocks(b,w),loser=>{if(this.mode==="online"){if(!this.onlineTimeoutPending&&this.matchId){this.onlineTimeoutPending=true;this.renderStatus("⏱️ Server က အချိန်ကုန် result ကို အတည်ပြုနေပါတယ်...");Backend.claimTimeout(this.matchId).finally(()=>this.onlineTimeoutPending=false)}return}this.finish({winner:-loser,reason:"timeout"})})},
  start(mode,opts={}){
    if(mode!=="online"&&Backend.activeGameId){openModal(`<h3>⚔️ Online ပွဲရှိနေပါတယ်</h3><p>Online ပွဲမပြီးသေးခင် အခြားပွဲအသစ်မစသင့်ပါ။</p><button class="btn green" onclick="closeModal();resumeActiveGame()">Online ပွဲကို ပြန်ဝင်မယ်</button>`);return false}
    this.board=Rules.initial();this.turn=1;this.mode=mode;this.mySide=opts.mySide??1;this.minutes=Number(opts.minutes||this.minutes);this.moveNo=1;this.selected=null;this.candidates=[];this.history=[];this.snapshots=[];this.aiBusy=false;this.onlineMovePending=false;this.matchId=opts.matchId||null;this.moveVersion=0;this.drawPending=false;this.lastDrawOffer=null;this.serverGame=null;this.replayBoards=[cloneBoard(this.board)];this.replayMoves=[];this.result.reset();this.timer.reset(this.minutes,this.turn);showScreen("game");$("gameChatPanel").classList.add("hidden");clearInterval(gameChatTimer);this.setNames(opts);this.render();if(mode!=="online")this.afterTurn();return true
  },
  startOnline(g){
    this.timer.stop();this.board=Rules.initial();this.turn=1;this.mode="online";this.mySide=g.black_id===Backend.user.id?1:-1;this.minutes=Number(g.time_limit_seconds||300)/60;this.moveNo=1;this.selected=null;this.candidates=[];this.history=[];this.snapshots=[];this.aiBusy=false;this.onlineMovePending=false;this.onlineTimeoutPending=false;this.matchId=g.id;this.moveVersion=Number(g.version||0);this.drawPending=false;this.lastDrawOffer=null;this.serverGame=null;this.result.reset();showScreen("game");$("gameChatPanel").classList.add("hidden");clearInterval(gameChatTimer);this.applyServerGame(g,true)
  },
  setNames(opts={}){
    if(this.mode==="ai"||this.mode==="bot_fallback"){$("blackName").textContent="⚫ You";$("whiteName").textContent="⚪ Computer Pro";$("blackMeta").textContent="Player";$("whiteMeta").textContent=this.mode==="bot_fallback"?"Quick Match fallback · Rating မတွက်":"Local Pro AI"}
  },
  setOnlineNames(g){
    const bn=g.black?.username||"Black Player",wn=g.white?.username||"White Player";$("blackName").textContent="⚫ "+bn+(g.black_id===Backend.user.id?" · You":"");$("whiteName").textContent="⚪ "+wn+(g.white_id===Backend.user.id?" · You":"");
    const mode=g.mode==="tournament"?"🏆 Tournament":"🌐 Ranked Online";$("blackMeta").textContent=`${mode} · Rating ${g.black?.rating??"—"}`;$("whiteMeta").textContent=`${mode} · Rating ${g.white?.rating??"—"}`;$("drawBtn").disabled=g.mode==="tournament"
  },
  viewSide(){return this.mySide},
  updatePerspective(){
    const side=this.viewSide(),top=$("topPlayerSlot"),bottom=$("bottomPlayerSlot"),black=$("blackCard"),white=$("whiteCard");if(!top||!bottom||!black||!white)return;const own=side===1?black:white,opp=side===1?white:black;if(opp.parentElement!==top)top.appendChild(opp);if(own.parentElement!==bottom)bottom.appendChild(own);black.classList.toggle("you-card",side===1);white.classList.toggle("you-card",side===-1);black.classList.toggle("opponent-card",side!==1);white.classList.toggle("opponent-card",side!==-1)
  },
  canAct(){if(this.result.done||this.aiBusy||this.onlineMovePending)return false;if(this.mode==="online")return this.turn===this.mySide;return this.turn===1},
  firstStepOptions(){return Rules.legal(this.board,this.turn)},
  click(r,c){
    if(!this.canAct()){toast(this.aiBusy?"Computer စဉ်းစားနေပါတယ်":"ယခု မင်းအလှည့်မဟုတ်ပါ");return}
    if(this.selected){const matches=this.candidates.filter(s=>{const m=s.path[0];return m.to.r===r&&m.to.c===c});if(matches.length){this.playSequence(matches);return}}
    if(sideOf(this.board[r][c])!==this.turn)return;const all=this.firstStepOptions(),choices=all.filter(s=>s.path[0].from.r===r&&s.path[0].from.c===c);if(!choices.length){toast("ဒီ Piece က legal move မရှိပါ");return}this.selected={r,c};this.candidates=choices;this.render()
  },
  async playSequence(matches){
    const finals=new Map();for(const s of matches)finals.set(JSON.stringify(s.board),s);let chosen=[...finals.values()][0];if(finals.size>1)chosen=[...finals.values()].sort((a,b)=>b.count-a.count||b.kings-a.kings)[0];
    if(this.mode==="online"){
      this.onlineMovePending=true;this.selected=null;this.candidates=[];this.renderStatus("📡 Move ကို Server Rule Engine စစ်နေပါတယ်...");
      try{const r=await Backend.move({game_id:this.matchId,version:this.moveVersion,path:chosen.path});if(r.game)this.applyServerGame(r.game)}catch(e){toast(humanError(e.code||e.message));if(e.payload?.game)this.applyServerGame(e.payload.game);else Backend.refreshGame(this.matchId)}finally{this.onlineMovePending=false}return
    }
    const oldTurn=this.turn;this.board=cloneBoard(chosen.board);this.history.push(`${oldTurn===1?"Black":"White"}: `+chosen.path.map(m=>squareName(m.from)+(m.capture?"x":"-")+squareName(m.to)).join(" "));this.snapshots.push(cloneBoard(this.board));this.turn=-this.turn;this.moveNo++;this.selected=null;this.candidates=[];this.timer.switchTurn(this.turn);this.render();this.afterTurn()
  },
  applyServerGame(g,first=false){
    if(!g||this.mode!=="online"||g.id!==this.matchId)return;this.serverGame=g;this.onlineMovePending=false;this.onlineTimeoutPending=false;this.board=cloneBoard(g.board);this.turn=Number(g.turn);this.moveVersion=Number(g.version||0);this.moveNo=Number(g.move_number||0)+1;this.selected=null;this.candidates=[];this.mySide=g.black_id===Backend.user.id?1:-1;this.minutes=Number(g.time_limit_seconds||300)/60;this.setOnlineNames(g);
    const total=Number(g.time_limit_seconds||300)*1000;let br=Number(g.black_remaining_ms??total),wr=Number(g.white_remaining_ms??total);const serverNow=Date.parse(g.server_now||new Date().toISOString()),started=Date.parse(g.turn_started_at||g.server_now||new Date().toISOString()),elapsed=Math.max(0,(Number.isFinite(serverNow)&&Number.isFinite(started))?serverNow-started:0);if(g.status==="active"){if(this.turn===1)br=Math.max(0,br-elapsed);else wr=Math.max(0,wr-elapsed)}
    this.timer.stop();this.timer.limit=total;this.timer.remaining={1:br,"-1":wr};this.timer.turn=this.turn;this.timer.started=performance.now();this.timer.running=g.status==="active";if(this.timer.running)this.timer.id=setInterval(()=>this.timer.tick(),100);this.render();
    if(g.draw_offer_by&&g.draw_offer_by!==Backend.user.id&&g.draw_offer_by!==this.lastDrawOffer&&g.status==="active"&&g.mode!=="tournament"){this.lastDrawOffer=g.draw_offer_by;openModal(`<h3>🤝 Draw Offer</h3><p>ပြိုင်ဘက်က သရေတောင်းထားပါတယ်။</p><button class="btn" onclick="closeModal();acceptOnlineDraw()">Accept Draw</button><button class="btn red" onclick="closeModal();rejectOnlineDraw()">Reject</button>`)}else if(!g.draw_offer_by)this.lastDrawOffer=null;
    if(g.status!=="active"){
      Backend.activeGameId=null;Backend.stopGameWatch();$("resumeCard").classList.add("hidden");const winner=g.winner_id? (g.winner_id===g.black_id?1:-1):0;this.finish({winner,reason:g.result_type||"finished"});Backend.loadProfile().catch(()=>{})
    }
  },
  afterTurn(){const term=Rules.terminal(this.board,this.turn);if(term){this.finish(term);return}if((this.mode==="ai"||this.mode==="bot_fallback")&&this.turn===-1)this.runAI()},
  runAI(){if(this.aiBusy||this.result.done)return;this.aiBusy=true;this.renderStatus("🤖 Computer စဉ်းစားနေပါတယ်...");const token=Symbol();this.__aiToken=token;setTimeout(()=>{if(this.__aiToken!==token||this.result.done||this.turn!==-1){this.aiBusy=false;return}const chosen=AI.choose(this.board,-1,AI_BUDGET_MS);this.aiBusy=false;if(!chosen){const term=Rules.terminal(this.board,-1);if(term)this.finish(term);return}this.playSequence([chosen])},60)},
  finish(res){
    if(!this.result.finalize(res))return;this.aiBusy=false;this.__aiToken=null;this.timer.stop();this.render();const win=res.winner===this.mySide;let title=res.winner===0?"🤝 သရေ":win?"🏆 အနိုင်ရပါပြီ":"❌ ရှုံးနိမ့်ပါပြီ";let reason={timeout:"အချိန်ကုန်",resign:"Resign",pieces:"ကျားကုန်",no_moves:"ရွှေ့ကွက်မရှိ",draw:"နှစ်ဖက်သဘောတူ Draw",disconnect:"ပြိုင်ဘက် connection 20 sec ကျော်ပြတ်",admin:"Admin Result",finished:"ပွဲပြီးပါပြီ"}[res.reason]||res.reason;openModal(`<h2 style="color:#ffd45c">${title}</h2><p>${esc(reason||"ပွဲပြီးပါပြီ")}</p><button class="btn" onclick="closeModal();goHome()">Home</button>`)
  },
  render(){
    const el=$("board");el.innerHTML="";this.updatePerspective();const legal=this.result.done?[]:this.firstStepOptions();const targets=this.selected?this.candidates.map(x=>x.path[0].to):[];const flip=this.viewSide()===1;
    for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){const r=flip?7-vr:vr,c=flip?7-vc:vc;const sq=document.createElement("div");sq.className="square "+(((r+c)%2)?"dark":"light");if(this.selected&&this.selected.r===r&&this.selected.c===c)sq.classList.add("selected");if(targets.some(t=>t.r===r&&t.c===c)){sq.classList.add("target");const d=document.createElement("div");d.className="dot";sq.appendChild(d)}const p=this.board[r][c];if(p){const pe=document.createElement("div");pe.className="piece "+(p>0?"black":"white")+(isKing(p)?" king":"");if(isKing(p)){const k=document.createElement("span");k.className="kingmark";k.textContent="♛";pe.appendChild(k)}sq.appendChild(pe)}sq.onclick=()=>this.click(r,c);el.appendChild(sq)}
    let bc=0,wc=0;for(const row of this.board)for(const p of row){if(p>0)bc++;else if(p<0)wc++}$("blackCount").textContent=bc;$("whiteCount").textContent=wc;$("moveNo").textContent=Math.floor((this.moveNo-1)/2)+1;$("blackCard").classList.toggle("active",this.turn===1&&!this.result.done);$("whiteCard").classList.toggle("active",this.turn===-1&&!this.result.done);if(this.mode!=="online")$("drawBtn").disabled=false;
    if(!this.aiBusy){const capture=legal.some(s=>s.count>0);const own=this.mode==="online"?(this.turn===this.mySide?" · သင့်အလှည့်":" · ပြိုင်ဘက်အလှည့်"):"";this.renderStatus(this.result.done?"ပွဲပြီးပါပြီ":`${this.turn===1?"⚫ Black":"⚪ White"} အလှည့်${own}${capture?" · ⚠️ Capture Required":""}`)}
  },
  renderStatus(s){$("status").textContent=s},renderClocks(b,w){for(const [id,ms] of [["blackClock",b],["whiteClock",w]]){const e=$(id);e.textContent=fmt(ms);e.classList.toggle("low",ms<=10000)}}
};
Game.init();
