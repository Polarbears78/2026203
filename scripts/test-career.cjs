const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let cell='',locked=false,table=null;
const sheet={getRange:(r,c,n,m)=>r===1?{getValue:()=>cell,setValue:v=>{assert(locked);cell=v;}}:{clearContent:()=>{},setValues:v=>{assert(locked);assert.equal(v.length,n);table=v;}}};
const ctx={console,PropertiesService:{getScriptProperties:()=>({getProperty:()=>'test-key'})},
 LockService:{getScriptLock:()=>({waitLock:()=>{assert(!locked);locked=true},hasLock:()=>locked,releaseLock:()=>{locked=false}})},
 SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:()=>cell?sheet:null,insertSheet:()=>sheet}),flush:()=>assert(locked)},
 Utilities:{getUuid:()=>'x'},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('Code.gs','utf8'),ctx);
const call=d=>ctx.careerResponse_(d),K={key:'test-key'};
let r=call({action:'status'});assert(r.ok);assert.equal(r.mode,'career');assert.equal(r.state.open,false);assert.equal(r.state.jobs.length,9);
assert.equal(call({action:'choose',num:1,name:'가',p3:0,p4:1}).ok,false);           // 닫힘
assert.equal(call({action:'toggle',key:'wrong',open:true}).ok,false);
assert(call({action:'toggle',...K,open:true}).ok);
for(const bad of [{num:0},{num:28},{num:1.5},{name:''},{p3:9},{p4:-1},{p3:2,p4:2},{p3:undefined}])
  assert.equal(call({action:'choose',num:1,name:'가',p3:0,p4:1,...bad}).ok,false);
r=call({action:'choose',num:1,name:'가',p3:0,p4:1});assert.deepEqual(r.mine,{p3:0,p4:1});
assert.equal(r.state.picks[0].name,undefined);                                      // 이름 비공개
assert.deepEqual(call({action:'choose',num:1,name:'가',p3:5,p4:6}).mine,{p3:0,p4:1}); // 변경 불가
assert(call({action:'choose',num:2,name:'나',p3:0,p4:2}).ok);
assert(call({action:'choose',num:3,name:'다',p3:0,p4:3}).ok);
r=call({action:'choose',num:4,name:'라',p3:0,p4:4});assert.equal(r.ok,false);assert(/3교시.*마감/.test(r.message)); // 정원 3
assert.equal(call({action:'status'}).state.picks.length,3);                         // 거부 시 부분 저장 없음
// 27명 전원: i번은 3교시 i%9, 4교시 (i+1)%9 → 직업·교시별 정확히 3명
call({action:'resetAll',...K});call({action:'toggle',...K,open:true});
for(let i=1;i<=27;i++)assert(call({action:'choose',num:i,name:'학생'+i,p3:i%9,p4:(i+1)%9}).ok);
r=call({action:'adminStatus',...K});assert.equal(r.state.picks.length,27);assert.equal(r.state.picks[0].name,'학생1');
for(const p of ['p3','p4'])for(let j=0;j<9;j++)assert.equal(r.state.picks.filter(k=>k[p]===j).length,3);
assert.equal(table.length,28);assert.equal(table[1].slice(0,4).join(),'1,학생1,공예 디자이너,마술사');
assert.equal(call({action:'reset',key:'no',num:5}).ok,false);
assert(call({action:'reset',...K,num:5}).ok);assert.equal(call({action:'reset',...K,num:5}).ok,false);
assert(call({action:'choose',num:5,name:'재신청',p3:5,p4:6}).ok);                    // 초기화된 자리 재신청
assert(call({action:'toggle',...K,open:false}).ok);
assert.deepEqual(call({action:'choose',num:5,name:'x',p3:1,p4:2}).mine,{p3:5,p4:6}); // 마감 후에도 조회
assert.equal(call({action:'nope'}).ok,false);assert(!locked);
console.log('PASS: closed by default, admin auth, input validation, cap 3 per job·period, no partial save, no re-pick, name privacy, 27 full allocation, sheet table, individual reset.');
