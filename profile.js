/* Shared browser-scoped posting identity and display name. */
(() => {
 const NAME_KEY='pulse_echo_user_name';
 const LEGACY_NAME_KEY='pulse_echo_tv_name';
 const SENDER_KEY='pulse_echo_sender_id';
 let sender='',name='',initialized=false;
 const read=key=>{try{return localStorage.getItem(key)}catch{return null}};
 const write=(key,value)=>{try{localStorage.setItem(key,value);return true}catch{return false}};
 function randomId(){
  try{if(crypto?.randomUUID)return 'p_'+crypto.randomUUID()}catch{}
  try{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return 'p_'+Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}catch{}
  return 'p_'+Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('');
 }
 function guest(){return 'ゲスト-'+(sender.replace(/^p_/,'').replace(/[^a-z0-9]/gi,'').slice(0,4)||'0000').toUpperCase()}
 function updateField(){const field=document.getElementById('userName');if(field)field.value=name}
 function setName(value){
  const cleaned=String(value??'').trim();if(!cleaned)return false;
  name=cleaned;write(NAME_KEY,name);write(LEGACY_NAME_KEY,name);updateField();
  document.dispatchEvent(new CustomEvent('pulse-profile-name-changed',{detail:{name}}));return true;
 }
 function finish(value){
  setName(value||guest());
  const gate=document.getElementById('profileSetup');if(gate)gate.hidden=true;
 }
 function init(){
  if(initialized)return;initialized=true;
  const storedSender=read(SENDER_KEY);
  sender=storedSender&&/^p_[a-z0-9-]{8,}$/i.test(storedSender)?storedSender:randomId();
  if(!storedSender||sender!==storedSender)write(SENDER_KEY,sender);
  let storedName=read(NAME_KEY);
  if(!storedName){
   const legacy=read(LEGACY_NAME_KEY);
   if(legacy?.trim()){storedName=legacy.trim();write(NAME_KEY,storedName)}
  }
  name=storedName?.trim()||'';
  updateField();
  const field=document.getElementById('userName');
  field?.addEventListener('input',()=>{if(field.value.trim())setName(field.value)});
  field?.addEventListener('change',()=>{if(field.value.trim())setName(field.value);else updateField()});
  const gate=document.getElementById('profileSetup'),input=document.getElementById('profileNameInput');
  const save=document.getElementById('profileNameSave'),skip=document.getElementById('profileNameSkip'),status=document.getElementById('profileSetupStatus');
  save?.addEventListener('click',()=>{
   if(!input.value.trim()){status.textContent='名前か背番号を入力してください。スキップするとゲスト名になります。';input.focus();return}
   finish(input.value);
  });
  skip?.addEventListener('click',()=>finish(guest()));
  input?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();save?.click()}});
  if(gate&&!name)gate.hidden=false;
 }
 function nameForPost(value){if(String(value??'').trim())setName(value);return name||guest()}
 window.PULSE_PROFILE=Object.freeze({nameKey:NAME_KEY,senderKey:SENDER_KEY,legacyNameKey:LEGACY_NAME_KEY,init,senderId:()=>sender,nameForPost,setName,getName:()=>name||guest(),guestName:guest});
})();
