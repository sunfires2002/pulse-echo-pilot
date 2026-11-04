/* Public-root safety gate. Prints filenames/reason codes only, never contents. */
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const PRIVATE_KEYS=new Set(['workflow','filmerName','filmerTeam','editorName','reviewerName','onSiteChecker','sourceFirst','sourceSecond','sourceFiles','internalMemo']);
function hasPrivateKeys(value){
 if(!value||typeof value!=='object')return false;
 if(Array.isArray(value))return value.some(hasPrivateKeys);
 return Object.keys(value).some(key=>PRIVATE_KEYS.has(key)||hasPrivateKeys(value[key]));
}
function inspectFile(relative,buffer){
 const name=path.basename(relative),lower=name.toLowerCase();
 if(/\.bak(?:\.|$)|\.backup(?:\.|$)/i.test(name)||/backup|back-up/i.test(name)&&! /\.(cjs|mjs|js|ts|py|yml|yaml|md|html|css|svg)$/i.test(name))return 'BACKUP_FILE_FORBIDDEN';
 if(/\.(zip|7z|tar|tgz|gz|bz2|xz|dmg|pebackup)$/i.test(name))return 'ARCHIVE_FORBIDDEN_IN_PUBLIC_ROOT';
 if(!lower.endsWith('.json'))return null;
 if(/workflow/i.test(name))return 'INTERNAL_JSON_NAME_FORBIDDEN';
 let value;try{value=JSON.parse(buffer.toString('utf8'))}catch{return 'INVALID_PUBLIC_JSON'}
 if(hasPrivateKeys(value))return 'INTERNAL_JSON_KEYS_FORBIDDEN';
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'exportedAt'in value&&'matches'in value)return 'BACKUP_ENVELOPE_FORBIDDEN';
 return null;
}
function inspectRoot(root){
 const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean),failures=[];
 for(const relative of new Set(names)){
  const file=path.join(root,relative);if(!fs.existsSync(file))continue;
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()){failures.push({file:relative,reason:'PUBLIC_SYMLINK_REJECTED'});continue}
  if(!stat.isFile())continue;
  const code=inspectFile(relative,fs.readFileSync(file));
  if(code)failures.push({file:relative,reason:code});
 }
 return failures;
}
module.exports={inspectFile,inspectRoot};
if(require.main===module){
 const failures=inspectRoot(path.resolve(__dirname,'..'));
 if(failures.length){console.error(JSON.stringify({passed:false,failures}));process.exitCode=1}
 else console.log('PASS public backup boundary: no backup/archive/internal JSON in public source');
}
