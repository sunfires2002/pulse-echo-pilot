/* TV toolbar and REACT LAB: all unrelated files remain byte-identical. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),BASE='db2004f8ccad8b1728dc3429b3394a7488d1271f';
const removed='pulse-echo-workflow-backup.json';
const show=file=>execFileSync('git',['show',BASE+':'+file],{cwd:root,maxBuffer:4*1024*1024});
const before=execFileSync('git',['ls-tree','-r','--name-only',BASE],{cwd:root}).toString().trim().split('\n');
for(const file of before){
 if(['tests/release-scope.cjs','tests/tv-seconds-axis.cjs','match.html','pc-desktop.js','tv-view.js','tv-view.css'].includes(file))continue;
 assert(fs.readFileSync(path.join(root,file)).equals(show(file)),file+' differs from approved main');
}
assert(!fs.existsSync(path.join(root,removed)),'public backup must not exist');
assert.deepEqual(require('../tools/check-public-backups.cjs').inspectRoot(root),[]);
console.log('PASS release scope: unrelated runtime/assets/data/config/schema unchanged; public backup absent');
