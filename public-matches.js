/* Public response boundary: no storage, static fallback, tokens, or internal fields. */
(()=>{
 const fields=new Set(['id','date','competition','round','home','away','homeScore','awayScore','firstHalfVideo','secondHalfVideo','highlightVideo','published']);
 const video=/^[A-Za-z0-9_-]{11}$/;
 function normalize(row){
  if(!row||Array.isArray(row)||typeof row!=='object'||Object.keys(row).some(k=>!fields.has(k))||row.published!==true||typeof row.id!=='string'||!row.id||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!['home','away'].every(k=>typeof row[k]==='string'&&row[k].length>0))throw Error('PUBLIC_RESPONSE_REJECTED');
  const result={};
  for(const key of fields){const value=row[key];
   if(key.endsWith('Video')){if(value!=null&&value!==''&&!video.test(value))throw Error('PUBLIC_VIDEO_REJECTED');result[key]=value||'';}
   else if(key.endsWith('Score')){if(value!=null&&(!Number.isInteger(value)||value<0||value>999))throw Error('PUBLIC_SCORE_REJECTED');result[key]=value??null;}
   else if(key==='competition'||key==='round'){if(value!=null&&typeof value!=='string')throw Error('PUBLIC_TEXT_REJECTED');result[key]=value||'';}
   else result[key]=value;
  }return Object.freeze(result);
 }
 async function load(requestedId=null){
  const config=window.PULSE_CONFIG||{},base=config.publicApiUrl||config.supabaseUrl,key=config.publicApiKey||config.supabaseAnonKey;
  const rpc=config.publicMatchesRpc||'pulse_public_matches_v1';
  if(!['public_privacy_matches','privacy_cutover_public_matches_v1','pulse_public_matches_v1'].includes(rpc))throw Error('PUBLIC_RPC_REJECTED');
  if(!base||!key)throw Error('PUBLIC_CONFIG_UNAVAILABLE');
  const url=new URL(base+'/rest/v1/rpc/'+rpc);
  if(requestedId!==null)url.searchParams.set('requested_id',requestedId);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url,{method:'GET',headers:{apikey:key,Accept:'application/json'},cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
   if(!response.ok)throw Error('PUBLIC_READ_FAILED');
   const rows=await response.json();if(!Array.isArray(rows))throw Error('PUBLIC_RESPONSE_REJECTED');
   const normalized=rows.map(normalize);
   if(new Set(normalized.map(r=>r.id)).size!==normalized.length||requestedId!==null&&normalized.some(r=>r.id!==requestedId))throw Error('PUBLIC_RESPONSE_REJECTED');
   return normalized;
  }finally{clearTimeout(timer)}
 }
 window.PULSE_PUBLIC_MATCHES=Object.freeze({load,normalize});
})();
