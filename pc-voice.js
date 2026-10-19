/* Desktop-only recognition lifecycle. Storage and Realtime remain in addEvent(). */
(() => {
 function isTarget(){
  const ua=navigator.userAgent;
  return !(/Android|iPhone|iPad|iPod|Silk|Fire TV|AFT/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>0)||navigator.userAgentData?.mobile===true)
   &&/Windows NT|Macintosh|X11|CrOS|Linux/.test(ua)&&matchMedia('(any-pointer: fine)').matches&&matchMedia('(any-hover: hover)').matches;
 }
 function install({button,dictionary,addEvent,nowTime}){
  if(!button)return;
  const debug=(type,data)=>window.PULSE_VOICE_DEBUG?.record(type,data);
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let requested=false,run=null,timer=null,session=0,retries=0,wake=null,wakeEpoch=0;
  const maxRetries=3;
  function ui(state,reason=''){
   button.disabled=state==='stopping';button.dataset.voiceState=state;
   button.style.background=requested?'linear-gradient(135deg, #ef4444, #dc2626)':'linear-gradient(135deg, #10b981, #059669)';button.style.color='#ffffff';
   button.textContent=state==='starting'?'🛑 音声認識を準備中（押すと停止）':state==='listening'?'🛑 音声入力中（画面を見ずに叫んでOK！）':state==='waiting'?'🛑 音声認識を再開待ち（押すと停止）':state==='stopping'?'🎙️ 音声入力を停止中…':reason?'🎙️ 音声入力停止：'+reason+'（押すと再開）':'🎙️ 音声入力をスタート（動画再生して叫ぶだけ！）';
  }
  function cancelRestart(){if(timer!==null)clearTimeout(timer);timer=null}
  function releaseWake(){wakeEpoch++;const old=wake;wake=null;if(old)Promise.resolve(old.release()).catch(()=>{})}
  function requestWake(){const epoch=++wakeEpoch;if(!navigator.wakeLock)return;Promise.resolve().then(()=>navigator.wakeLock.request('screen')).then(lock=>{if(!requested||epoch!==wakeEpoch){Promise.resolve(lock.release()).catch(()=>{});return}if(wake&&wake!==lock)Promise.resolve(wake.release()).catch(()=>{});wake=lock}).catch(()=>debug('wake-lock-unavailable'))}
  function clearRunTimers(r){clearTimeout(r.readyTimer);clearTimeout(r.endTimer)}
  function forceIdle(r,reason){
   if(run!==r)return;requested=false;cancelRestart();clearRunTimers(r);run=null;releaseWake();ui('idle',reason);
   try{r.recognition.abort()}catch{}
  }
  function scheduleRestart(){
   if(!requested||timer!==null||run)return;
   if(retries>=maxRetries){requested=false;releaseWake();ui('idle','再開上限に到達');debug('restart-limit',{attempt:retries});return}
   retries++;ui('waiting');debug('restart-scheduled',{attempt:retries,durationMs:300});
   timer=setTimeout(()=>{timer=null;if(requested&&!run){debug('restart-executed',{attempt:retries});begin('automatic')}},300);
  }
  function accept(rawText,r,index){
   let commentText=rawText;
   if(commentText.includes('欲しい'))commentText=commentText.replace(/欲しい/g,'惜しい');
   if(commentText.includes('カウント'))commentText=commentText.replace(/カウント/g,'カウンター');
   let kind='🤖 AIにお任せ';
   if(dictionary.hot.some(w=>commentText.includes(w)))kind='🔥 ナイスプレー';
   else if(dictionary.miss.some(w=>commentText.includes(w)))kind='😅 あちゃー';
   else if(dictionary.respect.some(w=>commentText.includes(w)))kind='😳 マジで';
   const videoTime=Math.max(0,nowTime()-1),received=performance.now();
   const identity={session:r.session,index};
   debug('echo-classified',{...identity,kind,videoTime});
   // Dispatch in result-index order, without delaying later results on a save response.
   void(async()=>{
    let started=performance.now(),saved=false;
    try{
     await addEvent(kind,commentText,videoTime,phase=>{
      if(phase==='save-start')started=performance.now();
      if(phase==='save-success')saved=true;
      debug(phase,{...identity,durationMs:performance.now()-started});
     });
     if(saved)document.dispatchEvent(new Event('pulse-voice-echo-saved'));
     debug('processing-complete',{...identity,reason:saved?'saved':'save-not-confirmed',durationMs:performance.now()-received});
    }catch(error){debug('processing-error',{...identity,reason:saved?'after-save':'save-or-processing',error:error.name||'Error',durationMs:performance.now()-received})}
   })();
  }
  function begin(reason){
   if(!requested||run||timer!==null)return;
   if(!Recognition){requested=false;ui('idle','このブラウザは非対応');debug('start-failed',{error:'unsupported'});return}
   const r={session:++session,seen:new Set(),recognition:null,readyTimer:null,endTimer:null};
   run=r;ui('starting');debug('start-request',{session:r.session,reason,attempt:retries});
   try{
    const recognition=new Recognition();r.recognition=recognition;
    recognition.lang='ja-JP';recognition.continuous=true;recognition.interimResults=false;
    recognition.onstart=()=>{
     if(run!==r||!requested)return;
     clearTimeout(r.readyTimer);ui('listening');debug('start',{session:r.session,durationMs:performance.now()-r.started});requestWake();
    };
    recognition.onaudiostart=()=>{if(run===r&&requested)debug('audio-start',{session:r.session})};
    recognition.onaudioend=()=>{if(run===r)debug('audio-end',{session:r.session})};
    recognition.onresult=event=>{
     if(run!==r||(!requested&&!r.drainFinals)){debug('result-excluded',{session:r.session,reason:'inactive-session'});return}
     debug('result-notification',{session:r.session,resultIndex:event.resultIndex,resultCount:event.results.length});
     for(let index=Math.max(0,event.resultIndex||0);index<event.results.length;index++){
      const result=event.results[index];
      if(!result?.isFinal){debug('result-excluded',{session:r.session,index,reason:'interim'});continue}
      const rawText=String(result[0]?.transcript||'').trim();
      debug('result-final',{session:r.session,index,transcript:rawText});
      if(r.seen.has(index)){debug('result-excluded',{session:r.session,index,reason:'same-result'});continue}
      r.seen.add(index);
      if(!rawText){debug('result-excluded',{session:r.session,index,reason:'empty'});continue}
      retries=0;debug('result-accepted',{session:r.session,index});accept(rawText,r,index);
     }
    };
    recognition.onerror=event=>{
     if(run!==r)return;
     debug('error',{session:r.session,error:event.error});clearTimeout(r.readyTimer);
     const recoverable=['no-speech','network','aborted'].includes(event.error);
     if(recoverable&&requested)ui('waiting');
     if(!recoverable){r.drainFinals=false;requested=false;cancelRestart();releaseWake();ui('stopping');r.stopReason=event.error||'認識エラー'}
     // Wait for end; never start another capture while the old session is alive.
     clearTimeout(r.endTimer);r.endTimer=setTimeout(()=>forceIdle(r,r.stopReason||'認識終了を確認できません'),2000);
    };
    recognition.onend=()=>{
     if(run!==r)return;debug('end',{session:r.session});clearRunTimers(r);run=null;
     if(requested)scheduleRestart();else{releaseWake();ui('idle',r.stopReason)}
    };
    r.started=performance.now();
    r.readyTimer=setTimeout(()=>{debug('start-timeout',{session:r.session});forceIdle(r,'認識開始を確認できません')},12000);
    recognition.start();
   }catch(error){
    debug('start-failed',{session:r.session,error:error.name||'Error'});forceIdle(r,'認識開始に失敗しました');
   }
  }
  function stop(){
   requested=false;cancelRestart();releaseWake();debug('stop-request',{session:run?.session});
   if(!run){ui('idle');return}
   const r=run;r.drainFinals=true;clearRunTimers(r);ui('stopping');
   // stop() may deliver a final result for audio already captured; drain until end.
   r.endTimer=setTimeout(()=>forceIdle(r,'停止を完了しました'),2000);
   try{r.recognition.stop()}catch(error){debug('stop-failed',{session:r.session,error:error.name||'Error'});forceIdle(r,'停止を完了しました')}
  }
  button.onclick=()=>{if(button.disabled)return;if(requested)stop();else{retries=0;requested=true;begin('user')}};
  // All-panels-hidden and presentation mode changes deliberately do not stop capture.
  ui('idle');
 }
 window.PULSE_PC_VOICE=Object.freeze({isTarget,install});
})();
