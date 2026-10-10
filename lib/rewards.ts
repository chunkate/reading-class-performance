export type DisplayMode = 'seat' | 'name';
export type Semester = { id:string; label:string; active:boolean; createdAt:string };
export type Student = { seat:number; name:string };
export type Classroom = { id:string; semesterId:string; name:string; studentCount:number; displayMode:DisplayMode; archived:boolean; students:Student[] };
export type Task = { id:string; classId:string; semesterId:string; title:string; points:number; archived:boolean };
export type Entry = { student:number; amount:number };
export type Round = { id:string; number:number; students:number[]; confirmed:boolean };
export type Action = { id:string; classId:string; semesterId:string; date:string; time:string; kind:'reward'|'check'; reason:string; entries:Entry[]; undone:boolean; round?:{key:string;id:string} };
export type State = { semesters:Semester[]; classes:Classroom[]; tasks:Task[]; actions:Action[]; applied:string[]; rounds:Record<string,Round> };
export type Command = {
 id:string; date:string; type:string; semesterId?:string; sourceSemesterId?:string; classId?:string; taskId?:string;
 label?:string; name?:string; studentCount?:number; displayMode?:DisplayMode; archived?:boolean; copyTasks?:boolean;
 students?:number[]|Student[]; amount?:number; reason?:string; title?:string; points?:number; actionId?:string; roundId?:string;
};

export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function initialState():State{return {semesters:[],classes:[],tasks:[],actions:[],applied:[],rounds:{}};}
export function activeSemester(state:State){return state.semesters.find(s=>s.active);}
export function classSeats(state:State,classId:string){const room=state.classes.find(c=>c.id===classId);return Array.from({length:room?.studentCount??0},(_,i)=>i+1);}
export function studentName(state:State,classId:string,seat:number){return state.classes.find(c=>c.id===classId)?.students.find(s=>s.seat===seat)?.name??'';}
export function roundKey(date:string,classId:string,taskId:string){return `${classId}:${date}:${taskId}`;}
export function getRound(state:State,date:string,classId:string,taskId:string):Round{return state.rounds[roundKey(date,classId,taskId)]??{id:'initial',number:1,students:[],confirmed:false};}
export function scores(state:State,classId:string,date?:string,kind?:Action['kind']){
 const result:Record<number,number>=Object.fromEntries(classSeats(state,classId).map(n=>[n,0]));
 for(const action of state.actions)if(!action.undone&&action.classId===classId&&(!date||action.date===date)&&(!kind||action.kind===kind))for(const entry of action.entries)if(entry.student in result)result[entry.student]+=entry.amount;
 return result;
}
export function scoresBetween(state:State,classId:string,start:string,end:string,kind?:Action['kind']){
 const result:Record<number,number>=Object.fromEntries(classSeats(state,classId).map(n=>[n,0]));
 for(const action of state.actions)if(!action.undone&&action.classId===classId&&action.date>=start&&action.date<=end&&(!kind||action.kind===kind))for(const entry of action.entries)if(entry.student in result)result[entry.student]+=entry.amount;
 return result;
}
export function weekRange(date:string){const start=new Date(`${date}T00:00:00Z`),offset=(start.getUTCDay()+6)%7;start.setUTCDate(start.getUTCDate()-offset);const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};}
function assert(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
function validId(id:unknown){return typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);}
function writableRoom(state:State,classId:string|undefined){const room=state.classes.find(c=>c.id===classId);assert(room,'找不到這個班級');const semester=state.semesters.find(s=>s.id===room.semesterId);assert(semester?.active,'舊學期資料僅供查閱');assert(!room.archived,'這個班級已封存');return room;}
function cleanRoster(value:unknown,count:number){
 assert(Array.isArray(value)&&value.length<=count,'名單人數超過班級人數');
 const rows=(value as Student[]).map(row=>({seat:Number(row?.seat),name:String(row?.name??'').trim()}));
 assert(rows.every(row=>Number.isInteger(row.seat)&&row.seat>=1&&row.seat<=count&&row.name.length<=40),'名單包含無效的座號或姓名');
 assert(new Set(rows.map(row=>row.seat)).size===rows.length,'名單有重複座號');
 return rows.filter(row=>row.name).sort((a,b)=>a.seat-b.seat);
}

