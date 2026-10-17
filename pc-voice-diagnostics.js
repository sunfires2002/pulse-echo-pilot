/* Development diagnostics: no persistence, no network, transcript logging opt-in. */
(() => {
 let enabled=false,includeText=false,records=[];
 const fields=new Set(['session','index','resultIndex','resultCount','reason','kind','videoTime','durationMs','error','attempt','phase','requested','state','final']);
 function record(type,detail={}){
  if(!enabled)return;
  const data={};for(const [key,value] of Object.entries(detail))if(fields.has(key)||(includeText&&key==='transcript'))data[key]=value;
  records.push({at:new Date().toISOString(),ms:performance.now(),type,...data});if(records.length>500)records.shift();
 }
 window.PULSE_VOICE_DEBUG=Object.freeze({
  enable(options={}){records=[];enabled=true;includeText=options.includeText===true;record('diagnostics-enabled');return {enabled,includeText}},
  disable(){enabled=false;includeText=false;records=[]},
  clear(){records=[]},read(){return records.map(row=>({...row}))},
  get enabled(){return enabled},get includeText(){return includeText},record
 });
})();
