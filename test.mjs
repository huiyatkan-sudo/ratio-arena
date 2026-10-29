import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from './lib/game.mjs';
import {generate} from './lib/questions.mjs';

// Independent in-memory adapter implements the documented conditional-write
// contract. This tests gameplay/concurrency, not Netlify's hosted infrastructure.
function memoryStore(){
 const entries=new Map();let version=0;
 return {
  async getWithMetadata(key){return entries.has(key)?structuredClone(entries.get(key)):null},
  async setJSON(key,data,options){
   const old=entries.get(key);
   if(options.onlyIfNew&&old)return {modified:false};
   if(options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
   entries.set(key,{data:structuredClone(data),etag:'"'+(++version)+'"'});return {modified:true};
  }
 };
}
function client(handler){return async(body,token,code)=>{
 const req=new Request('https://quiz.test/api'+(body?'':'?code='+code),{method:body?'POST':'GET',headers:{Authorization:token||'','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const res=await handler(req);return {status:res.status,data:await res.json()};
}}
test('30 simultaneous pairs: no lost joins, submissions or scores',async()=>{
 let clock=1000000;
 const qs=generate(),store=memoryStore(),options={now:()=>clock,questions:()=>qs,pause:()=>new Promise(r=>setImmediate(r))};
 let request=client(createHandler(store,options));
 const {data:t}=await request({action:'create'});
 const teams=await Promise.all(Array.from({length:30},(_,i)=>request({action:'join',code:t.code,name:'隊伍'+i})));
 assert.ok(teams.every(r=>r.status===200));
 assert.equal((await request(null,t.token,t.code)).data.players.length,30);
 assert.equal((await request({action:'next',code:t.code},teams[0].data.token)).status,403);
 let expected=0;
 for(let round=0;round<5;round++){
  const opened=await request({action:'next',code:t.code},t.token);
  assert.equal(opened.data.question.correct,undefined);
  assert.equal(opened.data.deadline-clock,[40,40,50,60,70][round]*1000);
  assert.equal((await request({action:'join',code:t.code,name:'late'})).status,400);
  const answers=await Promise.all(teams.map(team=>request({action:'answer',code:t.code,choice:qs[round].correct},team.data.token)));
  assert.ok(answers.every(r=>r.status===200));expected+=1000;
  assert.equal((await request({action:'answer',code:t.code,choice:0},teams[0].data.token)).status,400);
  const revealed=await request({action:'reveal',code:t.code},t.token);
  assert.equal(revealed.data.question.correct,qs[round].correct);
  assert.ok(revealed.data.players.every(p=>p.score===expected&&p.answered));
  // New handler simulates a function cold start: state lives in storage.
  request=client(createHandler(store,options));
  assert.equal((await request(null,teams[0].data.token,t.code)).data.myAnswer,qs[round].correct);
 }
 assert.equal((await request({action:'next',code:t.code},t.token)).data.phase,'finished');
 clock+=6*3600000;
 assert.equal((await request(null,t.token,t.code)).status,404);
});
test('server deadline, invalid input and unauthorized access',async()=>{
 let clock=500000;const request=client(createHandler(memoryStore(),{now:()=>clock}));
 const {data:t}=await request({action:'create'});
 const {data:p}=await request({action:'join',code:t.code,name:'截止測試'});
 assert.equal((await request(null,'wrong',t.code)).status,401);
 await request({action:'next',code:t.code},t.token);
 assert.equal((await request({action:'answer',code:t.code,choice:7},p.token)).status,400);
 clock+=41000;
 assert.equal((await request({action:'answer',code:t.code,choice:0},p.token)).status,400);
 assert.equal((await request(null,p.token,t.code)).data.phase,'reveal');
});
test('2000 sessions: four unique choices and independent math checks',()=>{
 const ns=s=>[...s.replaceAll(',','').matchAll(/\d+(?:\.\d+)?/g)].map(m=>Number(m[0]));
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
 for(let n=0;n<2000;n++)generate().forEach((q,i)=>{
  assert.equal(new Set(q.choices).size,4);let x=ns(q.text),a=ns(q.choices[q.correct]);
  if(i===0)near(a[0]/a[1],x[0]**2/x[1]**2);
  if(i===1)near(a[0]/a[1],Math.sqrt(x[0]/x[1]));
  if(i===2)near(a[0],x[2]*(x[1]/x[0])**2);
  if(i===3)near(a[0],x[2]*Math.sqrt(x[1]/x[0]));
  if(i===4)near(a[0],x[2]*10000/x[1]**2);
 });
});
