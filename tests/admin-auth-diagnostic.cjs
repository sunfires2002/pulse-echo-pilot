/* Real TEST Auth diagnostic entry point: no match routes are imported or used. */
const fs=require('node:fs'),path=require('node:path');
const {diagnose}=require('../tools/admin_auth_diagnostic.cjs');
const names=['ADMIN_TEST_URL','ADMIN_TEST_KEY','ADMIN_TEST_ADMIN_ID','ADMIN_TEST_ADMIN_EMAIL',
 'ADMIN_TEST_ADMIN_PASSWORD','ADMIN_TEST_OTHER_EMAIL','ADMIN_TEST_OTHER_PASSWORD'];
(async()=>{
 if(names.some(k=>!process.env[k])){console.error('AUTH_DIAGNOSTIC_STOP: missing local TEST inputs; no values printed');process.exitCode=2;return}
 const [url,key,id,adminEmail,adminPassword,otherEmail,otherPassword]=names.map(k=>process.env[k]);
 const source=fs.readFileSync(path.join(__dirname,'../config.js'),'utf8');
 const productionHostname=new URL(source.match(/supabaseUrl:\s*"([^\"]+)"/)[1]).hostname;
 const report=await diagnose({config:{supabaseUrl:url,publishableKey:key,adminUserId:id,testProjectRef:new URL(url).hostname.split('.')[0]},
  accounts:[{role:'admin',email:adminEmail,password:adminPassword},{role:'non_admin',email:otherEmail,password:otherPassword}],productionHostname});
 for(const row of report.results){
  const role=row.role==='admin'?'管理者':'非管理者';
  console.log(role+' | HTTP '+(row.status??'未取得')+' | code='+row.code+' | category='+row.category+' | UUID確認='+row.roleCheck);
  if(row.retryAfterSeconds!==undefined)console.log('待機目安：'+row.retryAfterSeconds+'秒（自動再試行なし）');
  if(row.sessionCleanupStatus!==undefined)console.log(role+' | 今回の認証セッション終了 HTTP '+(row.sessionCleanupStatus??'未取得'));
 }
 console.log('AUTH診断のみで終了。試合の読取・登録・更新・削除要求は0件。');
 if(report.results.some(r=>r.category!=='authenticated'||r.roleCheck!=='matched'||![200,204].includes(r.sessionCleanupStatus)))process.exitCode=1;
})().catch(()=>{console.error('AUTH_DIAGNOSTIC_STOP: configuration or diagnostic failed; no response bodies or values printed');process.exitCode=2});
