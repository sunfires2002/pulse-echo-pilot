/* Public RPC screen release: all unrelated files remain byte-identical. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),BASE='dcca8e78d25537f1c8107f51ce88a4914a6f6fb2';
const removed='pulse-echo-workflow-backup.json';
const show=file=>execFileSync('git',['show',BASE+':'+file],{cwd:root,maxBuffer:4*1024*1024});
const before=execFileSync('git',['ls-tree','-r','--name-only',BASE],{cwd:root}).toString().trim().split('\n');
for(const file of before){
 if(file===removed||file==='tests/release-scope.cjs'||file==='tests/realtime.cjs'||file==='index.html'||file==='match.html')continue;
 assert(fs.readFileSync(path.join(root,file)).equals(show(file)),file+' differs from approved main');
}
assert(!fs.existsSync(path.join(root,removed)),'public backup must not exist');
assert.deepEqual(require('../tools/check-public-backups.cjs').inspectRoot(root),[]);
console.log('PASS release scope: unrelated runtime/assets/data/config/schema unchanged; public backup absent');