export function applyCommand(current:State,cmd:Command):State{
 assert(cmd&&validId(cmd.id),'操作編號不正確');
 if(current.applied.includes(cmd.id))return current;
 assert(typeof cmd.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(cmd.date)&&!Number.isNaN(Date.parse(cmd.date))&&new Date(cmd.date).toISOString().slice(0,10)===cmd.date&&cmd.date<=today(),'請選擇有效日期，不可記錄未來日期');
 const state=structuredClone(current),now=new Date().toISOString();
 if(cmd.type==='semester'){
  assert(state.semesters.length===0,'已有學期，請使用「建立新學期」');
  assert(typeof cmd.label==='string'&&cmd.label.trim().length>=2&&cmd.label.trim().length<=50,'請輸入2～50字的學期名稱');
  state.semesters.push({id:cmd.id,label:cmd.label.trim(),active:true,createdAt:now});
 }else if(cmd.type==='newSemester'){
  const source=state.semesters.find(s=>s.id===cmd.sourceSemesterId);
  assert(source&&source.active,'找不到目前學期');
  assert(typeof cmd.label==='string'&&cmd.label.trim().length>=2&&cmd.label.trim().length<=50,'請輸入2～50字的學期名稱');
  assert(!state.semesters.some(s=>s.label===cmd.label?.trim()),'學期名稱不可重複');
  source.active=false;const semesterId=cmd.id;state.semesters.push({id:semesterId,label:cmd.label.trim(),active:true,createdAt:now});
  const rooms=state.classes.filter(c=>c.semesterId===source.id&&!c.archived);
  rooms.forEach((room,index)=>{const classId=`${cmd.id}-c${index+1}`;state.classes.push({...room,id:classId,semesterId,archived:false,students:room.students.map(s=>({...s}))});
   if(cmd.copyTasks)state.tasks.filter(t=>t.classId===room.id&&!t.archived).forEach((task,taskIndex)=>state.tasks.push({...task,id:`${cmd.id}-c${index+1}-t${taskIndex+1}`,classId,semesterId,archived:false}));
  });
 }else if(cmd.type==='class'){
  const semester=state.semesters.find(s=>s.id===cmd.semesterId&&s.active);assert(semester,'請先建立或選擇目前學期');
  assert(typeof cmd.name==='string'&&cmd.name.trim().length>=1&&cmd.name.trim().length<=40,'請輸入1～40字的班級名稱');
  assert(Number.isInteger(cmd.studentCount)&&cmd.studentCount!>=1&&cmd.studentCount!<=50,'班級人數請設定1～50人');
  assert(cmd.displayMode==='seat'||cmd.displayMode==='name','顯示方式不正確');
  assert(!state.classes.some(c=>c.semesterId===semester.id&&c.id!==cmd.classId&&c.name===cmd.name?.trim()),'這個學期已有同名班級');
  const room=state.classes.find(c=>c.id===cmd.classId);
  if(room){assert(room.semesterId===semester.id,'舊學期班級不可修改');room.name=cmd.name.trim();room.studentCount=cmd.studentCount!;room.displayMode=cmd.displayMode;room.students=room.students.filter(s=>s.seat<=room.studentCount);}
  else state.classes.push({id:cmd.id,semesterId:semester.id,name:cmd.name.trim(),studentCount:cmd.studentCount!,displayMode:cmd.displayMode,archived:false,students:[]});
 }else if(cmd.type==='archiveClass'){
  const room=state.classes.find(c=>c.id===cmd.classId),semester=state.semesters.find(s=>s.id===room?.semesterId);assert(room&&semester?.active&&typeof cmd.archived==='boolean','找不到可修改的班級');room.archived=cmd.archived;
 }else if(cmd.type==='roster'){
  const room=writableRoom(state,cmd.classId);room.students=cleanRoster(cmd.students,room.studentCount);
 }else if(cmd.type==='task'){
  const room=writableRoom(state,cmd.classId);assert(typeof cmd.title==='string'&&cmd.title.trim().length>=1&&cmd.title.trim().length<=60,'請輸入1～60字的項目名稱');assert(Number.isInteger(cmd.points)&&cmd.points!>=0&&cmd.points!<=100,'完成獎勵請設定0～100分');
  const task=state.tasks.find(t=>t.id===cmd.taskId);if(task){assert(task.classId===room.id,'任務不屬於這個班級');task.title=cmd.title.trim();task.points=cmd.points!;}else state.tasks.push({id:cmd.id,classId:room.id,semesterId:room.semesterId,title:cmd.title.trim(),points:cmd.points!,archived:false});
 }else if(cmd.type==='archiveTask'){
  const room=writableRoom(state,cmd.classId),task=state.tasks.find(t=>t.id===cmd.taskId&&t.classId===room.id);assert(task&&typeof cmd.archived==='boolean','找不到這個任務');task.archived=cmd.archived;
 }else if(cmd.type==='reward'){
  const room=writableRoom(state,cmd.classId),seats=classSeats(state,room.id),students=cmd.students as number[];assert(Array.isArray(students)&&students.length>0&&students.length<=room.studentCount&&students.every(n=>seats.includes(n))&&new Set(students).size===students.length,'座號不正確');assert(Number.isInteger(cmd.amount)&&cmd.amount!==0&&Math.abs(cmd.amount!)<=100,'每次請加扣1～100分');assert(cmd.reason===undefined||(typeof cmd.reason==='string'&&cmd.reason.length<=100),'原因最多100字');state.actions.push({id:cmd.id,classId:room.id,semesterId:room.semesterId,date:cmd.date,time:now,kind:'reward',reason:cmd.reason?.trim()||'課堂表現',entries:students.map(student=>({student,amount:cmd.amount!})),undone:false});
 }else if(cmd.type==='confirmRound'||cmd.type==='clearRound'){
  const room=writableRoom(state,cmd.classId),task=state.tasks.find(t=>t.id===cmd.taskId&&t.classId===room.id);assert(task&&!task.archived,'找不到可檢核的項目');const key=roundKey(cmd.date,room.id,task.id),round=getRound(state,cmd.date,room.id,task.id);assert(cmd.roundId===round.id,'這個項目已開始新一輪，請重新整理後操作');
  if(cmd.type==='clearRound')state.rounds[key]={id:cmd.id,number:round.number+1,students:[],confirmed:false};
  else{const seats=classSeats(state,room.id),students=cmd.students as number[];assert(Array.isArray(students)&&students.length>0&&students.length<=room.studentCount&&students.every(n=>seats.includes(n))&&new Set(students).size===students.length,'請選擇有效座號');const selected=[...students].sort((a,b)=>a-b);assert(!round.confirmed,'本輪已確認，請按清除開始新一輪');state.rounds[key]={...round,students:selected,confirmed:true};state.actions.push({id:cmd.id,classId:room.id,semesterId:room.semesterId,date:cmd.date,time:now,kind:'check',reason:`${task.title}・第 ${round.number} 輪`,round:{key,id:round.id},entries:selected.map(student=>({student,amount:task.points})),undone:false});}
 }else if(cmd.type==='undo'){
  const room=writableRoom(state,cmd.classId),action=[...state.actions].reverse().find(a=>a.classId===room.id&&!a.undone);assert(action&&action.id===cmd.actionId,'紀錄已有更新，請重新確認該班最後一筆操作');action.undone=true;if(action.round&&state.rounds[action.round.key]?.id===action.round.id)state.rounds[action.round.key]={...state.rounds[action.round.key],students:[],confirmed:false};
 }else throw new Error('不支援的操作');
 state.applied.push(cmd.id);return state;
}
