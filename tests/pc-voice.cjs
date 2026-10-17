const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..');
const dictionary={hot:['ナイス','よっしゃ','シュート','ゴール','入った','決めた','いけー','イケー','ええぞ'],miss:['惜しい','おしい','あちゃー','なんでやねん','ファール','もったいない','あーっ'],respect:['マジで','マジか','すごい','スゴい','やばい','ヤバい','神']};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function make({ua='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',touch=0,prefixed=false}={}){
 const recognizers=[],calls=[],timers=new Map();let time=0,seq=0,failStart=false,failSave=false;
 const button={style:{},dataset:{},disabled:false,textContent:''};
 function Recognition(){recognizers.push(this);this.start=()=>{this.startCalls=(this.startCalls||0)+1;if(failStart){failStart=false;const e=new Error('synthetic');e.name='InvalidStateError';throw e}};this.stop=()=>{this.stopCalls=(this.stopCalls||0)+1};this.abort=()=>{this.abortCalls=(this.abortCalls||0)+1}}
 const box={window:{[prefixed?'webkitSpeechRecognition':'SpeechRecognition']:Recognition},navigator:{userAgent:ua,maxTouchPoints:touch},matchMedia:()=>({matches:true}),performance:{now:()=>time},Date,Promise,console,
 setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:time+ms});return id},clearTimeout:id=>timers.delete(id)};
 vm.createContext(box);for(const name of ['pc-voice-diagnostics.js','pc-voice.js'])vm.runInContext(fs.readFileSync(root+'/'+name,'utf8'),box);
 box.window.PULSE_PC_VOICE.install({button,dictionary,nowTime:()=>100,addEvent:async(kind,text,videoTime,audit)=>{audit('save-start');calls.push({kind,text,videoTime});await Promise.resolve();audit(failSave?'save-failure':'save-success');failSave=false}});
 function advance(ms){const until=time+ms;for(;;){const next=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);time=next[1].at;next[1].fn()}time=until}
 function emit(r,texts,index=0,final=true){r.onresult({resultIndex:index,results:texts.map(text=>Object.assign([{transcript:text}],{isFinal:final}))})}
 return{box,button,recognizers,calls,advance,emit,debug:box.window.PULSE_VOICE_DEBUG,start(){button.onclick();const r=recognizers.at(-1);r.onstart();return r},failStart(){failStart=true},failSave(){failSave=true}};
}
(async()=>{
 let t=make(),r=t.start();t.emit(r,['ナイス']);t.emit(r,['ナイス','ナイス'],1);t.emit(r,['ナイス','ナイス'],1);await flush();assert.equal(t.calls.length,2);assert.equal(t.calls[0].videoTime,99);assert.equal(t.debug.read().length,0);console.log('PASS distinct same-word finals; repeated notification ignored; diagnostics off');
 t=make();r=t.start();t.debug.enable();t.emit(r,['ナイス','マジで']);await flush();assert.deepEqual(t.calls.map(c=>c.kind),['🔥 ナイスプレー','😳 マジで']);assert(!JSON.stringify(t.debug.read()).includes('transcript'));t.debug.enable({includeText:true});t.emit(r,['ナイス','マジで','よっしゃ'],2);await flush();assert(t.debug.read().some(e=>e.transcript==='よっしゃ'));t.debug.disable();assert.equal(t.debug.read().length,0);console.log('PASS all new finals in order; explicit transcript opt-in and clear on disable');
 t=make();r=t.start();t.emit(r,['ナイス']);t.button.onclick();t.emit(r,['ナイス','マジで'],1);r.onend();const next=t.start();t.emit(r,['古い結果']);t.emit(next,['ナイス']);await flush();assert.deepEqual(t.calls.map(c=>c.text),['ナイス','マジで','ナイス']);console.log('PASS stop drains captured finals; resume accepts same word; late ended-session results ignored');
 t=make();r=t.start();r.onend();r.onend();t.advance(299);assert.equal(t.recognizers.length,1);t.advance(1);assert.equal(t.recognizers.length,2);const automatic=t.recognizers.at(-1);automatic.onstart();t.emit(automatic,['ナイス']);await flush();assert.equal(t.calls.length,1);console.log('PASS one restart timer, 300ms, new-session result index zero');
 t=make();r=t.start();r.onend();t.button.onclick();t.advance(20000);assert.equal(t.recognizers.length,1);assert.equal(t.button.dataset.voiceState,'idle');console.log('PASS OFF cancels pending automatic restart');
 t=make();t.failStart();t.button.onclick();assert.equal(t.button.dataset.voiceState,'idle');t.advance(20000);assert.equal(t.recognizers.length,1);r=t.start();r.onerror({error:'not-allowed'});r.onend();t.advance(20000);assert.equal(t.recognizers.length,2);assert.equal(t.button.dataset.voiceState,'idle');console.log('PASS start exception and permission error return to stopped state');
 t=make();r=t.start();for(let n=0;n<4;n++){r.onerror({error:'network'});r.onend();t.advance(300);r=t.recognizers.at(-1);if(n<3)r.onstart()}assert.equal(t.recognizers.length,4);assert.equal(t.button.dataset.voiceState,'idle');console.log('PASS retryable errors bounded to three consecutive restarts');
 t=make();t.button.onclick();t.advance(12000);assert.equal(t.button.dataset.voiceState,'idle');assert.equal(t.recognizers.length,1);t=make();r=t.start();r.onerror({error:'audio-capture'});t.advance(2000);assert.equal(t.button.dataset.voiceState,'idle');assert.equal(t.recognizers.length,1);console.log('PASS start/no-end timeouts stop safely, without unlimited retry');
 t=make();r=t.start();t.failSave();t.emit(r,['ナイス']);await flush();t.emit(r,['ナイス','ナイス'],1);await flush();assert.equal(t.calls.length,2);console.log('PASS failed save does not suppress a separate same-word result');
 t=make({prefixed:true});r=t.start();assert.equal(r.lang,'ja-JP');assert.equal(r.continuous,true);assert.equal(r.interimResults,false);t.emit(r,['欲しい']);await flush();assert.equal(t.calls[0].kind,'😅 あちゃー');assert.equal(t.calls[0].text,'惜しい');console.log('PASS prefixed API, Japanese, final-only, legacy dictionary/classification');
 for(const options of [{ua:'Android Chrome'},{ua:'iPhone Safari'},{ua:'Macintosh',touch:5},{ua:'Android AFTKA Silk'}]){t=make(options);assert.equal(t.box.window.PULSE_PC_VOICE.isTarget(),false)}console.log('PASS phone/tablet/FireTV excluded from desktop controller');
 // Exercise actual shared save function with an in-memory Supabase double only.
 const html=fs.readFileSync(root+'/match.html','utf8'),start=html.indexOf('async function addEvent('),end=html.indexOf('async function deleteEvent(',start),source=html.slice(start,end);
 for(const outcome of ['success','error','throw']){
  const seen=[],reports=[];
  const supa={from(){return {insert(e){seen.push(e);return {select:async()=>{
   if(outcome==='throw')throw new Error('synthetic');
   return outcome==='error'?{error:{message:'synthetic'}}:{data:[{id:1}]};
  }}}}}};
  const env={document:{getElementById:()=>({value:'テスト'})},nowTime:()=>42,recentManualEchoes:[],pendingRealtimeInserts:0,ownRealtimeIds:new Set(),flushRealtimeBuffer(){},fly(){},echoText(){},loadEvents:async()=>{},reactionTable:()=> 'in-memory-only',match:{id:'test'},currentPart:'前半',alert(){},supa};
  vm.createContext(env);vm.runInContext(source,env);try{await env.addEvent('🔥 ナイスプレー','ナイス',41,p=>reports.push(p))}catch{}
  assert.equal(seen.length,1);assert.deepEqual(Object.keys(seen[0]).sort(),['good_time','description','user_name','comment','video_id'].sort());assert.equal(seen[0].video_id,'test:前半');assert.deepEqual(reports,['save-start',outcome==='success'?'save-success':'save-failure']);assert.equal(env.pendingRealtimeInserts,0);
 }
 console.log('PASS actual addEvent diagnostics, original record shape and Realtime counter on success/error/throw');
 const before=require('child_process').execFileSync('git',['show','47b8f14:match.html'],{cwd:root,encoding:'utf8'});
 const getSave=text=>text.slice(text.indexOf('async function addEvent('),text.indexOf('async function deleteEvent('));
 const stripped=getSave(html).replace(',voiceAudit=null','').replace('\n const report=type=>{try{voiceAudit?.(type)}catch{}};report("save-start");','').replace('report("save-failure");','').replace('catch(error){report("save-failure");throw error}','').replace('report("save-success");','');
 assert.equal(stripped,getSave(before));
 const oldVoice=before.slice(before.indexOf('let isVoiceActive'),before.indexOf('\ninitMatch();',before.indexOf('let isVoiceActive')));
 const legacy=html.slice(html.indexOf('let isVoiceActive'),html.indexOf('\n}\n\ninitMatch();',html.indexOf('let isVoiceActive')));
 const expected=oldVoice.replace(/const VOICE_DICTIONARY = \{[\s\S]*?\n\};/,'');
 assert.equal(legacy.trim(),expected.trim());
 console.log('PASS shared save body unchanged except diagnostic hooks; legacy non-PC controller unchanged');
 console.log('ALL PASS; no external requests, posts, microphone, or Supabase connection');
})().catch(e=>{console.error(e);process.exit(1)});
