const UPSTREAM = 'https://qcrecblhumamiqqyiccw.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_uX2k4cNAjusr6MuM1gForw_Yo03bSS9';
export const config = { api: { bodyParser: false } };

function setCors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, prefer, range, if-none-match');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
}
async function readBody(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks)}
function clientOrigin(req){const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0].trim();const host=String(req.headers['x-forwarded-host']||req.headers.host||'').split(',')[0].trim();return `${proto}://${host}`}
export default async function handler(req,res){
  setCors(res);
  if(String(req.method||'GET').toUpperCase()==='OPTIONS')return res.status(204).end();
  try{
    const rawPath=Array.isArray(req.query.path)?req.query.path.join('/'):String(req.query.path||'');
    if(!rawPath)return res.status(400).json({error:'MISSING_PROXY_PATH'});
    const upstream=new URL('/'+rawPath.replace(/^\/+/,''),UPSTREAM);
    for(const [key,value] of Object.entries(req.query||{})){
      if(key==='path')continue;
      if(Array.isArray(value))for(const v of value)upstream.searchParams.append(key,String(v));
      else if(value!==undefined)upstream.searchParams.append(key,String(value));
    }
    const headers=new Headers();headers.set('apikey',PUBLISHABLE_KEY);
    for(const name of ['authorization','content-type','accept','prefer','range','if-none-match','x-client-info']){const value=req.headers[name];if(value)headers.set(name,Array.isArray(value)?value[0]:String(value))}
    const method=String(req.method||'GET').toUpperCase();
    const body=(method==='GET'||method==='HEAD')?undefined:await readBody(req);
    const upstreamRes=await fetch(upstream,{method,headers,body,redirect:'manual'});
    const type=upstreamRes.headers.get('content-type')||'application/octet-stream';
    for(const h of ['cache-control','etag','content-range','accept-ranges']){const v=upstreamRes.headers.get(h);if(v)res.setHeader(h,v)}
    res.setHeader('content-type',type);res.setHeader('x-mko-gateway','vercel');
    const bytes=Buffer.from(await upstreamRes.arrayBuffer());
    if(/json|text|javascript|xml/i.test(type)){
      const own=clientOrigin(req)+'/api/supabase';
      const text=bytes.toString('utf8').split(UPSTREAM).join(own);
      return res.status(upstreamRes.status).send(text);
    }
    return res.status(upstreamRes.status).send(bytes);
  }catch(error){console.error('MKO proxy error',error);return res.status(502).json({error:'GATEWAY_FETCH_FAILED',message:String(error?.message||error)})}
}
