/* Admin LAB adapters. The simulator is NOT proof of database RLS. */
(() => {
  const copy = value => structuredClone(value);
  const failure = (message, code) => Object.assign(new Error(message), {code});
  const DB_KEY = 'pulse_echo_admin_safety_lab_db_v1';
  const AUTH_KEY = 'pulse_echo_admin_safety_auth_v1';
  const TEST_STATE = 'pulse_echo_admin_safety_test_v1';
  const localOnly = () => ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  function local(cfg) {
    if (!localOnly()) throw failure('模擬LABはMacのlocalhostでのみ動作します。','CONFIG');
    let user = null, mode = 'success'; const listeners = [], audit = [];
    const settings = () => {try{return JSON.parse(sessionStorage.getItem(TEST_STATE)||'{}')}catch{return {}}};
    const read = () => {const s=localStorage.getItem(DB_KEY);return s?JSON.parse(s):window.PULSE_ADMIN_LAB_FIXTURES.map((data,i)=>({id:data.id,data:copy(data),updated_at:`2026-11-03T00:00:00.00${i}Z`}))};
    const emit = () => listeners.forEach(fn=>fn(copy(user)));
    const authorized = () => {if(!user)throw failure('ログインが必要です。','AUTH');if(user.id!==cfg.mockAdminId)throw failure('このアカウントに管理権限はありません。','DENIED')};
    const delay = async () => new Promise(resolve=>setTimeout(resolve, settings().delay ?? 100));
    async function mutate(operation, candidate, expected) {
      const id = candidate.id; audit.push({operation,id}); authorized(); await delay();
      if(mode==='expired'){user=null;sessionStorage.removeItem(AUTH_KEY);emit();throw failure('セッションの有効期限が切れました。再ログインしてください。','AUTH')}
      authorized();
      if(mode==='save-error')throw failure('模擬保存拒否：共有データは変更していません。','DENIED');
      const rows=read(),index=rows.findIndex(r=>r.id===id);
      if(operation==='insert'&&index>=0)throw failure('同じ試合IDが既にあります。','CONFLICT');
      if(operation!=='insert'&&(index<0||rows[index].updated_at!==expected))throw failure('別の画面で更新されています。再読み込みして確認してください。','CONFLICT');
      if(operation==='delete')rows.splice(index,1);
      else {
        const stamp=new Date(Math.max(Date.now(),Date.parse(expected||'1970-01-01')+1)).toISOString();
        const row={id,data:copy(candidate),updated_at:stamp};if(operation==='insert')rows.push(row);else rows[index]=row;
      }
      localStorage.setItem(DB_KEY,JSON.stringify(rows));
      if(mode==='lost-response')throw failure('保存応答を受信できません。結果は未確認です。再読み込みしてください。','UNKNOWN');
      return copy(rows.find(r=>r.id===id)||null);
    }
    return {
      kind:'local',
      async init(){try{user=JSON.parse(sessionStorage.getItem(AUTH_KEY)||'null')}catch{}return copy(user)},
      async signIn(email,password){if(password!=='demo-only'||!['admin@lab.invalid','viewer@lab.invalid'].includes(email))throw failure('模擬ログイン情報を確認してください。','AUTH');user={id:email==='admin@lab.invalid'?cfg.mockAdminId:'00000000-0000-4000-8000-000000000002',email};sessionStorage.setItem(AUTH_KEY,JSON.stringify(user));emit();return copy(user)},
      async signOut(){user=null;sessionStorage.removeItem(AUTH_KEY);emit()},
      subscribe(fn){listeners.push(fn)},
      isAdmin(u){return !!u&&u.id===cfg.mockAdminId},
      async list(){audit.push({operation:'select'});authorized();await delay();authorized();if(mode==='load-error')throw failure('模擬読込失敗。保存操作は停止しています。','READ');return copy(read())},
      insert: m=>mutate('insert',m,null), update:(m,v)=>mutate('update',m,v), remove:(m,v)=>mutate('delete',m,v),
      diagnostics:{setMode(value){mode=value;const s=settings();s.mode=value;sessionStorage.setItem(TEST_STATE,JSON.stringify(s))},mode:()=>mode,rows:()=>copy(read()),audit:()=>copy(audit),reset(){localStorage.removeItem(DB_KEY)},expire(){user=null;sessionStorage.removeItem(AUTH_KEY);emit()}},
      restoreMode(){mode=settings().mode||'success'}
    };
  }
  async function supabase(cfg) {
    const url=new URL(cfg.supabaseUrl);
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!cfg.testProjectRef||url.protocol!=='https:'||url.hostname!==cfg.testProjectRef+'.supabase.co'||url.port||url.pathname!=='/'||url.search||url.hash||url.username||url.password||!uuid.test(cfg.adminUserId))throw failure('別Supabase検証プロジェクトの設定を確認してください。','CONFIG');
    if(url.hostname==='bxailsvrusrbjmbhlpqh.supabase.co')throw failure('本番Supabaseへの接続は禁止されています。','CONFIG');
    let role='';try{const body=cfg.publishableKey.split('.')[1];role=JSON.parse(atob(body.replace(/-/g,'+').replace(/_/g,'/'))).role}catch{}
    if(!cfg.publishableKey.startsWith('sb_publishable_')&&role!=='anon')throw failure('公開用キーだけを設定してください。秘密キーは使用できません。','CONFIG');
    if(!window.supabase)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=resolve;s.onerror=()=>reject(failure('検証用SDKを読み込めません。','CONFIG'));document.head.append(s)});
    const client=window.supabase.createClient(url.origin,cfg.publishableKey,{auth:{storage:sessionStorage,storageKey:AUTH_KEY,persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    const listeners=[];client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>listeners.forEach(fn=>fn(session?.user||null)),0)});
    async function check(){const {data,error}=await client.auth.getUser();if(error||!data.user)throw failure('認証を確認できません。再ログインしてください。','AUTH');if(data.user.id!==cfg.adminUserId)throw failure('管理者本人だけが操作できます。','DENIED');return data.user}
    async function result(query){const {data,error}=await query;if(error)throw failure('保存拒否または通信失敗（'+(error.code||'UNKNOWN')+'）。保存結果は再読み込みして確認してください。',error.code==='42501'?'DENIED':'UNKNOWN');if(!data?.length)throw failure('更新競合または権限拒否。再読み込みして確認してください。','CONFLICT');return data[0]}
    const table=()=>client.from('pulse_matches');
    return {
      kind:'supabase',
      async init(){const {data,error}=await client.auth.getSession();if(error)throw failure('認証状態を取得できません。','AUTH');return data.session?.user||null},
      async signIn(email,password){const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw failure('ログインできません。入力内容と検証用アカウントを確認してください。','AUTH');return data.user},
      async signOut(){const {error}=await client.auth.signOut({scope:'local'});if(error)throw failure('ログアウトに失敗しました。','AUTH')},
      subscribe(fn){listeners.push(fn)},isAdmin:u=>!!u&&u.id===cfg.adminUserId,
      async list(){await check();const {data,error}=await table().select('id,data,updated_at').order('id');if(error)throw failure('試合一覧を取得できません（'+(error.code||'UNKNOWN')+'）。','READ');return data||[]},
      async insert(m){await check();return result(table().insert({id:m.id,data:m}).select('id,data,updated_at'))},
      async update(m,v){await check();return result(table().update({data:m}).eq('id',m.id).eq('updated_at',v).select('id,data,updated_at'))},
      async remove(m,v){await check();await result(table().delete().eq('id',m.id).eq('updated_at',v).select('id'));return null}
    };
  }
  window.PULSE_ADMIN_BACKEND={async create(cfg){if(cfg.mode==='local')return local(cfg);if(cfg.mode==='supabase')return supabase(cfg);throw failure('LABの接続方式が未設定です。','CONFIG')}};
})();
