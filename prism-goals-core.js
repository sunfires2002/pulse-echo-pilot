/* prism-goals/1: pure normalization and a shared, immutable in-page store. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PULSE_PRISM_GOALS=api})(globalThis,()=>{
 const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const text=x=>typeof x==='string'&&x.trim().length>0&&x.length<=256&&!x.includes('\0');
 const seconds=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 function freeze(x){if(object(x)||Array.isArray(x)){Object.values(x).forEach(freeze);Object.freeze(x)}return x}
 function normalize(input){
  if(!object(input)||input.format!=='prism-goals/1')throw Error('prism-goals/1 のJSONを選んでください。');
  if(!text(input.match_id)||!['1st','2nd'].includes(input.half)||typeof input.youtube_id!=='string'||!/^[-\w]{11}$/.test(input.youtube_id))throw Error('試合ID・前後半・YouTube IDを確認してください。');
  if(!['edit','quick'].includes(input.video)||!text(input.source))throw Error('video / source が不正です。');
  if(!Array.isArray(input.teams)||input.teams.length!==2||!input.teams.every(t=>object(t)&&text(t.name)))throw Error('teams は名前のある2チームが必要です。');
  for(const key of ['kickoff_sec','end_sec'])if(input[key]!==null&&!seconds(input[key]))throw Error(key+' は動画内の秒またはnullが必要です。');
  if(!Array.isArray(input.goals)||input.goals.length>1000)throw Error('goals は1000件以下の配列が必要です。');
  const issues=[],seen=new Set(),goals=[];
  input.goals.forEach((g,index)=>{
   const label=`GOAL ${index+1}`;
   if(!object(g)||!Number.isSafeInteger(g.no)||g.no<1||seen.has(g.no)||!seconds(g.sec)||![0,1].includes(g.team)||!Array.isArray(g.score)||g.score.length!==2||!g.score.every(n=>Number.isSafeInteger(n)&&n>=0)){issues.push(label+'：不正なデータを除外');return}
   seen.add(g.no);const goal={no:g.no,sec:g.sec,team:g.team,score:[...g.score]};
   if(g.scorer!==undefined){
    const s=g.scorer;
    if(object(s)&&s.og===true&&s.number===undefined&&s.name===undefined)goal.scorer={og:true};
    else if(object(s)&&s.og===undefined&&(s.number!==undefined||s.name!==undefined)&&(s.number===undefined||(typeof s.number==='string'&&/^\d{1,3}$/.test(s.number)))&&(s.name===undefined||text(s.name))){goal.scorer={};if(s.number!==undefined)goal.scorer.number=s.number;if(s.name!==undefined)goal.scorer.name=s.name.trim()}
    else issues.push(label+'：不正な得点者情報だけ省略');
   }
   goals.push(goal);
  });
  goals.sort((a,b)=>a.sec-b.sec||a.no-b.no);
  return freeze({record:{format:input.format,match_id:input.match_id,half:input.half,youtube_id:input.youtube_id,video:input.video,source:input.source,teams:input.teams.map(t=>({name:t.name.trim(),color:typeof t.color==='string'&&/^#[\da-f]{6}$/i.test(t.color)?t.color:'#f2c94c'})),kickoff_sec:input.kickoff_sec,end_sec:input.end_sec,goals},issues});
 }
 function createStore(){
  const records=new Map(),listeners=new Set();
  return Object.freeze({
   replace(input){const result=normalize(input);records.set(result.record.match_id+'\0'+result.record.half,result.record);listeners.forEach(fn=>fn());return result},
   select({matchId,half,youtubeId}){const record=records.get(matchId+'\0'+half);return record?.youtube_id===youtubeId?record:null},
   clear(){records.clear();listeners.forEach(fn=>fn())},
   subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  });
 }
 return Object.freeze({normalize,createStore});
});
