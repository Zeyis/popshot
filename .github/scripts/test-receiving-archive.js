const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const script=fs.readFileSync('csg-inventory/receiving.js','utf8');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
assert(html.includes('the original photo or PDF is saved securely with the receipt'));
assert(html.includes('Receiving History'));
assert(script.includes("action:'view_document'"));
assert(script.includes("form.append('document',documentFile,documentFile.name)"));
const calls=[],elements={receivingHistory:{innerHTML:''}};
const context={
 token:'authenticated-test-session-01234567890123456789',stateVersion:12,
 FormData,Blob,console,db:{receipts:[]},
 $:id=>elements[id]||null,
 E:v=>String(v).replaceAll('<','&lt;'),
 dateTime:s=>s,
 fetch:async (url,options)=>{
  calls.push({url,options});
  return {ok:true,status:200,json:async()=>({ok:true})};
 }
};
vm.createContext(context);
vm.runInContext(script,context);
(async()=>{
 const file=new Blob(['SIMULATED-PICTURE'],{type:'image/jpeg'});
 await context.receivingCall({action:'receive',supplier:'EiKO',reference:'PL-001'},file);
 assert.equal(calls.length,1);
 assert(calls[0].options.body instanceof FormData);
 assert(!('content-type' in calls[0].options.headers),'Browser must generate multipart boundary');
 const form=calls[0].options.body;
 const payload=JSON.parse(form.get('payload'));
 assert.equal(payload.action,'receive');
 assert.equal(payload.version,12);
 assert.equal(payload.token,context.token);
 assert.equal(form.get('document').size,file.size);
 await context.receivingCall({action:'view_document',id:'abc',download:false});
 assert.equal(calls.length,2);
 assert.equal(calls[1].options.headers['content-type'],'application/json');
 assert.equal(JSON.parse(calls[1].options.body).action,'view_document');
 context.db.receipts=[{id:'abc',supplier:'EiKO',reference:'PL-001',receivedAt:'2026-11-10',receivedBy:'Cason',fileName:'photo.jpg',status:'posted',totalUnits:6,lines:[],document:{path:'abc/packing-list.jpg',name:'photo.jpg'}}];
 context.receivingHistory();
 assert(elements.receivingHistory.innerHTML.includes('View saved photo / PDF'));
 assert(elements.receivingHistory.innerHTML.includes('Download original'));
 context.db.receipts[0].document=null;context.receivingHistory();
 assert(elements.receivingHistory.innerHTML.includes('No original photo/PDF archived'));
 assert(!elements.receivingHistory.innerHTML.includes('View saved photo / PDF'));
 console.log('Receiving document archive UI and multipart upload checks passed.');
})().catch(err=>{console.error(err);process.exitCode=1});
