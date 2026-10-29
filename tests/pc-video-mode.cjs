// Controller regressions: rapid mode changes, part changes, and non-PC isolation.
const vm=require('vm'),fs=require('fs'),assert=require('assert/strict');const source=fs.readFileSync(require('path').join(__dirname,'../pc-video-controls.js'),'utf8');
function boot(desktop=true){let tick,now=0,mode;const sandbox={window:{PULSE_PC_DESKTOP:desktop},location:{search:''},URLSearchParams,Date:{now:()=>now},setInterval:f=>{tick=f},document:{addEventListener:(name,f)=>{if(name==='pulse-view-mode')mode=f}}};vm.runInNewContext(source,sandbox);return{api:sandbox.window.PULSE_PC_VIDEO,mode:value=>mode({detail:{mode:value}}),tick:()=>{now+=250;tick()},sandbox}}
assert.equal(boot(false).api,undefined);
function fake(time=83){return{time,state:2,volume:37,muted:true,seekCalls:0,getVideoData(){return{video_id:'video-a'}},getCurrentTime(){return this.time},getPlayerState(){return this.state},getVolume(){return this.volume},isMuted(){return this.muted},setVolume(v){this.volume=v},mute(){this.muted=true},unMute(){this.muted=false},seekTo(t){this.time=t;this.seekCalls++},playVideo(){this.state=1},pauseVideo(){this.state=-1}}}
{
const env=boot(),api=env.api;let p=fake(),isReady=true,rebuilds=0;api.bind({getPlayer:()=>p,isReady:()=>isReady,recreate(){rebuilds++;isReady=false;p=fake(0);p.volume=100;p.muted=false;api.playerVars('video-a')}});assert.equal(api.playerVars('video-a').controls,0);
env.mode('tv');assert.equal(api.isRestoring(),true);env.mode('lab');assert.equal(rebuilds,2);isReady=true;api.onReady(p);env.tick();env.tick();env.tick();assert.equal(api.isRestoring(),false);assert.equal(p.time,83);assert.equal(p.volume,37);assert.equal(p.muted,true);assert.equal(p.state,-1);p.playVideo();assert.equal(p.time,83);
}
{
const env=boot(),api=env.api;let p=fake();api.bind({getPlayer:()=>p,isReady:()=>true,recreate(){api.playerVars('video-a')}});api.playerVars('video-a');env.mode('tv');api.videoChanging('video-b');p=fake(0);api.onReady(p);assert.equal(p.seekCalls,0);assert.equal(api.isRestoring(),false);
}
{
const env=boot(),api=env.api;let p=fake();p.state=1;api.onStateChange({target:p,data:1});p.state=3;api.bind({getPlayer:()=>p,isReady:()=>true,recreate(){p=fake(0);api.playerVars('video-a')}});api.playerVars('video-a');env.mode('tv');api.onReady(p);env.tick();env.tick();env.tick();assert.equal(p.state,1);assert.equal(p.time,83);assert.equal(api.isRestoring(),false);
}
console.log('PASS: non-PC isolation, rapid switches, stopped resume, part changes, buffering playback intent');
