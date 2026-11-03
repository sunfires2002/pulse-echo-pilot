/* Entry point. Requires explicit launcher confirmation, TEST-only publishable config. */
const fs=require('node:fs'),path=require('node:path');
const {runRls}=require('../tools/admin_rls_test.cjs');
(async()=>{
 if(process.env.ADMIN_MATCH_WRITES_APPROVED!=='TEST_MATCH_CRUD')throw Error('Explicit TEST match-operation confirmation is required. Use the interactive launcher --run.');
 const productionHostname=new URL(fs.readFileSync(path.join(__dirname,'../config.js'),'utf8').match(/supabaseUrl:\s*"([^\"]+)"/)[1]).hostname;
 const config={supabaseUrl:process.env.ADMIN_TEST_URL,testProjectRef:process.env.ADMIN_TEST_REF,publishableKey:process.env.ADMIN_TEST_KEY,adminUserId:process.env.ADMIN_TEST_ADMIN_ID};
 const accounts=[{email:process.env.ADMIN_TEST_ADMIN_EMAIL,password:process.env.ADMIN_TEST_ADMIN_PASSWORD},{email:process.env.ADMIN_TEST_OTHER_EMAIL,password:process.env.ADMIN_TEST_OTHER_PASSWORD}];
 const result=await runRls({config,accounts,productionHostname,approved:process.env.ADMIN_MATCH_WRITES_APPROVED});
 console.log(JSON.stringify(result,null,2));process.exitCode=result.passed?0:1;
})().catch(()=>{console.error('RLS test stopped before execution: confirm pinned TEST configuration and explicit approval. No values logged.');process.exitCode=2});
