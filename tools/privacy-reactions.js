/* LAB-only in-memory adapter injected by the allowlisted server, not a production asset. */
(()=>{
 const rows=[{id:'sample-reaction-1',video_id:'privacy-sample-a:前半',good_time:10,description:'🔥 ナイスプレー',user_name:'サンプル',comment:'サンプルの反応',sender_id:'sample'},{id:'sample-reaction-2',video_id:'privacy-sample-a:後半',good_time:5,description:'😫 惜しい',user_name:'サンプル',comment:'',sender_id:'sample'}];
 const client={from(){let filters=[],op='select',value;
  const query={select(){return query},eq(k,v){filters.push(r=>r[k]===v);return query},order(){return query},insert(v){op='insert';value=v;return query},delete(){op='delete';return query},then(resolve,reject){try{let result=rows.filter(r=>filters.every(f=>f(r)));if(op==='insert'){const row={...value,id:'sample-local-'+crypto.randomUUID()};rows.push(row);result=[row]}if(op==='delete'){for(const row of result)rows.splice(rows.indexOf(row),1)}resolve({data:result.map(r=>({...r})),error:null})}catch(e){reject(e)}}};return query;},channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}};
 window.PULSE_REACTIONS_LAB=client;
})();
