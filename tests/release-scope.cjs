/* TV toolbar, REACT and opt-in GOAL LAB: protected and unrelated main files remain byte-identical. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),BASE='db2004f8ccad8b1728dc3429b3394a7488d1271f';
const removed='pulse-echo-workflow-backup.json';
const show=file=>execFileSync('git',['show',BASE+':'+file],{cwd:root,maxBuffer:4*1024*1024});
const before=execFileSync('git',['ls-tree','-r','--name-only',BASE],{cwd:root}).toString().trim().split('\n');
const allowed=['tests/release-scope.cjs','tests/tv-seconds-axis.cjs','match.html','pc-desktop.js','tv-view.js','tv-view.css'];
for(const file of before){
 if(allowed.includes(file))continue;
 assert(fs.readFileSync(path.join(root,file)).equals(show(file)),file+' differs from approved GitHub main');
}
const baselineMatch=show('match.html').toString();
const currentMatch=fs.readFileSync(path.join(root,'match.html'),'utf8').replace('pc-desktop.js?v=1.2.26','pc-desktop.js?v=1.2.10');
assert.equal(currentMatch,baselineMatch,'match.html contains changes beyond the TV asset cache version');
const loader=fs.readFileSync(path.join(root,'pc-desktop.js'),'utf8');
assert(loader.includes("params.get('mode')==='tv'&&params.get('goalLab')==='1'"),'GOAL gate must require TV mode and goalLab=1');
assert(loader.includes('if(goalLab)await loadTvGoals()'),'GOAL module must only load behind the explicit gate');
for(const file of ['prism-goals-core.js','tv-goals.js','tv-goals.css','fixtures/tv-goals/tv-goal-a.json','fixtures/tv-goals/tv-goal-b.json'])assert(fs.existsSync(path.join(root,file)),file+' is required for the isolated GOAL preview');
assert(!fs.existsSync(path.join(root,removed)),'public backup must not exist');
assert.deepEqual(require('../tools/check-public-backups.cjs').inspectRoot(root),[]);
console.log('PASS release scope: db2004 public RPC, privacy, admin, schema, and backup protections preserved; GOAL is opt-in');
