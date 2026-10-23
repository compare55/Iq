const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let adminSdk = null;
let firestore = null;
try {
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    adminSdk = require('firebase-admin');
    if (!adminSdk.apps.length) adminSdk.initializeApp({ credential: adminSdk.credential.cert({ projectId, clientEmail, privateKey }) });
    firestore = adminSdk.firestore();
    console.log('Firestore configured');
  } else {
    console.warn('Firestore not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY. Local JSON fallback will be used.');
  }
} catch (e) { console.error('Firestore initialization failed:', e.message); }

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_CHAT_ID = String(process.env.TELEGRAM_ADMIN_CHAT_ID || '');
// Separate Telegram bot for live support; payment/withdrawal bot settings stay unchanged.
const SUPPORT_BOT_TOKEN = process.env.SUPPORT_TELEGRAM_BOT_TOKEN || '';
const SUPPORT_ADMIN_CHAT_ID = String(process.env.SUPPORT_TELEGRAM_ADMIN_CHAT_ID || '');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'requests.json');
const LIVE_BETS_FILE = path.join(DATA_DIR, 'live-bets.json');
const CHAT_FILE = path.join(DATA_DIR, 'chat-messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
// Third, separate Telegram bot for Login/Register notifications.
const LOGIN_BOT_TOKEN = process.env.LOGIN_TELEGRAM_BOT_TOKEN || '';
const LOGIN_ADMIN_CHAT_ID = String(process.env.LOGIN_TELEGRAM_ADMIN_CHAT_ID || '');
const sessions = new Map();
// Small in-memory abuse guards; these do not alter game logic or UI.
const rateBuckets = new Map();
const supportNoticeAt = new Map();
const processingRequests = new Set();
function rateLimited(key, limit, windowMs) {
 const now=Date.now(); let row=rateBuckets.get(key);
 if(!row || now-row.startedAt>=windowMs) row={startedAt:now,count:0};
 row.count++; rateBuckets.set(key,row);
 if(rateBuckets.size>5000){ for(const [k,v] of rateBuckets) if(now-v.startedAt>windowMs*2) rateBuckets.delete(k); }
 return row.count>limit;
}
// Ensure the data directory exists before creating any files inside it.
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CHAT_FILE)) fs.writeFileSync(CHAT_FILE, '{}');
let chats = JSON.parse(fs.readFileSync(CHAT_FILE, 'utf8'));
async function saveChats(){ fs.writeFileSync(CHAT_FILE, JSON.stringify(chats, null, 2)); if (firestore) await firestore.collection('jiowinData').doc('chats').set({value:chats, updatedAt:new Date().toISOString()}); }
function validVisitor(v){ return /^[a-zA-Z0-9_-]{8,80}$/.test(String(v||'')); }
// Offline rule-based support: no AI API or paid AI service required.
// Return a canned reply for known FAQs; null means hand off to a human admin.
function fixedSupportReply(message){
 const m=String(message||'').toLowerCase().replace(/[^a-z0-9₹\s]/g,' ').replace(/\s+/g,' ').trim();
 const has=(...words)=>words.some(w=>m.includes(w));
 if(has('human','real person','admin se','agent','insaan','owner se','support person','talk to admin','talk to human')) return null;
 if(has('hello','hi','hii','hey','namaste','namaskar','good morning','good evening','help chahiye')) return 'Hello! 👋 Jiowin Support mein welcome. Aap Add Money, Withdraw, Login/Register ya kisi game ki problem ke baare mein pooch sakte hain. Agar aapka issue specific hai, main admin ko message bhej dunga.';
 if(has('add money kaise','deposit kaise','money add','add money','deposit kaise kare','recharge kaise','payment kaise')) return '💰 Add Money ke liye website ke Wallet/Add Money section mein jaakar amount select karein aur diye gaye payment instructions follow karein. Payment karne ke baad required reference/UTR details sahi bharein. Kisi bhi payment ko bot khud approve nahi karta.';
 if(has('withdraw kaise','withdrawal kaise','paise nikale','money withdraw','withdraw karna','withdrawal process')) return '🏦 Withdrawal ke liye Wallet/Withdraw section kholein, required amount aur details dhyan se bharein aur request submit karein. Request ka final status admin approval par depend karta hai. Apna password, OTP ya bank PIN chat mein share na karein.';
 if(has('pending','approve nahi','approved nahi','payment nahi aaya','paisa nahi aaya','money nahi aaya','utr','transaction id','payment status','withdraw status','withdraw pending','deposit pending','payment failed','withdraw nahi')) return null;
 if(has('login','log in','sign in','password','register','registration','account create','signup','sign up')) return '🔐 Login/Register issue ke liye username aur password sahi check karein. Password bhool gaye hain to account details ya OTP kisi ke saath share na karein. Agar issue abhi bhi hai, main support admin ko message bhej raha hoon.';
 if(has('game open','game nahi','black screen','screen black','game problem','game issue','sound','loading','not loading','crash')) return null;
 if(has('referral','refer','invite bonus','bonus')) return '🎁 Referral section mein apna referral code/link check karein. Referral reward ke rules aur eligibility apply hote hain; reward status confirm karne ke liye admin se check karwaya ja sakta hai.';
 if(has('thank','thanks','shukriya','dhanyawad')) return 'Aapka swagat hai! 😊 Agar aur help chahiye to apna sawal bhej dein.';
 return null;
}
async function appendSupportMessage(visitorId, role, message){
 if(!chats[visitorId]) chats[visitorId]=[];
 const row={id:crypto.randomBytes(8).toString('hex'),role,message:String(message).slice(0,1000),createdAt:new Date().toISOString()};
 chats[visitorId].push(row); chats[visitorId]=chats[visitorId].slice(-200); await saveChats(); return row;
}
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
if (!fs.existsSync(LIVE_BETS_FILE)) fs.writeFileSync(LIVE_BETS_FILE, '[]');
let requests = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
let liveBets = JSON.parse(fs.readFileSync(LIVE_BETS_FILE, 'utf8'));
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
function saveUsersFile(){ fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
async function persistUser(user){ if (firestore) await firestore.collection('jiowinUsers').doc(user.id).set(user); else saveUsersFile(); saveUsersFile(); }
async function hydrateFirestore(){
 if(!firestore) return;
 for (const [name, current, file] of [['requests',requests,DB_FILE],['liveBets',liveBets,LIVE_BETS_FILE],['chats',chats,CHAT_FILE]]) {
  const ref=firestore.collection('jiowinData').doc(name); const snap=await ref.get();
  if(snap.exists && snap.data() && snap.data().value !== undefined){
   const value=snap.data().value; if(name==='requests') requests=value; else if(name==='liveBets') liveBets=value; else chats=value;
   fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } else { await ref.set({value:current, updatedAt:new Date().toISOString()}); }
 }
 const userSnap=await firestore.collection('jiowinUsers').get();
 if(!userSnap.empty){ users=userSnap.docs.map(d=>d.data()); saveUsersFile(); }
 else if(users.length){ for(const u of users) await firestore.collection('jiowinUsers').doc(u.id).set(u); }
 console.log('Firestore data loaded');
}
async function saveLiveBets(){ liveBets=liveBets.slice(0,500); fs.writeFileSync(LIVE_BETS_FILE, JSON.stringify(liveBets, null, 2)); if (firestore) await firestore.collection('jiowinData').doc('liveBets').set({value:liveBets, updatedAt:new Date().toISOString()}); }
let offset = 0;
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.apk':'application/vnd.android.package-archive'};
async function save(){ if(!firestore) throw new Error('Firebase Firestore is not configured; request persistence is unavailable'); await firestore.collection('jiowinData').doc('requests').set({value:requests, updatedAt:new Date().toISOString()}); fs.writeFileSync(DB_FILE, JSON.stringify(requests, null, 2)); }
function send(res, code, obj){ res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}); res.end(JSON.stringify(obj)); }
function readBody(req){ return new Promise((resolve,reject)=>{let s=''; req.on('data',c=>{s+=c; if(s.length>20000){reject(new Error('Too large'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'))}catch(e){reject(e)}});});}
async function tg(method, body){
 if(!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is missing');
 const response=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 let data; try { data=await response.json(); } catch { throw new Error(`Telegram ${method} returned non-JSON (HTTP ${response.status})`); }
 if(!response.ok || !data.ok) throw new Error(`Telegram ${method} failed: ${data.description || response.statusText || response.status}`);
 return data;
}
async function supportTg(method, body){
 if(!SUPPORT_BOT_TOKEN) throw new Error('SUPPORT_TELEGRAM_BOT_TOKEN is missing');
 const response=await fetch(`https://api.telegram.org/bot${SUPPORT_BOT_TOKEN}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 let data; try { data=await response.json(); } catch { throw new Error(`Support Telegram ${method} returned non-JSON (HTTP ${response.status})`); }
 if(!response.ok || !data.ok) throw new Error(`Support Telegram ${method} failed: ${data.description || response.statusText || response.status}`);
 return data;
}
async function loginTg(text){
 if(!LOGIN_BOT_TOKEN || !LOGIN_ADMIN_CHAT_ID) return;
 const response=await fetch(`https://api.telegram.org/bot${LOGIN_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:LOGIN_ADMIN_CHAT_ID,text}),signal:AbortSignal.timeout(15000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok || !data.ok) throw new Error(data.description || 'Login notification failed');
}
function cookieValue(req,name){ const raw=String(req.headers.cookie||''); const part=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return part?decodeURIComponent(part.slice(name.length+1)):''; }
function authSend(res,code,obj,cookie){ const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}; if(cookie) headers['Set-Cookie']=cookie; res.writeHead(code,headers); res.end(JSON.stringify(obj)); }
function currentUser(req){ const token=cookieValue(req,'jw_session'); const uid=sessions.get(token); return uid?users.find(u=>u.id===uid):null; }
function publicUser(u){ return {id:u.id,username:u.username,phone:u.phone||'',createdAt:u.createdAt,referralCode:u.referralCode||''}; }
function makeReferralCode(username){ const stem=String(username||'USER').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'USER'; let code='JW'+stem+crypto.randomBytes(2).toString('hex').toUpperCase(); while(users.some(x=>x.referralCode===code)) code='JW'+stem+crypto.randomBytes(3).toString('hex').toUpperCase(); return code; }
// Referral reward policy: ₹50 once per referred account, only after that account's
// first deposit request is marked APPROVED by the Telegram admin callback.
// Deposit requests created without a logged-in session are intentionally ineligible.
async function reconcileReferralRewards(){
 const approvedDeposits=requests.filter(r=>r.type==='deposit' && r.status==='APPROVED' && r.userId).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
 for(const request of approvedDeposits){
  const referred=users.find(u=>u.id===request.userId);
  if(!referred || !referred.referredByCode) continue;
  const referrer=users.find(u=>u.referralCode===referred.referredByCode);
  if(!referrer || referrer.id===referred.id) continue;
  const rewarded=Array.isArray(referrer.rewardedReferralUserIds)?referrer.rewardedReferralUserIds:[];
  if(rewarded.includes(referred.id)) continue;
  const previous={balance:referrer.referralRewardBalance, rewarded:referrer.rewardedReferralUserIds, events:referrer.referralRewardEvents};
  referrer.referralRewardBalance=Number(referrer.referralRewardBalance||0)+50;
  referrer.rewardedReferralUserIds=[...rewarded,referred.id];
  referrer.referralRewardEvents=Array.isArray(referrer.referralRewardEvents)?referrer.referralRewardEvents:[];
  referrer.referralRewardEvents.push({referredUserId:referred.id,username:referred.username,amount:50,depositRequestId:request.id,creditedAt:new Date().toISOString()});
  try { await persistUser(referrer); console.log(`Referral reward credited: ₹50 to ${safe(referrer.username)} for first approved deposit by ${safe(referred.username)}`); }
  catch(e){
   if(previous.balance===undefined) delete referrer.referralRewardBalance; else referrer.referralRewardBalance=previous.balance;
   if(previous.rewarded===undefined) delete referrer.rewardedReferralUserIds; else referrer.rewardedReferralUserIds=previous.rewarded;
   if(previous.events===undefined) delete referrer.referralRewardEvents; else referrer.referralRewardEvents=previous.events;
   throw e;
  }
 }
}
function makeSession(res,user){ const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id); const secure=process.env.NODE_ENV==='production'?' Secure;':''; return `jw_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800;${secure}`; }
async function notifyLogin(event,user){
 if(!LOGIN_BOT_TOKEN || !LOGIN_ADMIN_CHAT_ID) return;
 const text=`🔐 JIOWIN ${event}\n\nUsername: ${safe(user.username)}\nPhone: ${safe(user.phone||'Not provided')}\nUser ID: ${user.id}\nTime: ${new Date().toISOString()}\n\nPassword is not included.`;
 await loginTg(text);
}
function safe(s){ return String(s||'').replace(/[<>&]/g,' ').slice(0,300); }
async function notify(r){
 if(!BOT_TOKEN || !ADMIN_CHAT_ID) return;
 let msg = `🟡 JIOWIN ${r.type==='deposit'?'ADD MONEY':'WITHDRAWAL'} REQUEST\n\nRequest ID: ${r.id}\nCustomer ID: ${safe(r.customerId)}\nAmount: ₹${r.amount}\nStatus: PENDING`;
 if(r.type==='deposit') msg += `\nUTR: ${safe(r.utr)}`;
 else msg += `\nAccount holder: ${safe(r.holder)}\nBank: ${safe(r.bank)}\nAccount: ${safe(r.account)}\nIFSC: ${safe(r.ifsc)}`;
 const sent=await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:msg,reply_markup:{inline_keyboard:[[{text:'✅ Approve',callback_data:`approve:${r.id}`},{text:'❌ Reject',callback_data:`reject:${r.id}`}]]}});
 if(!sent.result || !sent.result.message_id) throw new Error('Telegram did not confirm delivery to the admin chat');
}
async function handleUpdate(u){
 if(!u.callback_query) return;
 const q=u.callback_query, data=String(q.data||'');
 // Acknowledge immediately so Telegram's button spinner never waits on Firestore/network I/O.
 // In a private admin chat, sender ID and chat ID match. Group admins can set TELEGRAM_ADMIN_USER_ID.
 try { await tg('answerCallbackQuery',{callback_query_id:q.id,text:'Processing…'}); }
 catch(e) { console.error('Could not acknowledge Telegram button:',e.message); }
 const adminUserId=String(process.env.TELEGRAM_ADMIN_USER_ID||'');
 const chatMatches=String(q.message?.chat?.id||'')===ADMIN_CHAT_ID;
 const senderMatches=adminUserId ? String(q.from?.id||'')===adminUserId : String(q.from?.id||'')===ADMIN_CHAT_ID;
 if(!chatMatches || !senderMatches){
  try { await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:'⚠️ Approval button click rejected: admin chat/user ID did not match configuration.'}); } catch(e) { console.error('Could not report unauthorized callback:',e.message); }
  return;
 }
 const [action,id]=data.split(':');
 if(!['approve','reject'].includes(action) || !id) { console.warn('Invalid Telegram callback data'); return; }
 if(processingRequests.has(id)) { console.log('Duplicate callback ignored for',id); return; }
 processingRequests.add(id);
 try {
  const r=requests.find(x=>x.id===id);
  if(!r){ await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:`⚠️ Request ${safe(id)} not found in current storage. Check Render logs/Firestore.`}); return; }
  if(r.status!=='PENDING'){
   try { await tg('editMessageReplyMarkup',{chat_id:q.message.chat.id,message_id:q.message.message_id,reply_markup:{inline_keyboard:[]}}); } catch(e) {}
   await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:`ℹ️ Request ${r.id} was already ${r.status}. No second action was applied.`}); return;
  }
  const previous={status:r.status,processedAt:r.processedAt,processedBy:r.processedBy};
  r.status=action==='approve'?'APPROVED':'REJECTED'; r.processedAt=new Date().toISOString(); r.processedBy=String(q.from.id);
  try { await save(); }
  catch(e) {
   Object.assign(r,previous);
   try { fs.writeFileSync(DB_FILE, JSON.stringify(requests, null, 2)); } catch(fileError) { console.error('Could not restore local request state:',fileError.message); }
   console.error('Could not persist approval:',e.message);
   try { await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:`❌ Approval was NOT saved for ${r.id}. Storage/Firestore error: ${String(e.message||'unknown').slice(0,250)}. Please check Render logs; request remains pending.`}); } catch(notifyError) { console.error('Could not report approval save failure:',notifyError.message); }
   return;
  }
  if(action==='approve' && r.type==='deposit' && r.userId){
   try { await reconcileReferralRewards(); }
   catch(e) { console.error('Deposit approved but referral reward reconciliation failed; it can retry when referral page is opened:',e.message); }
  }
  try { await tg('editMessageReplyMarkup',{chat_id:q.message.chat.id,message_id:q.message.message_id,reply_markup:{inline_keyboard:[]}}); } catch(e) { console.error('Could not remove Telegram buttons:',e.message); }
  try { await tg('sendMessage',{chat_id:ADMIN_CHAT_ID,text:`✅ ${r.type==='deposit'?'ADD MONEY':'WITHDRAWAL'} ${r.id} marked ${r.status}.\nCustomer: ${safe(r.customerId)}\nAmount: ₹${r.amount}\n\nNote: this records approval only; it does not verify payment or transfer funds.`}); }
  catch(e) { console.error('Approval saved, but confirmation message failed:',e.message); }
 } finally { processingRequests.delete(id); }
}
let pollingStarted = false;
async function pollBot(){
 if(!BOT_TOKEN || !ADMIN_CHAT_ID || pollingStarted) return;
 pollingStarted = true;
 try {
  // getUpdates cannot run while a webhook is configured. Preserve queued updates.
  await tg('deleteWebhook',{drop_pending_updates:false});
  const me=await tg('getMe',{});
  console.log(`Telegram bot connected as @${me.result.username}`);
  while(true){
   try {
    const data=await tg('getUpdates',{offset,timeout:20,allowed_updates:['callback_query']});
    for(const u of data.result||[]){
     offset=u.update_id+1;
     try { await handleUpdate(u); } catch(e) { console.error('Telegram callback handling failed:',e.message); }
    }
   } catch(e) {
    console.error('Telegram polling error:',e.message);
    await new Promise(resolve=>setTimeout(resolve,3000));
   }
  }
 } catch(e) {
  console.error('Telegram bot startup failed:',e.message);
  pollingStarted=false;
  setTimeout(pollBot,5000);
 }
}
let supportOffset = 0;
let supportPollingStarted = false;
async function handleSupportUpdate(u){
 if(!u.message || !u.message.chat || String(u.message.chat.id)!==SUPPORT_ADMIN_CHAT_ID) return;
 const text=String(u.message.text||'').trim();
 const match=text.match(/^\/reply(?:@\w+)?\s+([a-zA-Z0-9_-]{8,80})\s+([\s\S]+)$/i);
 if(match){
  const visitorId=match[1], message=match[2].trim().slice(0,1000);
  if(!chats[visitorId]){ await supportTg('sendMessage',{chat_id:SUPPORT_ADMIN_CHAT_ID,text:`No conversation found for ${visitorId}. Ask the user to send a new message.`}); return; }
  await appendSupportMessage(visitorId,'admin',message);
  await supportTg('sendMessage',{chat_id:SUPPORT_ADMIN_CHAT_ID,text:`✅ Reply sent to ${visitorId}.`});
 } else if(text.startsWith('/reply')) {
  await supportTg('sendMessage',{chat_id:SUPPORT_ADMIN_CHAT_ID,text:'Reply format:\n/reply VISITOR_ID Your message here\n\nUse the Visitor ID shown in each support notification.'});
 }
}
async function pollSupportBot(){
 if(!SUPPORT_BOT_TOKEN || !SUPPORT_ADMIN_CHAT_ID || supportPollingStarted) return;
 supportPollingStarted=true;
 try{
  await supportTg('deleteWebhook',{drop_pending_updates:false});
  const me=await supportTg('getMe',{}); console.log(`Support Telegram bot connected as @${me.result.username}`);
  while(true){
   try{const data=await supportTg('getUpdates',{offset:supportOffset,timeout:20,allowed_updates:['message']});
    for(const u of data.result||[]){supportOffset=u.update_id+1;try{await handleSupportUpdate(u)}catch(e){console.error('Support Telegram update failed:',e.message)}}
   }catch(e){console.error('Support Telegram polling error:',e.message);await new Promise(resolve=>setTimeout(resolve,3000));}
  }
 }catch(e){console.error('Support Telegram startup failed:',e.message);supportPollingStarted=false;setTimeout(pollSupportBot,5000)}
}

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});return res.end();}
 const url=new URL(req.url,'http://localhost');
 try{
  if(req.method==='GET' && url.pathname==='/api/health'){
   return send(res,200,{ok:true,telegramConfigured:Boolean(BOT_TOKEN&&ADMIN_CHAT_ID),supportTelegramConfigured:Boolean(SUPPORT_BOT_TOKEN&&SUPPORT_ADMIN_CHAT_ID),loginTelegramConfigured:Boolean(LOGIN_BOT_TOKEN&&LOGIN_ADMIN_CHAT_ID),firestoreConfigured:Boolean(firestore),accountAndRequestPersistence:Boolean(firestore),storageWritable:fs.existsSync(DATA_DIR)});
  }
  if(req.method==='GET' && url.pathname==='/api/auth/me'){
   const user=currentUser(req); return authSend(res,200,{ok:true,user:user?publicUser(user):null});
  }
  if(req.method==='GET' && url.pathname==='/api/referral/me'){
   const user=currentUser(req); if(!user) return authSend(res,401,{error:'Please login first'});
   if(!user.referralCode){ user.referralCode=makeReferralCode(user.username); try{await persistUser(user);}catch(e){return authSend(res,503,{error:'Could not save referral code'});} }
   try { await reconcileReferralRewards(); } catch(e) { console.error('Referral reward reconciliation failed:',e.message); return authSend(res,503,{error:'Could not verify referral rewards right now. Please try again.'}); }
   const referrals=users.filter(x=>x.referredByCode===user.referralCode).map(x=>({username:x.username,joinedAt:x.createdAt,firstDepositRewarded:(Array.isArray(user.rewardedReferralUserIds)?user.rewardedReferralUserIds:[]).includes(x.id)}));
   return authSend(res,200,{ok:true,code:user.referralCode,count:referrals.length,referrals,rewardBalance:Number(user.referralRewardBalance||0),rewardMessage:'₹50 is credited once when a referred friend’s first deposit is approved by the admin. Only deposits submitted while logged in are eligible.'});
  }
  if(req.method==='POST' && url.pathname==='/api/auth/register'){
   if(!firestore) return authSend(res,503,{error:'Account storage is unavailable. Configure Firebase Firestore in Render before registering; this protects account data from being lost on restart.'});
   let b; try{b=await readBody(req)}catch(e){return authSend(res,400,{error:'Invalid registration details'});}
   const username=String(b.username||'').trim(); const usernameLower=username.toLowerCase(); const password=String(b.password||''); const phone=String(b.phone||'').trim().slice(0,24); const submittedReferralCode=String(b.referralCode||'').trim().toUpperCase();
   if(!/^[A-Za-z0-9_]{3,24}$/.test(username)) return authSend(res,400,{error:'Username must be 3-24 letters, numbers, or underscores'});
   if(password.length<8 || password.length>128) return authSend(res,400,{error:'Password must be 8-128 characters'});
   if(users.some(u=>u.usernameLower===usernameLower)) return authSend(res,409,{error:'Username already exists'});
   if(firestore){ const dup=await firestore.collection('jiowinUsers').where('usernameLower','==',usernameLower).limit(1).get(); if(!dup.empty) return authSend(res,409,{error:'Username already exists'}); }
   const referrer=submittedReferralCode?users.find(u=>u.referralCode===submittedReferralCode):null;
   if(submittedReferralCode && !referrer) return authSend(res,400,{error:'Invalid referral code'});
   const salt=crypto.randomBytes(16).toString('hex'); const passwordHash=crypto.scryptSync(password,salt,64).toString('hex');
   const user={id:crypto.randomBytes(16).toString('hex'),username,usernameLower,phone,salt,passwordHash,createdAt:new Date().toISOString(),referralCode:makeReferralCode(username),referredByCode:referrer?referrer.referralCode:null};
   users.push(user); try{await persistUser(user);}catch(e){users=users.filter(u=>u.id!==user.id); return authSend(res,503,{error:'Could not save account to database. Check Firestore setup.'});}
   const cookie=makeSession(res,user); try{await notifyLogin('NEW REGISTRATION',user);}catch(e){console.error('Login/register Telegram notification failed:',e.message);}
   return authSend(res,201,{ok:true,user:publicUser(user)},cookie);
  }
  if(req.method==='POST' && url.pathname==='/api/auth/login'){
   let b; try{b=await readBody(req)}catch(e){return authSend(res,400,{error:'Invalid login details'});}
   const usernameLower=String(b.username||'').trim().toLowerCase(); const password=String(b.password||'');
   const user=users.find(u=>u.usernameLower===usernameLower);
   if(!user || password.length>128) return authSend(res,401,{error:'Invalid username or password'});
   const actual=crypto.scryptSync(password,user.salt,64); const expected=Buffer.from(user.passwordHash,'hex');
   if(actual.length!==expected.length || !crypto.timingSafeEqual(actual,expected)) return authSend(res,401,{error:'Invalid username or password'});
   const cookie=makeSession(res,user); try{await notifyLogin('LOGIN',user);}catch(e){console.error('Login/register Telegram notification failed:',e.message);}
   return authSend(res,200,{ok:true,user:publicUser(user)},cookie);
  }
  if(req.method==='POST' && url.pathname==='/api/auth/logout'){
   const token=cookieValue(req,'jw_session'); if(token) sessions.delete(token);
   return authSend(res,200,{ok:true},'jw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  }
  if(req.method==='GET' && url.pathname==='/api/chat/messages'){
   const visitorId=String(url.searchParams.get('visitorId')||'');
   if(!validVisitor(visitorId)) return send(res,400,{error:'Invalid visitor ID'});
   return send(res,200,{messages:(chats[visitorId]||[]).slice(-100)});
  }
  if(req.method==='POST' && url.pathname==='/api/chat/messages'){
   let b; try{b=await readBody(req)}catch(e){return send(res,400,{error:'Invalid message'});}
   const visitorId=String(b.visitorId||''); const message=String(b.message||'').trim().slice(0,1000); const role=String(b.role||'user');
   if(!validVisitor(visitorId)||!message) return send(res,400,{error:'Visitor ID and message are required'});
   if(role!=='user') return send(res,400,{error:'Invalid message role'});
   if(!chats[visitorId]) chats[visitorId]=[];
   const now=Date.now();
   if(rateLimited('chat:'+visitorId,10,60000)) return send(res,429,{error:'Please wait a moment before sending more messages'});
   const row=await appendSupportMessage(visitorId,role,message);
   let autoReply=null;
   if(role==='user'){
    autoReply=fixedSupportReply(message);
    if(autoReply){
     try{ await appendSupportMessage(visitorId,'bot',autoReply); }
     catch(e){ console.error('Could not save fixed support reply:',e.message); }
    } else if(SUPPORT_BOT_TOKEN && SUPPORT_ADMIN_CHAT_ID){
     // Unknown/sensitive cases go to the human admin; no AI API is called.
     const lastNotice=supportNoticeAt.get(visitorId)||0;
     if(now-lastNotice>=5000){
      supportNoticeAt.set(visitorId,now);
      try{await supportTg('sendMessage',{chat_id:SUPPORT_ADMIN_CHAT_ID,text:`🆘 JIOWIN LIVE CHAT — ADMIN HELP NEEDED
Visitor ID: ${visitorId}
Message: ${message.slice(0,800)}

Reply to the user on the website using:
/reply ${visitorId} Your reply here`});}
      catch(e){console.error('Support chat handoff notification failed:',e.message);}
     }
    }
   }
   return send(res,201,{ok:true,message:row,autoReply:Boolean(autoReply),handoff:role==='user'&&!autoReply});
  }
  if(req.method==='GET' && url.pathname==='/api/live-bets'){
   const game=String(url.searchParams.get('game')||'').slice(0,40);
   const rows=liveBets.filter(x=>!game||x.game===game).slice(0,50);
   const totals={}; for(const x of rows){const k=x.selection; totals[k]=(totals[k]||0)+x.amount;}
   return send(res,200,{bets:rows,totals,updatedAt:new Date().toISOString()});
  }
  if(req.method==='POST' && url.pathname==='/api/live-bets'){
   const b=await readBody(req);
   const allowedGames=['Slot','Aviator','Color','Dragon Tiger','7 Up Down','Pappu','E-Sabong'];
   const game=String(b.game||''); const selection=safe(b.selection).trim();
   const amount=Number(b.amount); const clientId=String(b.clientId||'');
   if(!allowedGames.includes(game)||!selection||!Number.isInteger(amount)||amount<1||amount>100000||!/^anon-[a-f0-9]{16,40}$/.test(clientId)) return send(res,400,{error:'Invalid bet activity'});
   const now=Date.now();
   // Basic duplicate/rate guard: max one event per client per game every 250ms.
   if(liveBets.some(x=>x.clientId===clientId&&x.game===game&&now-Date.parse(x.createdAt)<250)) return send(res,429,{error:'Please wait'});
   const r={id:crypto.randomBytes(8).toString('hex'),game,selection,amount,clientId,player:'Guest-'+clientId.slice(-4).toUpperCase(),createdAt:new Date(now).toISOString()};
   liveBets.unshift(r); liveBets=liveBets.slice(0,500); await saveLiveBets();
   return send(res,201,{ok:true,id:r.id});
  }
  if(req.method==='POST' && url.pathname==='/api/requests'){
   if(!firestore) return send(res,503,{error:'Firebase Firestore is not configured. Add Money and Withdrawal requests are paused to prevent data loss after a server restart.'});
   if(!currentUser(req)) return send(res,401,{error:'Please login or register before submitting Add Money or Withdrawal requests.'});
   if(!BOT_TOKEN || !ADMIN_CHAT_ID) return send(res,503,{error:'Telegram admin is not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in Render Environment Variables.'});
   let b; try { b=await readBody(req); } catch(e) { return send(res,400,{error:'Invalid request data. Please reload and try again.'}); } const type=b.type;
   if(!['deposit','withdraw'].includes(type)) return send(res,400,{error:'Invalid request type'});
   const amount=Number(b.amount);
   if(!Number.isInteger(amount)||amount<1||amount>100000) return send(res,400,{error:'Amount must be a whole number between 1 and 100000'});
   if(!String(b.customerId||'').match(/^[A-Za-z0-9_-]{6,80}$/)) return send(res,400,{error:'Invalid customer ID'});
   const customerId=String(b.customerId);
   if(rateLimited('request:'+type+':'+customerId,5,60000)) return send(res,429,{error:'Too many requests. Please wait one minute before submitting again.'});
   if(type==='deposit' && !String(b.utr||'').trim()) return send(res,400,{error:'Transaction reference required'});
   if(type==='withdraw' && (!String(b.holder||'').trim()||!String(b.bank||'').trim()||!String(b.account||'').match(/^[0-9]{6,20}$/)||!String(b.ifsc||'').match(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/))) return send(res,400,{error:'Valid bank details required'});
   const linkedUser=currentUser(req);
   const r={id:(type==='deposit'?'DP':'WD')+'-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(3).toString('hex').toUpperCase(),type,amount,customerId,userId:linkedUser?linkedUser.id:undefined,utr:type==='deposit'?String(b.utr).trim().slice(0,80):undefined,holder:type==='withdraw'?String(b.holder).trim().slice(0,80):undefined,bank:type==='withdraw'?String(b.bank).trim().slice(0,80):undefined,account:type==='withdraw'?String(b.account):undefined,ifsc:type==='withdraw'?String(b.ifsc).toUpperCase():undefined,status:'PENDING',createdAt:new Date().toISOString()};
   requests.unshift(r); await save();
   try{await notify(r)}catch(e){console.error('Telegram notify failed:',e.message); return send(res,503,{error:'Request saved but Telegram notification failed: '+String(e.message||'unknown error').slice(0,180)+'. Check TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID, then retry only after confirming with admin.'});}
   return send(res,201,{id:r.id,status:r.status});
  }
  if(req.method==='GET' && url.pathname==='/api/requests'){
   const loggedIn=currentUser(req); if(!loggedIn) return send(res,401,{error:'Please login to view request history'});
   const customerId=String(url.searchParams.get('customerId')||'');
   if(!/^[A-Za-z0-9_-]{6,80}$/.test(customerId)) return send(res,400,{error:'Valid customer ID required'});
   // Return only this browser's request status fields; never expose bank details or UTR.
   const history=requests.filter(x=>x.customerId===customerId && x.userId===loggedIn.id).slice(0,100).map(x=>({id:x.id,type:x.type,status:x.status,amount:x.amount,createdAt:x.createdAt,processedAt:x.processedAt||null}));
   return send(res,200,{requests:history});
  }
  if(req.method==='GET' && url.pathname.startsWith('/api/requests/')){
   const loggedIn=currentUser(req); if(!loggedIn) return send(res,401,{error:'Please login to check request status'});
   const id=decodeURIComponent(url.pathname.split('/').pop()); const r=requests.find(x=>x.id===id && x.userId===loggedIn.id);
   if(!r)return send(res,404,{error:'Request not found'});
   return send(res,200,{id:r.id,type:r.type,status:r.status,amount:r.amount,customerId:r.customerId,processedAt:r.processedAt||null});
  }
  if(url.pathname.startsWith('/api/')) return send(res,404,{error:'Not found'});
  let p=decodeURIComponent(url.pathname); if(p==='/')p='/index.html';
  const full=path.resolve(ROOT,'.'+p); if(!full.startsWith(path.resolve(ROOT)+path.sep)) return send(res,403,{error:'Forbidden'});
  fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(full).toLowerCase()]||'application/octet-stream'});res.end(data);});
 }catch(e){send(res,400,{error:'Invalid request'});}
});
async function start(){
 try { await hydrateFirestore(); } catch(e) { console.error('Could not load Firestore data:',e.message); if(firestore) console.error('Check Firestore database is created and service account has access.'); }
 server.listen(PORT,()=>console.log(`Jiowin listening on ${PORT}`));
 if(BOT_TOKEN && ADMIN_CHAT_ID){ console.log('Telegram add-money/withdrawal bot configured'); pollBot(); }
 else console.warn('Telegram add-money/withdrawal approval disabled: set TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID.');
 if(SUPPORT_BOT_TOKEN && SUPPORT_ADMIN_CHAT_ID){ console.log('Separate Telegram live-support bot configured'); pollSupportBot(); }
 else console.warn('Live chat Telegram notifications disabled: set SUPPORT_TELEGRAM_BOT_TOKEN and SUPPORT_TELEGRAM_ADMIN_CHAT_ID.');
 if(LOGIN_BOT_TOKEN && LOGIN_ADMIN_CHAT_ID) console.log('Separate Telegram Login/Register bot configured');
 else console.warn('Login/Register Telegram notifications disabled: set LOGIN_TELEGRAM_BOT_TOKEN and LOGIN_TELEGRAM_ADMIN_CHAT_ID.');
}
start();
