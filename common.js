"use strict";

const SUPABASE_KEY="sb_publishable_uX2k4cNAjusr6MuM1gForw_Yo03bSS9";
const DIRECT_SUPABASE_ORIGIN="https://qcrecblhumamiqqyiccw.supabase.co";
const APK_GATEWAY_ORIGINS=[
  "https://myanmar-kyar-online.vercel.app",
  "https://myanmar-kyar-online-estiy7oxp-waiyanmyothein603-9487.vercel.app"
];
let GATEWAY_ORIGIN="";
let SUPABASE_URL="";
let MKO_API="";
let MKO_MOVE_API="";
let MKO_SOCIAL="";
let ONLINE_TRANSPORT="";

function bindOnlineOrigin(origin,proxy=true){
  GATEWAY_ORIGIN=origin.replace(/\/$/,"");
  SUPABASE_URL=proxy?GATEWAY_ORIGIN+"/api/supabase":GATEWAY_ORIGIN;
  MKO_API=SUPABASE_URL+"/functions/v1/mko-api";
  MKO_MOVE_API=SUPABASE_URL+"/functions/v1/mko-move-v2";
  MKO_SOCIAL=SUPABASE_URL+"/functions/v1/mko-social";
  ONLINE_TRANSPORT=proxy?"Vercel Gateway":"Direct Supabase";
}

async function prepareOnlineEndpoint(){
  const candidates=[];
  const isLocal=location.hostname==="localhost"||location.hostname==="127.0.0.1"||location.protocol==="file:"||location.protocol==="capacitor:";
  if(!isLocal && (location.protocol==="https:"||location.protocol==="http:")){
    candidates.push({origin:location.origin,proxy:true,label:"Same-origin Gateway"});
  }
  for(const origin of APK_GATEWAY_ORIGINS){
    if(!candidates.some(x=>x.origin===origin)) candidates.push({origin,proxy:true,label:"Vercel Gateway"});
  }
  candidates.push({origin:DIRECT_SUPABASE_ORIGIN,proxy:false,label:"Direct Supabase"});
  const failures=[];
  for(const c of candidates){
    try{
      const testUrl=c.proxy
        ? c.origin.replace(/\/$/,"")+"/api/supabase/auth/v1/settings"
        : c.origin.replace(/\/$/,"")+"/auth/v1/settings";
      const headers={"Accept":"application/json"};
      if(!c.proxy) headers["apikey"]=SUPABASE_KEY;
      const res=await fetch(testUrl,{method:"GET",headers,cache:"no-store"});
      if(res.ok){
        bindOnlineOrigin(c.origin,c.proxy);
        console.info("Online endpoint:",c.label,GATEWAY_ORIGIN);
        return {ok:true,label:c.label,origin:GATEWAY_ORIGIN};
      }
      failures.push(c.label+" HTTP "+res.status);
    }catch(e){
      failures.push(c.label+" "+String(e?.message||e));
    }
  }
  bindOnlineOrigin(APK_GATEWAY_ORIGINS[0],true);
  throw new Error("ONLINE_GATEWAY_UNREACHABLE · "+failures.join(" | "));
}

bindOnlineOrigin(APK_GATEWAY_ORIGINS[0],true);
const AI_BUDGET_MS=3400;

