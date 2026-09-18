/* =========================
   SUPABASE AUTH FALLBACK
   Works even when the external Supabase JS CDN is blocked by an Android WebView.
   ========================= */
const RawAuth={
  key:"mko_supabase_session_v2",
  memory:null,
  load(){
    if(this.memory)return this.memory;
    try{const v=localStorage.getItem(this.key);if(v)this.memory=JSON.parse(v)}catch(_){}
    return this.memory
  },
  save(session){
    this.memory=session||null;
    try{session?localStorage.setItem(this.key,JSON.stringify(session)):localStorage.removeItem(this.key)}catch(_){}
    return this.memory
  },
  async request(path,options={}){
    const res=await fetch(SUPABASE_URL+path,{...options,headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json",...(options.headers||{})}});
    let data={};try{data=await res.json()}catch(_){}
    if(!res.ok){const e=new Error(data?.msg||data?.message||data?.error_description||data?.error||("AUTH_HTTP_"+res.status));e.status=res.status;e.payload=data;throw e}
    return data
  },
  expired(session){
    if(!session?.access_token)return true;
    const exp=Number(session.expires_at||0);return exp>0&&Date.now()>=exp*1000-60000
  },
  async refresh(session){
    if(!session?.refresh_token)throw new Error("SESSION_REFRESH_TOKEN_MISSING");
    const data=await this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
    return this.save(data)
  },
  async getSession(){
    let s=this.load();if(s&&this.expired(s)){try{s=await this.refresh(s)}catch(_){this.save(null);s=null}}return s
  },
  async signInAnonymously(){
    const data=await this.request('/auth/v1/signup',{method:'POST',body:JSON.stringify({data:{}})});
    if(!data?.access_token||!data?.user)throw new Error("Anonymous session response မပြည့်စုံပါ");
    return this.save(data)
  }
};

const Backend={
  client:null,user:null,profile:null,ready:false,authError:null,gameChannel:null,gamePoll:null,heartbeat:null,lobbyChannel:null,tournamentChannel:null,activeGameId:null,quickToken:0,
  authMode:"raw",
  async init(){
    try{
      this.ready=false;this.authError=null;
      await prepareOnlineEndpoint();
      let session=null;
      if(window.supabase?.createClient){
        try{
          this.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
          let got=await this.client.auth.getSession();if(got.error)throw got.error;session=got.data.session;
          if(!session){const signed=await this.client.auth.signInAnonymously();if(signed.error)throw signed.error;session=signed.data.session}
          if(session?.user)this.authMode="sdk";
        }catch(sdkError){console.warn("Supabase SDK auth failed; raw REST fallback",sdkError);this.client=null;session=null}
      }
      if(!session){
        session=await RawAuth.getSession();
        if(!session)session=await RawAuth.signInAnonymously();
        this.authMode="raw";
      }
      if(!session?.user||!session?.access_token)throw new Error("Anonymous online login မအောင်မြင်ပါ");
      this.user=session.user;this.ready=true;this.authError=null;
      $("authState").className="notice ok";$("authState").textContent="🟢 Online Server ချိတ်ဆက်ပြီးပါပြီ · Account ကို ဒီ device မှာ အလိုအလျောက်မှတ်ထားမယ်";
      try{await this.loadProfile()}catch(profileError){console.warn("Profile load fallback",profileError);await this.loadProfileDirect(session.access_token)}
      try{this.startLobbyPresence()}catch(e){console.warn("Presence init",e)}
      try{await this.checkActiveGame(false)}catch(e){console.warn("Active game check",e)}
    }catch(e){
      console.error("Backend init",e);this.ready=false;this.authError=String(e?.message||e);
      $("authState").className="notice err";
      $("authState").innerHTML="❌ Online Server မချိတ်နိုင်သေးပါ။<br><span class='small'>"+esc(this.authError)+"</span><br><button class='btn secondary' onclick='retryOnlineConnection()'>↻ ပြန်ချိတ်မယ်</button>";
    }
  },
  async session(){
    let session=null;
    if(this.authMode==="sdk"&&this.client){const got=await this.client.auth.getSession();if(got.error)throw got.error;session=got.data.session}
    else session=await RawAuth.getSession();
    if(!session?.access_token)throw new Error("INVALID_SESSION");this.user=session.user;return session
  },
  async api(action,payload={}){
    if(!this.ready)throw new Error(this.authError||"AUTH_REQUIRED")
    const session=await this.session();
    const res=await fetch(MKO_API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,...payload})});
    let data={};try{data=await res.json()}catch(_){throw new Error("Server response ဖတ်မရပါ")}
    if(!res.ok||data.ok===false){const er=new Error(data.error||"SERVER_ERROR");er.code=data.error;er.payload=data;throw er}return data
  },
  async move(payload={}){if(!this.ready)throw new Error(this.authError||"AUTH_REQUIRED");const session=await this.session();const res=await fetch(MKO_MOVE_API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token},body:JSON.stringify(payload)});let data={};try{data=await res.json()}catch(_){throw new Error("Move server response ဖတ်မရပါ")};if(!res.ok||data.ok===false){const er=new Error(data.error||"SERVER_ERROR");er.code=data.error;er.payload=data;throw er}return data},
  async social(action,payload={}){if(!this.ready)throw new Error(this.authError||"AUTH_REQUIRED");const session=await this.session();const res=await fetch(MKO_SOCIAL,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,...payload})});let data={};try{data=await res.json()}catch(_){throw new Error("Server response ဖတ်မရပါ")};if(!res.ok||data.ok===false){const er=new Error(data.error||"SERVER_ERROR");er.code=data.error;throw er}return data},
  async loadProfile(){const r=await this.api("my_profile");this.profile=r.profile;this.renderProfile();return this.profile},
  async loadProfileDirect(accessToken){const res=await fetch(SUPABASE_URL+"/rest/v1/profiles?id=eq."+encodeURIComponent(this.user.id)+"&select=*",{headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+accessToken}});let data=[];try{data=await res.json()}catch(_){}if(!res.ok||!Array.isArray(data)||!data[0])throw new Error((data&&data.message)||("PROFILE_HTTP_"+res.status));this.profile=data[0];this.renderProfile();return this.profile},
  renderProfile(){const p=this.profile;if(!p)return;$("profileRating").textContent=p.rating??1200;$("profilePoints").textContent=p.points??0;$("profileWDL").textContent=`${p.wins||0}/${p.draws||0}/${p.losses||0}`;$("homeName").textContent=p.username||"Player";$("homeAvatar").src=p.avatar_url||avatarFallback(p.username);if($("profileNameInput"))$("profileNameInput").value=p.username||"";if($("profileBioInput"))$("profileBioInput").value=p.bio||"";if($("editAvatarPreview"))$("editAvatarPreview").src=p.avatar_url||avatarFallback(p.username)},
  startLobbyPresence(){try{if(!this.client?.channel){$("onlineCount").textContent="ONLINE";return}if(this.lobbyChannel)this.client.removeChannel(this.lobbyChannel);const uid=this.user.id;this.lobbyChannel=this.client.channel("mko-lobby-presence",{config:{presence:{key:uid}}}).on("presence",{event:"sync"},()=>{const st=this.lobbyChannel.presenceState();const count=Object.values(st).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0);$("onlineCount").textContent=count}).subscribe(async status=>{if(status==="SUBSCRIBED")await this.lobbyChannel.track({user_id:uid,username:this.profile?.username||"Player",online_at:new Date().toISOString()})})}catch(e){console.warn("presence",e);$("onlineCount").textContent="ONLINE"}},
  async checkActiveGame(autoOpen=false){if(!this.ready)return null;try{const r=await this.api("active_game");const g=r.game||null;this.activeGameId=g?.id||null;$("resumeCard").classList.toggle("hidden",!g);if(g&&autoOpen)await this.openGame(g);return g}catch(e){console.warn(e);return null}},
  async openGame(game){this.activeGameId=game.id;Game.startOnline(game);this.watchGame(game.id)},
  watchGame(id){this.stopGameWatch();this.activeGameId=id;try{if(!this.client?.channel)throw new Error("Realtime SDK unavailable; polling mode");this.gameChannel=this.client.channel("mko-game-db-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"games",filter:"id=eq."+id},()=>this.refreshGame(id)).subscribe(status=>{if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")console.warn("Realtime",status)})}catch(e){console.warn("Realtime setup",e)}this.gamePoll=setInterval(()=>this.refreshGame(id,true),2000);this.heartbeat=setInterval(()=>this.sendHeartbeat(id),5000);this.sendHeartbeat(id)},
  stopGameWatch(){if(this.gameChannel&&this.client){try{this.client.removeChannel(this.gameChannel)}catch(_){}this.gameChannel=null}clearInterval(this.gamePoll);clearInterval(this.heartbeat);this.gamePoll=null;this.heartbeat=null},
  async refreshGame(id,silent=false){if(this.activeGameId!==id)return;try{const r=await this.api("get_game",{game_id:id});if(r.game&&this.activeGameId===id)Game.applyServerGame(r.game)}catch(e){if(!silent)toast(humanError(e.code||e.message))}},
  async sendHeartbeat(id){if(this.activeGameId!==id)return;try{const r=await this.api("heartbeat",{game_id:id});const now=Date.parse(r.server_now),seen=Date.parse(r.opponent_last_seen_at);const gap=Number.isFinite(now)&&Number.isFinite(seen)?now-seen:0;if(gap>20000){Game.renderStatus("⚠️ ပြိုင်ဘက် 20 sec ကျော် Offline · result စစ်နေပါတယ်...");const c=await this.api("claim_disconnect",{game_id:id});if(c.game)Game.applyServerGame(c.game)}else if(gap>9000)Game.renderStatus(`📡 ပြိုင်ဘက် connection ပြတ်နေပါတယ် · ${Math.max(1,Math.ceil((20000-gap)/1000))} sec reconnect စောင့်နေသည်`)}catch(e){console.warn("heartbeat",e)}},
  async claimTimeout(id){try{const r=await this.api("claim_timeout",{game_id:id});if(r.game)Game.applyServerGame(r.game)}catch(e){console.warn(e);setTimeout(()=>this.refreshGame(id),700)}},
  async resume(){const g=await this.checkActiveGame(false);if(g)return this.openGame(g);toast("လက်ရှိ Online ပွဲမရှိပါ")},
  watchTournament(id){this.stopTournamentWatch();try{if(!this.client?.channel)throw new Error("Realtime SDK unavailable; polling mode");this.tournamentChannel=this.client.channel("mko-tournament-db-"+id).on("postgres_changes",{event:"*",schema:"public",table:"tournament_matches",filter:"tournament_id=eq."+id},()=>refreshTournamentDetail(true)).on("postgres_changes",{event:"UPDATE",schema:"public",table:"tournaments",filter:"id=eq."+id},()=>refreshTournamentDetail(true)).subscribe()}catch(e){console.warn(e)}},
  stopTournamentWatch(){if(this.tournamentChannel&&this.client){try{this.client.removeChannel(this.tournamentChannel)}catch(_){}this.tournamentChannel=null}}
};
