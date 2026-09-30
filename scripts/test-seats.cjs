const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let cell='',locked=false,counter=0;
const range={getValue:()=>cell,setValue:v=>{assert(locked);cell=v;}};
const sheet={getRange:()=>range};
const ctx={console,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-key'})},
 LockService:{getScriptLock:()=>({waitLock:()=>{assert(!locked);locked=true},hasLock:()=>locked,releaseLock:()=>{locked=false}})},
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>cell?sheet:null,insertSheet:()=>sheet}),flush:()=>assert(locked)},
 Utilities:{getUuid:()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
const call=d=>ctx.seatResponse_(d);
assert.equal(call({action:'status'}).state,null);
assert.equal(call({action:'setup',key:'wrong'}).ok,false);
let setup={action:'setup',key:'test-key',requestId:'request-1234567890',round:'',cols:6,rows:5,numbers:Array.from({length:27},(_,i)=>i+1)};
let r=call(setup);assert(r.ok);const initial=r.state;assert.equal(call(setup).state.round,initial.round);
assert.equal(call({action:'status'}).state.students[0].code,undefined);
assert.equal(call({action:'draw',round:initial.round,num:1,code:'wrong'}).ok,false);
const seats=new Set();
for(const s of initial.students){const req={action:'draw',round:initial.round,num:s.num,code:s.code};const a=call(req);assert(a.ok);assert.equal(call(req).seat,a.seat);seats.add(a.seat);assert.equal(a.state.students[0].code,undefined);}
assert.equal(seats.size,27); assert(Math.max(...seats) === 27);
assert(call({action:'toggle',key:'test-key',round:initial.round,open:false}).ok);
assert(call({action:'draw',round:initial.round,num:1,code:initial.students[0].code}).ok);
assert.equal(call({...setup,round:initial.round,requestId:'another-123456789',numbers:[1,1]}).ok,false);
let next=call({...setup,round:initial.round,requestId:'another-123456789'}).state;
assert.equal(call({action:'draw',round:initial.round,num:1,code:initial.students[0].code}).ok,false);
call({action:'toggle',key:'test-key',round:next.round,open:false});
assert.equal(call({action:'draw',round:next.round,num:1,code:next.students[0].code}).ok,false);
assert.equal(call({...setup,round:initial.round,requestId:'stale-12345678900'}).ok,false);
assert(!locked);console.log('PASS: 27 unique assignments, retries, code privacy, authorization, round replacement, pause, stale requests, lock-protected writes.');
