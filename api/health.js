const UPSTREAM='https://qcrecblhumamiqqyiccw.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_uX2k4cNAjusr6MuM1gForw_Yo03bSS9';
export default async function handler(req,res){res.setHeader('Access-Control-Allow-Origin','*');try{const r=await fetch(UPSTREAM+'/auth/v1/settings',{headers:{apikey:PUBLISHABLE_KEY}});res.status(r.ok?200:502).json({ok:r.ok,gateway:'vercel',supabase_status:r.status,time:new Date().toISOString()})}catch(e){res.status(502).json({ok:false,gateway:'vercel',error:String(e?.message||e)})}}
