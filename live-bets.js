(function(){
'use strict';
const path=(location.pathname.split('/').pop()||'').toLowerCase();
const gameMap={'slot.html':'Slot','aviator.html':'Aviator','color.html':'Color','dragon-tiger.html':'Dragon Tiger','seven-up-down.html':'7 Up Down','pappu.html':'Pappu','e-sabong.html':'E-Sabong'};
const game=gameMap[path]; if(!game)return;
let clientId=localStorage.getItem('jiowinAnonBetId');
if(!clientId){const bytes=new Uint8Array(12);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(bytes);else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);clientId='anon-'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem('jiowinAnonBetId',clientId);}
const style=document.createElement('style');
style.textContent=`
#liveBetBoard{position:fixed;z-index:9998;right:10px;bottom:12px;width:min(310px,calc(100vw - 20px));max-height:48vh;overflow:hidden;background:rgba(14,19,31,.98);color:#f7f8fc;border:1px solid #39445a;border-radius:13px;box-shadow:0 8px 28px #0007;font:12px/1.35 Arial,sans-serif;backdrop-filter:blur(8px)}
#liveBetBoard .lb-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px;background:linear-gradient(110deg,#202a3d,#172033);font-weight:800;letter-spacing:.35px}
#liveBetBoard .lb-live{color:#69e3a3;white-space:nowrap}#liveBetBoard .lb-total{padding:7px 10px;color:#e8c879;border-bottom:1px solid #303a4e;font-weight:700}
#liveBetBoard .lb-section{padding:7px 10px;background:#182235;color:#d8e3f7;font-weight:800;font-size:10px;letter-spacing:.35px;display:flex;justify-content:space-between;gap:8px}
#liveBetBoard .lb-tag{padding:2px 5px;border-radius:5px;background:#39445a;color:#dce7fa;font-size:9px;white-space:nowrap}
#liveBetBoard .lb-list{overflow:auto;max-height:calc(48vh - 128px)}
#liveBetBoard .lb-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid #263044;min-height:28px;box-sizing:border-box}
#liveBetBoard .lb-row.lb-new{animation:lbPulse 850ms ease-out}#liveBetBoard .lb-row span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
#liveBetBoard .lb-row b{white-space:nowrap;color:#8ff0b8}#liveBetBoard .lb-empty{padding:10px;color:#b8c1d1}#liveBetBoard .lb-kind{display:inline-block;margin-left:5px;padding:1px 4px;border-radius:4px;font-size:8px;font-weight:800;vertical-align:middle;letter-spacing:.2px}
#liveBetBoard .lb-note{font-size:10px;line-height:1.4;color:#aab6ca;padding:7px 10px;border-top:1px solid #303a4e}
@keyframes lbPulse{0%{background:#3a4c3f}100%{background:transparent}}
@media(max-width:600px){#liveBetBoard{right:7px;bottom:7px;width:min(285px,calc(100vw - 14px));max-height:42vh}#liveBetBoard .lb-list{max-height:calc(42vh - 128px)}}
@media(prefers-reduced-motion:reduce){#liveBetBoard .lb-row.lb-new{animation:none}}
`;

style.textContent += `
/* Reference-style in-table live players/chips for 7 Up Down */
#liveBetBoard.lb-inline-mode{display:none!important}
#sudLivePlayers{display:flex;gap:5px;overflow-x:auto;padding:7px 3px;margin:0 0 8px;position:relative;z-index:2;scrollbar-width:none}
#sudLivePlayers .sud-live-player{flex:0 0 45px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#f3f5fa;font:9px Arial,sans-serif;animation:sudPlayerIn .35s ease-out}
#sudLivePlayers .sud-live-avatar{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#344f71,#15243c);border:2px solid #e6c66e;box-shadow:0 2px 8px #0008;font-size:15px}
#sudLivePlayers .sud-live-name{max-width:45px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sudLivePlayers .sud-live-amount{color:#f8d879;font-weight:800;white-space:nowrap}
.sud-bet-btn .sud-live-chip-stack{position:absolute;left:4px;right:4px;bottom:5px;display:flex;justify-content:center;align-items:center;gap:3px;flex-wrap:wrap;pointer-events:none;z-index:4}
.sud-live-chip{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;border:2px dashed #fff3;outline:1px solid #f6d36e;background:radial-gradient(circle at 35% 28%,#fff5b4,#e4a72e 52%,#8b4a08);color:#301c05;font:bold 8px Arial;box-shadow:0 2px 4px #0009;animation:sudChipDrop .42s cubic-bezier(.2,.8,.2,1) both}
.sud-live-chip:nth-child(3n){background:radial-gradient(circle at 35% 28%,#e7fff5,#3acb9a 52%,#12604a);outline-color:#9af4d6;color:#052d22}
.sud-live-chip:nth-child(3n + 1){background:radial-gradient(circle at 35% 28%,#ffe5ed,#f05b7a 52%,#8d1832);outline-color:#ffc0d0;color:#3d0714}
@keyframes sudChipDrop{0%{transform:translateY(-18px) scale(.5);opacity:0}70%{transform:translateY(2px) scale(1.12);opacity:1}100%{transform:translateY(0) scale(1)}}
@keyframes sudPlayerIn{from{transform:translateX(12px);opacity:0}to{transform:translateX(0);opacity:1}}
@media(prefers-reduced-motion:reduce){.sud-live-chip,#sudLivePlayers .sud-live-player{animation:none}}
`;
style.textContent += `
#dtLivePlayers{display:flex;gap:5px;overflow-x:auto;padding:7px 3px;margin:0 0 8px;position:relative;z-index:2;scrollbar-width:none}
#dtLivePlayers .dt-live-player{flex:0 0 45px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#f3f5fa;font:9px Arial,sans-serif;animation:sudPlayerIn .35s ease-out}
#dtLivePlayers .dt-live-avatar{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#344f71,#15243c);border:2px solid #e6c66e;box-shadow:0 2px 8px #0008;font-size:15px}
#dtLivePlayers .dt-live-name{max-width:45px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#dtLivePlayers .dt-live-amount{color:#f8d879;font-weight:800;white-space:nowrap}
.dt-bet-btn,.dt-side-btn{position:relative;overflow:hidden}
.dt-bet-btn .dt-live-chip-stack,.dt-side-btn .dt-live-chip-stack{position:absolute;left:3px;right:3px;bottom:3px;display:flex;justify-content:center;align-items:center;gap:2px;flex-wrap:wrap;pointer-events:none;z-index:4}
.dt-live-chip{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;border:2px dashed #fff5;outline:1px solid #f6d36e;background:radial-gradient(circle at 35% 28%,#fff5b4,#e4a72e 52%,#8b4a08);color:#301c05;font:bold 7px Arial;box-shadow:0 2px 4px #0009;animation:sudChipDrop .42s cubic-bezier(.2,.8,.2,1) both}
.dt-live-chip:nth-child(3n){background:radial-gradient(circle at 35% 28%,#e7fff5,#3acb9a 52%,#12604a);outline-color:#9af4d6;color:#052d22}
.dt-live-chip:nth-child(3n + 1){background:radial-gradient(circle at 35% 28%,#ffe5ed,#f05b7a 52%,#8d1832);outline-color:#ffc0d0;color:#3d0714}
@media(max-width:600px){#dtLivePlayers .dt-live-player{flex-basis:42px}.dt-live-chip{width:19px;height:19px;font-size:6px}}
@media(prefers-reduced-motion:reduce){.dt-live-chip,#dtLivePlayers .dt-live-player{animation:none}}
`;

style.textContent += `
/* Shared in-table live-bet treatment for every Jiowin game */
#jiowinLivePlayers{display:flex;gap:5px;overflow-x:auto;padding:7px 3px;margin:0 0 8px;position:relative;z-index:3;scrollbar-width:none;overscroll-behavior-x:contain}
#jiowinLivePlayers .jl-player{flex:0 0 45px;display:flex;flex-direction:column;align-items:center;gap:3px;color:#f3f5fa;font:9px Arial,sans-serif;animation:sudPlayerIn .35s ease-out}
#jiowinLivePlayers .jl-avatar{width:29px;height:29px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#344f71,#15243c);border:2px solid #e6c66e;box-shadow:0 2px 8px #0008;font-size:15px}
#jiowinLivePlayers .jl-name{max-width:45px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#jiowinLivePlayers .jl-amount{color:#f8d879;font-weight:800;white-space:nowrap}
.jiowin-live-target{position:relative!important;overflow:hidden!important}
.jiowin-live-chip-stack{position:absolute;left:3px;right:3px;bottom:3px;display:flex;justify-content:center;align-items:center;gap:2px;flex-wrap:wrap;pointer-events:none;z-index:8}
.jiowin-live-chip{width:21px;height:21px;border-radius:50%;display:grid;place-items:center;box-sizing:border-box;border:2px dashed #fff5;outline:1px solid #f6d36e;background:radial-gradient(circle at 35% 28%,#fff5b4,#e4a72e 52%,#8b4a08);color:#301c05;font:bold 7px Arial;box-shadow:0 2px 4px #0009;animation:sudChipDrop .42s cubic-bezier(.2,.8,.2,1) both}
.jiowin-live-chip:nth-child(3n){background:radial-gradient(circle at 35% 28%,#e7fff5,#3acb9a 52%,#12604a);outline-color:#9af4d6;color:#052d22}
.jiowin-live-chip:nth-child(3n + 1){background:radial-gradient(circle at 35% 28%,#ffe5ed,#f05b7a 52%,#8d1832);outline-color:#ffc0d0;color:#3d0714}
@media(max-width:600px){#jiowinLivePlayers .jl-player{flex-basis:42px}.jiowin-live-chip{width:19px;height:19px;font-size:6px}}
@media(prefers-reduced-motion:reduce){.jiowin-live-chip,#jiowinLivePlayers .jl-player{animation:none}}
`;
document.head.appendChild(style);
const board=document.createElement('section');board.id='liveBetBoard';
board.innerHTML='<div class="lb-head"><span>LIVE BET ACTIVITY</span><span class="lb-live">● UPDATING</span></div><div class="lb-total">Submitted bets total: ₹0</div><div class="lb-section"><span>RECENT SUBMISSIONS</span></div><div class="lb-list lb-combined-list"></div><div class="lb-note">Shows player-submitted activity; entries are not independently verified as paid wagers.</div>';
document.body.appendChild(board);
const inlineGame = ['7 Up Down','Dragon Tiger','Color','Pappu','E-Sabong','Slot','Aviator'].includes(game);
let inlinePlayers=null;
const playerAnchor={
 '7 Up Down':document.querySelector('#sudBetBoard'),
 'Dragon Tiger':document.querySelector('.dt-main-bets'),
 'Color':document.querySelector('.color-buttons'),
 'Pappu':document.querySelector('#pappuGrid'),
 'E-Sabong':document.querySelector('.esabong-main-bets'),
 'Slot':document.querySelector('.slot-controls'),
 'Aviator':document.querySelector('.aviator-controls')
}[game];
if(inlineGame && playerAnchor){
 board.classList.add('lb-inline-mode');
 inlinePlayers=document.createElement('div'); inlinePlayers.id='jiowinLivePlayers'; inlinePlayers.setAttribute('aria-label','Live player activity');
 playerAnchor.insertAdjacentElement('beforebegin',inlinePlayers);
}
function normalizeSelection(v){return String(v||'').toLowerCase().replace(/[^a-z0-9 -]/g,'').trim().replace(/\s+/g,' ');}
function targetForSelection(selection){
 const k=normalizeSelection(selection);
 const maps={
  '7 Up Down':{'down':'.sud-bet-btn.down','7 down':'.sud-bet-btn.down','2-6':'.sud-bet-btn.down','lucky':'.sud-bet-btn.lucky','7':'.sud-bet-btn.lucky','up':'.sud-bet-btn.up','7 up':'.sud-bet-btn.up','8-12':'.sud-bet-btn.up'},
  'Dragon Tiger':{'dragon':'.dt-bet-btn.dragon','tiger':'.dt-bet-btn.tiger','tie':'.dt-bet-btn.tie','dragon big':'.dt-side-bets .side-bet-row:nth-child(1) .dt-side-btn:nth-child(1)','dragon small':'.dt-side-bets .side-bet-row:nth-child(1) .dt-side-btn:nth-child(2)','tiger big':'.dt-side-bets .side-bet-row:nth-child(2) .dt-side-btn:nth-child(1)','tiger small':'.dt-side-bets .side-bet-row:nth-child(2) .dt-side-btn:nth-child(2)','suited tie':'.dt-side-btn.suited'},
  'Color':{'red':'.color-btn.red','green':'.color-btn.green','violet':'.color-btn.violet','big':'.bs-btn.big','small':'.bs-btn.small','num0':'.num-btn.n0','num1':'.num-btn.n1','num2':'.num-btn.n2','num3':'.num-btn.n3','num4':'.num-btn.n4','num5':'.num-btn.n5','num6':'.num-btn.n6','num7':'.num-btn.n7','num8':'.num-btn.n8','num9':'.num-btn.n9'},
  'E-Sabong':{'meron':'.esabong-bet-btn.meron','draw':'.esabong-bet-btn.draw','wala':'.esabong-bet-btn.wala'},
  'Slot':{'spin':'.spin-button','slot':'#spinBtn'},
  'Aviator':{'aviator':'.aviator-action-btn','cash out':'.aviator-action-btn','place bet':'.aviator-action-btn'},
  'Pappu':{}
 };
 if(game==='Pappu') return Array.from(document.querySelectorAll('.pappu-item')).find(el=>normalizeSelection(el.dataset.id)===k || normalizeSelection(el.querySelector('.pappu-name')?.textContent)===k);
 const selector=maps[game]?.[k]; return selector?document.querySelector(selector):null;
}
function stackForTarget(target){if(!target)return null;target.classList.add('jiowin-live-target');let stack=target.querySelector(':scope > .jiowin-live-chip-stack');if(!stack){stack=document.createElement('span');stack.className='jiowin-live-chip-stack';target.appendChild(stack);}return stack;}
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderSubmitted(bets=[]){
 const rows=bets.slice(0,50).map(b=>({name:b.player||'Guest',amount:Math.max(0,Number(b.amount)||0),selection:b.selection||'Bet',createdAt:Date.parse(b.createdAt)||0}));
 if(inlineGame && inlinePlayers){
  inlinePlayers.innerHTML=rows.slice(0,12).map((b,i)=>'<div class="jl-player" title="Player-submitted activity"><span class="jl-avatar">'+['👨🏻','👩🏽','🧑🏼','👨🏾','👩🏻','🧔🏻','👩🏾','🧑🏽'][i%8]+'</span><span class="jl-name">'+esc(b.name)+'</span><span class="jl-amount">₹'+b.amount.toLocaleString('en-IN')+'</span></div>').join('');
  document.querySelectorAll('.jiowin-live-chip-stack').forEach(el=>el.innerHTML='');
  const counts={}; rows.slice(0,36).forEach(b=>{const key=normalizeSelection(b.selection);counts[key]=(counts[key]||0)+1;if(counts[key]>5)return;const stack=stackForTarget(targetForSelection(b.selection));if(!stack)return;const chip=document.createElement('span');chip.className='jiowin-live-chip';chip.textContent=b.amount>=1000?(b.amount/1000)+'k':String(b.amount);chip.title='Submitted activity · '+b.name+' · ₹'+b.amount;stack.appendChild(chip);});
 }
 const list=board.querySelector('.lb-combined-list');
 list.innerHTML=rows.slice(0,100).map(b=>'<div class="lb-row"><span>'+esc(b.name)+' · '+esc(b.selection)+'</span><b>₹'+b.amount.toLocaleString('en-IN')+'</b></div>').join('')||'<div class="lb-empty">No submitted bets yet.</div>';
}
async function refresh(){try{const r=await fetch('/api/live-bets?game='+encodeURIComponent(game),{cache:'no-store'});if(!r.ok){renderSubmitted();return;}const d=await r.json();const bets=Array.isArray(d.bets)?d.bets:[];const total=bets.reduce((sum,b)=>sum+Math.max(0,Number(b.amount)||0),0);board.querySelector('.lb-total').textContent='Submitted bets total: ₹'+total.toLocaleString('en-IN');renderSubmitted(bets);}catch(e){renderSubmitted();}}
window.reportLiveBet=function(selection,amount){amount=Number(amount);if(!Number.isInteger(amount)||amount<1)return;fetch('/api/live-bets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game,selection:String(selection).slice(0,80),amount,clientId})}).then(()=>refresh()).catch(()=>{});};
renderSubmitted();refresh();setInterval(refresh,3000);
})();
