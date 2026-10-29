import {randomBytes,randomInt} from 'node:crypto';
import {generate} from './questions.mjs';
const token=()=>randomBytes(24).toString('hex');
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const phaseOf=(room,now)=>room.phase==='question'&&now>=room.deadline?'reveal':room.phase;
const keyFor=code=>'room/'+code;

function view(room,auth,now){
  const teacher=auth===room.teacher;
  const player=room.players.find(p=>p.token===auth);
  if(!teacher&&!player)fail('請重新加入房間',401);
  const phase=phaseOf(room,now),q=room.questions[room.round];
  return {
    code:room.code,teacher,phase,round:room.round,now,deadline:room.deadline,
    players:room.players.map(p=>({id:p.id,name:p.name,score:p.score,answered:!!p.answers[room.round]})).sort((a,b)=>b.score-a.score),
    question:q?{title:q.title,text:q.text,choices:q.choices,seconds:q.seconds,...(phase!=='question'?{correct:q.correct,solution:q.solution}:{})}:null,
    myAnswer:player?.answers[room.round]?.choice
  };
}

export function createHandler(store,{now=Date.now,questions=generate,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  async function load(code){
    if(!/^\d{6}$/.test(code||''))fail('請輸入六位房間碼');
    const entry=await store.getWithMetadata(keyFor(code),{type:'json',consistency:'strong'});
    if(!entry||entry.data.expires<=now())fail('房間不存在或已到期',404);
    if(!entry.etag)fail('儲存服務未提供版本資料，請稍後重試',503);
    return entry;
  }
  async function mutate(code,fn){
    for(let attempt=0;attempt<40;attempt++){
      const {data:room,etag}=await load(code);
      room.phase=phaseOf(room,now());
      const result=fn(room);
      // Conditional writes reject a stale snapshot. Reload before every retry;
      // scoring and duplicate-answer checks are reapplied to the latest room.
      const {modified}=await store.setJSON(keyFor(code),room,{onlyIfMatch:etag});
      if(modified)return result;
      await pause(15+Math.random()*80);
    }
    fail('同時提交較多，請再按一次。',409);
  }
  return async function handle(request){
    try{
      const auth=request.headers.get('authorization');
      if(request.method==='GET'){
        const code=new URL(request.url).searchParams.get('code');
        const {data:room}=await load(code);
        return reply(view(room,auth,now()));
      }
      if(request.method!=='POST')fail('Method not allowed',405);
      const raw=await request.text();if(raw.length>4096)fail('資料過大',413);
      let body;try{body=JSON.parse(raw)}catch{fail('資料格式錯誤')}
      const {action,code}=body;
      if(action==='create'){
        for(let attempt=0;attempt<12;attempt++){
          const code=String(randomInt(100000,1000000));
          const room={code,teacher:token(),questions:questions(),round:-1,phase:'lobby',players:[],created:now(),expires:now()+6*3600000};
          const prior=await store.getWithMetadata(keyFor(code),{type:'json',consistency:'strong'});
          if(prior&&prior.data.expires>now())continue;
          const condition=prior?{onlyIfMatch:prior.etag}:{onlyIfNew:true};
          const {modified}=await store.setJSON(keyFor(code),room,condition);
          if(modified)return reply({code,token:room.teacher});
        }
        fail('暫時無法開房，請重試',503);
      }
      const result=await mutate(code,room=>{
        if(action==='join'){
          if(room.phase!=='lobby')fail('比賽已開始，請等候下一場');
          const name=String(body.name||'').trim().slice(0,24);
          if(!name)fail('請輸入隊名');
          if(room.players.some(p=>p.name===name))fail('隊名已使用');
          if(room.players.length>=60)fail('房間已滿');
          const p={id:token().slice(0,10),token:token(),name,score:0,answers:{}};
          room.players.push(p);return {code,token:p.token};
        }
        if(action==='answer'){
          const p=room.players.find(p=>p.token===auth);
          if(!p)fail('未獲授權',401);
          if(room.phase!=='question'||p.answers[room.round])fail('本題已提交或已結束');
          if(!Number.isInteger(body.choice)||body.choice<0||body.choice>3)fail('無效答案');
          p.answers[room.round]={choice:body.choice};
          if(body.choice===room.questions[room.round].correct)p.score+=1000;
        }else{
          if(auth!==room.teacher)fail('只有教師可以操作',403);
          if(action==='next'){
            if(!['lobby','reveal'].includes(room.phase))fail('請先公布答案');
            if(room.round===4)room.phase='finished';
            else{room.round++;room.phase='question';room.deadline=now()+room.questions[room.round].seconds*1000}
          }else if(action==='reveal'){
            if(room.phase!=='question')fail('尚未作答');room.phase='reveal';
          }else fail('無效操作');
        }
        return view(room,auth,now());
      });
      return reply(result);
    }catch(e){return reply({error:e.status?e.message:'服務暫時無法使用，請重試或用本機示範。'},e.status||503)}
  };
}
