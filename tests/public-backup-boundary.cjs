const {test}=require('node:test'),assert=require('node:assert/strict'),{inspectFile,inspectRoot}=require('../tools/check-public-backups.cjs');
const check=(name,value)=>inspectFile(name,Buffer.from(typeof value==='string'?value:JSON.stringify(value)));
test('original backup and alternate names rejected',()=>{
 for(const name of ['pulse-echo-workflow-backup.json','nested/BACKUP.JSON','matches.json.bak','matches.backup','private.pebackup','private.zip'])assert(check(name,{}));
});
test('renamed JSON with nested internal fields rejected',()=>{
 for(const value of [{workflow:{}},{matches:[{workflow:{}}]},{a:{filmerName:'test'}},{data:{sourceFirst:'test'}},{exportedAt:'sample',matches:[]}])assert(check('renamed.json',value));
});
test('malformed JSON rejected without echoing data',()=>{assert.equal(check('renamed.json','INVALID_PRIVATE_VALUE'),'INVALID_PUBLIC_JSON')});
test('legitimate public JSON and source-code references remain allowed',()=>{
 assert.equal(check('public-matches.json',[{id:'sample',published:true,home:'A',away:'B'}]),null);
 assert.equal(check('admin.html','function backupWorkflow(){}'),null);
});
test('actual public working tree passes',()=>assert.deepEqual(inspectRoot(require('node:path').resolve(__dirname,'..')),[]));