const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function toast(msg){const t=$("toast");t.textContent=msg;t.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.style.display="none",2600)}
function openModal(html){$("modalText").innerHTML=html;$("modal").classList.add("show")}
function closeModal(){$("modal").classList.remove("show")}
function showScreen(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));$(id)?.classList.add("active");window.scrollTo(0,0)}
function cloneBoard(b){return b.map(r=>r.slice())}
function inside(r,c){return r>=0&&r<8&&c>=0&&c<8}
function sideOf(p){return p>0?1:p<0?-1:0}
function isKing(p){return Math.abs(p)===2}
function squareName(p){return String.fromCharCode(97+p.c)+(8-p.r)}
function fmt(ms){const s=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function humanError(code){return ({AUTH_REQUIRED:"Online account မချိတ်ရသေးပါ",INVALID_SESSION:"Session သက်တမ်းကုန်နေပါတယ်",USERNAME_TAKEN:"ဒီနာမည်ကို တခြား Player သုံးထားပြီးပါပြီ",USERNAME_LENGTH:"နာမည် 2–24 လုံးဖြစ်ရပါမယ်",NOT_YOUR_TURN:"ယခု မင်းအလှည့်မဟုတ်ပါ",STALE_GAME:"Game state အသစ်ရှိနေပါတယ်",ILLEGAL_MOVE:"Rule အရ ဒီ Move မရပါ",TOURNAMENT_FULL:"Tournament ပြည့်နေပါပြီ",TOURNAMENT_NOT_OPEN:"Tournament ဖွင့်ထားခြင်းမရှိတော့ပါ",TOURNAMENT_MUST_BE_FULL:"Player ပြည့်မှ Tournament စနိုင်ပါတယ်",ONLY_HOST:"Tournament Host ပဲ စတင်နိုင်ပါတယ်",PLAYER_BUSY:"Player တစ်ယောက်မှာ မပြီးသေးတဲ့ Online ပွဲရှိနေပါတယ်",TOURNAMENT_NO_DRAW:"Tournament ပွဲမှာ Draw မခွင့်ပြုပါ",FRIENDS_REQUIRED:"Friend ဖြစ်ပြီးမှ ဒီလုပ်ဆောင်ချက်ကို သုံးနိုင်ပါတယ်",INVITE_EXPIRED:"ဖိတ်ခေါ်မှု သက်တမ်းကုန်သွားပါပြီ",INVITE_NOT_PENDING:"ဒီဖိတ်ခေါ်မှုကို ဖြေပြီးသားဖြစ်ပါတယ်",SELF_FRIEND:"ကိုယ့်ကိုယ်ကို Friend အပ်လို့မရပါ",INVALID_AVATAR:"Profile ပုံအမျိုးအစား မမှန်ပါ",AVATAR_TOO_LARGE:"Profile ပုံ 2MB ထက်မကြီးရပါ"}[code]||code||"Online error")}
const Rules={
  initial(){return [[1,0,1,0,1,0,1,0],[0,1,0,1,0,1,0,1],[1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0],[0,-1,0,-1,0,-1,0,-1],[-1,0,-1,0,-1,0,-1,0],[0,-1,0,-1,0,-1,0,-1]]},
  promote(p,r){if(p===1&&r===7)return 2;if(p===-1&&r===0)return -2;return p},
  capturesFrom(b,r,c,p){const out=[];if(!p)return out;if(!isKing(p)){const d=p>0?1:-1;for(const dc of [-1,1]){const mr=r+d,mc=c+dc,tr=r+2*d,tc=c+2*dc;if(inside(tr,tc)&&inside(mr,mc)&&sideOf(b[mr][mc])===-sideOf(p)&&b[tr][tc]===0)out.push({from:{r,c},to:{r:tr,c:tc},capture:{r:mr,c:mc},capturedKing:isKing(b[mr][mc])})}return out}for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){let nr=r+dr,nc=c+dc,enemy=null;while(inside(nr,nc)){const v=b[nr][nc];if(v===0){if(enemy)out.push({from:{r,c},to:{r:nr,c:nc},capture:enemy.pos,capturedKing:enemy.king})}else if(sideOf(v)===sideOf(p))break;else{if(enemy)break;enemy={pos:{r:nr,c:nc},king:isKing(v)}}nr+=dr;nc+=dc}}return out},
  applyStep(b,m){const nb=cloneBoard(b),p=nb[m.from.r][m.from.c];nb[m.from.r][m.from.c]=0;if(m.capture)nb[m.capture.r][m.capture.c]=0;nb[m.to.r][m.to.c]=this.promote(p,m.to.r);return nb},
  captureSequences(b,side){const result=[];const dfs=(cur,r,c,p,path,count,kings)=>{const caps=this.capturesFrom(cur,r,c,p);if(!caps.length){if(path.length)result.push({path:path.slice(),count,kings,board:cur});return}for(const m of caps){const next=this.applyStep(cur,m),np=next[m.to.r][m.to.c],nextPath=path.concat(m),nextCount=count+1,nextKings=kings+(m.capturedKing?1:0);if(!isKing(p)&&isKing(np)){result.push({path:nextPath,count:nextCount,kings:nextKings,board:next});continue}dfs(next,m.to.r,m.to.c,np,nextPath,nextCount,nextKings)}};for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(sideOf(p)===side)dfs(b,r,c,p,[],0,0)}if(!result.length)return [];const max=Math.max(...result.map(x=>x.count));return result.filter(x=>x.count===max)},
  normalMoves(b,side){const out=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(sideOf(p)!==side)continue;if(isKing(p)){for(const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]){let nr=r+dr,nc=c+dc;while(inside(nr,nc)&&b[nr][nc]===0){const m={from:{r,c},to:{r:nr,c:nc},capture:null};out.push({path:[m],count:0,kings:0,board:this.applyStep(b,m)});nr+=dr;nc+=dc}}}else{const d=p>0?1:-1;for(const dc of [-1,1]){const nr=r+d,nc=c+dc;if(inside(nr,nc)&&b[nr][nc]===0){const m={from:{r,c},to:{r:nr,c:nc},capture:null};out.push({path:[m],count:0,kings:0,board:this.applyStep(b,m)})}}}}return out},
  legal(b,side){const caps=this.captureSequences(b,side);return caps.length?caps:this.normalMoves(b,side)},
  terminal(b,sideToMove){let black=0,white=0;for(const row of b)for(const p of row){if(p>0)black++;else if(p<0)white++}if(black===0)return {winner:-1,reason:"pieces"};if(white===0)return {winner:1,reason:"pieces"};if(!this.legal(b,sideToMove).length)return {winner:-sideToMove,reason:"no_moves"};return null}
};
class TimerEngine{constructor(onTick,onTimeout){this.onTick=onTick;this.onTimeout=onTimeout;this.id=null;this.limit=0;this.remaining={1:0,"-1":0};this.turn=1;this.started=0;this.running=false}reset(minutes,turn=1){this.stop();this.limit=minutes*60000;this.remaining={1:this.limit,"-1":this.limit};this.turn=turn;this.started=performance.now();this.running=true;this.id=setInterval(()=>this.tick(),100);this.tick()}live(side){if(!this.running||side!==this.turn)return this.remaining[side];return Math.max(0,this.remaining[side]-(performance.now()-this.started))}commitTurn(){if(!this.running)return;this.remaining[this.turn]=this.live(this.turn)}switchTurn(next){this.commitTurn();this.turn=next;this.started=performance.now();this.tick()}tick(){if(!this.running)return;const b=this.live(1),w=this.live(-1);this.onTick(b,w);const cur=this.live(this.turn);if(cur<=0){const loser=this.turn;this.stop();this.onTimeout(loser)}}stop(){if(this.id)clearInterval(this.id);this.id=null;this.running=false}}
class ResultEngine{constructor(){this.done=false;this.result=null}reset(){this.done=false;this.result=null}finalize(result){if(this.done)return false;this.done=true;this.result={...result,at:Date.now()};return true}}
const AI={
  MATE:10000000,INF:1000000000,nodes:0,lastDepth:0,lastScore:0,lastNodes:0,
  key(b,side){return side+"|"+b.map(r=>r.join(",")).join("/")},
  countPieces(b){let n=0;for(const row of b)for(const p of row)if(p)n++;return n},
  evaluate(b){
    let score=0,blackMen=0,whiteMen=0,blackKings=0,whiteKings=0,total=0;
    for(const row of b)for(const p of row)if(p)total++;
    for(let r=0;r<8;r++)for(let c=0;c<8;c++){
      const p=b[r][c];if(!p)continue;
      const side=p>0?1:-1,king=isKing(p),advance=side===1?r:7-r;
      const center=7-(Math.abs(r-3.5)+Math.abs(c-3.5));
      const edge=(r===0||r===7||c===0||c===7)?1:0;
      let v=king?365:100;
      if(king){
        v+=center*(total<=10?7:4)-edge*(total<=8?2:5);
        if(side===1)blackKings++;else whiteKings++;
      }else{
        v+=advance*8+center*2+edge*2;
        if(advance>=5)v+=22+(advance-5)*16;
        if((side===1&&r===0)||(side===-1&&r===7))v+=total>12?12:4;
        if(advance===6)v+=26;
        const back=side===1?-1:1;
        let support=0;
        for(const dc of [-1,1]){
          const sr=r+back,sc=c+dc;
          if(inside(sr,sc)&&sideOf(b[sr][sc])===side)support++;
        }
        v+=support*7;
        if(side===1)blackMen++;else whiteMen++;
      }
      score+=side*v;
    }

    const bCaps=Rules.captureSequences(b,1),wCaps=Rules.captureSequences(b,-1);
    const bMoves=bCaps.length?bCaps:Rules.normalMoves(b,1);
    const wMoves=wCaps.length?wCaps:Rules.normalMoves(b,-1);
    const mobilityWeight=total<=10?10:5;
    score+=(bMoves.length-wMoves.length)*mobilityWeight;

    if(bCaps.length){
      const kings=Math.max(...bCaps.map(x=>x.kings||0));
      score+=42+bCaps[0].count*48+kings*34;
    }
    if(wCaps.length){
      const kings=Math.max(...wCaps.map(x=>x.kings||0));
      score-=42+wCaps[0].count*48+kings*34;
    }

    if(total<=12){
      score+=(blackKings-whiteKings)*58+(blackMen-whiteMen)*12;
      const material=(blackMen-whiteMen)*100+(blackKings-whiteKings)*365;
      if(material>120)score+=18;else if(material<-120)score-=18;
    }
    return Math.round(score);
  },
  moveKey(m){return m.path.map(x=>`${x.from.r}${x.from.c}-${x.to.r}${x.to.c}${x.capture?`x${x.capture.r}${x.capture.c}`:""}`).join("|")},
  promotes(m,sourceBoard){
    const first=m.path?.[0],last=m.path?.[m.path.length-1];
    if(!first||!last||!sourceBoard)return false;
    const before=sourceBoard[first.from.r][first.from.c];
    const after=m.board[last.to.r][last.to.c];
    return !!before&&!isKing(before)&&isKing(after);
  },
  moveOrderScore(m,side,ttBest=null,sourceBoard=null){
    const key=this.moveKey(m);if(ttBest&&key===ttBest)return this.MATE*2;
    const term=Rules.terminal(m.board,-side);if(term)return term.winner===side?this.MATE:-this.MATE;
    let s=m.count*16000+m.kings*4200;
    if(this.promotes(m,sourceBoard))s+=6500;
    const oppCaps=Rules.captureSequences(m.board,-side);
    if(oppCaps.length){
      const k=Math.max(...oppCaps.map(x=>x.kings||0));
      s-=oppCaps[0].count*7200+k*2200;
    }
    s+=this.evaluate(m.board)*side*4;
    return s;
  },
  order(moves,side,ttBest=null,sourceBoard=null){
    return moves.slice().sort((a,b)=>this.moveOrderScore(b,side,ttBest,sourceBoard)-this.moveOrderScore(a,side,ttBest,sourceBoard));
  },
  choose(b,side,budget=AI_BUDGET_MS){
    const root=Rules.legal(b,side);if(!root.length)return null;
    const pieces=this.countPieces(b),ownEval=this.evaluate(b)*side;
    let realBudget=Math.max(3200,budget);
    if(pieces<=14)realBudget=Math.max(realBudget,4200);
    if(pieces<=10)realBudget=Math.max(realBudget,5200);
    if(pieces<=7)realBudget=Math.max(realBudget,7000);
    if(ownEval<-160)realBudget=Math.max(realBudget,5200);

    const start=performance.now(),deadline=start+realBudget;
    const tt=new Map(),history=new Map(),killers=new Map(),seen=new Map();
    this.nodes=0;this.lastDepth=0;this.lastScore=0;
    const timeUp=()=>performance.now()>=deadline;
    const checkTime=()=>{this.nodes++;if((this.nodes&63)===0&&timeUp())throw Error("TIME")};
    const enter=(board,s)=>{
      const k=this.key(board,s),n=seen.get(k)||0;
      if(n>=2)return null;
      seen.set(k,n+1);return k;
    };
    const leave=k=>{if(!k)return;const n=(seen.get(k)||1)-1;if(n<=0)seen.delete(k);else seen.set(k,n)};

    const qsearch=(board,s,alpha,beta,qleft,ply)=>{
      checkTime();
      const rep=enter(board,s);if(!rep)return 0;
      try{
        const term=Rules.terminal(board,s);
        if(term)return term.winner===s?this.MATE-ply:-this.MATE+ply;
        const caps=Rules.captureSequences(board,s);
        if(!caps.length||qleft<=0)return this.evaluate(board)*s;
        let best=-this.INF;
        const ordered=this.order(caps,s,null,board);
        for(const m of ordered){
          const v=-qsearch(m.board,-s,-beta,-alpha,qleft-1,ply+1);
          if(v>best)best=v;if(v>alpha)alpha=v;if(alpha>=beta)break;
        }
        return best;
      }finally{leave(rep)}
    };

    const search=(board,s,depth,alpha,beta,ply)=>{
      checkTime();
      const rep=enter(board,s);if(!rep)return 0;
      try{
        const alphaOrig=alpha,key=this.key(board,s),entry=tt.get(key);
        if(entry&&entry.depth>=depth){
          if(entry.flag==="EXACT")return entry.value;
          if(entry.flag==="LOWER")alpha=Math.max(alpha,entry.value);else if(entry.flag==="UPPER")beta=Math.min(beta,entry.value);
          if(alpha>=beta)return entry.value;
        }
        const term=Rules.terminal(board,s);
        if(term)return term.winner===s?this.MATE-ply:-this.MATE+ply;
        if(depth<=0)return qsearch(board,s,alpha,beta,12,ply);

        const moves=Rules.legal(board,s);
        let ordered=this.order(moves,s,entry?.best||null,board);
        const killer=killers.get(ply);
        if(killer)ordered.sort((a,z)=>(this.moveKey(z)===killer?1:0)-(this.moveKey(a)===killer?1:0));
        ordered.sort((a,z)=>(history.get(this.moveKey(z))||0)-(history.get(this.moveKey(a))||0));

        let best=-this.INF,bestKey=null;
        for(let i=0;i<ordered.length;i++){
          const m=ordered[i];
          let childDepth=depth-1;
          if(m.count>0)childDepth=depth;
          else if(this.promotes(m,board)&&depth<=5)childDepth=depth;

          let v;
          if(i===0)v=-search(m.board,-s,childDepth,-beta,-alpha,ply+1);
          else{
            v=-search(m.board,-s,childDepth,-alpha-1,-alpha,ply+1);
            if(v>alpha&&v<beta)v=-search(m.board,-s,childDepth,-beta,-alpha,ply+1);
          }
          if(v>best){best=v;bestKey=this.moveKey(m)}
          if(v>alpha)alpha=v;
          if(alpha>=beta){
            if(m.count===0){
              killers.set(ply,bestKey);
              history.set(bestKey,(history.get(bestKey)||0)+depth*depth);
            }
            break;
          }
        }
        let flag="EXACT";if(best<=alphaOrig)flag="UPPER";else if(best>=beta)flag="LOWER";
        tt.set(key,{depth,value:best,flag,best:bestKey});
        return best;
      }finally{leave(rep)}
    };

    let best=this.order(root,side,null,b)[0],completedScore=-this.INF;
    const maxDepth=pieces<=7?36:pieces<=10?26:pieces<=14?20:17;

    for(let depth=1;depth<=maxDepth;depth++){
      if(timeUp())break;
      try{
        let localBest=best,localScore=-this.INF;
        let alpha=-this.INF,beta=this.INF;
        if(depth>=4&&Math.abs(completedScore)<this.MATE/2){alpha=completedScore-110;beta=completedScore+110}
        const originalAlpha=alpha,originalBeta=beta;
        const rootEntry=tt.get(this.key(b,side));
        const ordered=this.order(root,side,rootEntry?.best||this.moveKey(best),b);

        const runRoot=(a,z)=>{
          let rb=localBest,rs=-this.INF,ra=a;
          for(let i=0;i<ordered.length;i++){
            const m=ordered[i];
            let d=depth-1;if(m.count>0)d=depth;else if(this.promotes(m,b)&&depth<=5)d=depth;
            let v;
            if(i===0)v=-search(m.board,-side,d,-z,-ra,1);
            else{
              v=-search(m.board,-side,d,-ra-1,-ra,1);
              if(v>ra&&v<z)v=-search(m.board,-side,d,-z,-ra,1);
            }
            if(v>rs){rs=v;rb=m}
            if(v>ra)ra=v;
            if(timeUp())throw Error("TIME");
          }
          return {best:rb,score:rs};
        };

        let result=runRoot(alpha,beta);
        if((result.score<=originalAlpha||result.score>=originalBeta)&&!timeUp())result=runRoot(-this.INF,this.INF);
        localBest=result.best;localScore=result.score;
        best=localBest;completedScore=localScore;
        this.lastDepth=depth;this.lastScore=localScore;
        if(Math.abs(localScore)>=this.MATE-1000)break;
      }catch(e){if(e.message!=="TIME")console.error(e);break}
    }
    this.lastNodes=this.nodes;
    return best;
  }
}
