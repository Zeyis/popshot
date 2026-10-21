const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
const activityCode=fs.readFileSync('csg-inventory/activity-log.js','utf8');
const autocompleteCode=fs.readFileSync('csg-inventory/eiko-autocomplete.js','utf8');
assert(html.includes('id="activityCategory"'));
assert(html.includes('src="activity-log.js"'));
assert(html.includes('id="eikoPartSuggestions"'));
assert(html.includes('id="eikoCodeSuggestions"'));
assert(html.includes('src="eiko-autocomplete.js"'));
const a={};vm.runInNewContext(activityCode,a);
const sample=[
{actor:'Cason',action:'part',at:'2026-10-21T16:59:03Z',details:{to:62,code:'11033',from:64,part:'EXIT-R-W',created:false,division:'eiko'}},
{actor:'Cason',action:'part',at:'2026-10-21T16:57:59Z',details:{to:4,code:'13794',from:null,part:'VL1-22PS35-FCCT-H',created:true,division:'eiko'}},
{actor:'Cason',action:'Signed in',at:'2026-10-21T16:51:42Z',details:{}},
{actor:'Cason',action:'BJ order dismissed',at:'2026-10-21T14:59:41Z',details:{by:'Cason',id:'x',po:'RNG-261020-U1OGO'}},
{actor:'Inventory administration',action:'EiKO list cleanup',at:'2026-10-20T18:55:36Z',details:{removed_count:2,kept_count:32,removed:[{part:'TEST1',qty:3},{part:'TEST2',qty:4}]}},
{actor:'Cason',action:'cancel',at:'2026-10-20T18:45:53Z',details:{order:'CSG-2026-0003',returned:[{id:2,qty:1,part:'AAL1-MA',division:'eiko'}]}}
];
const d=a.CSGActivity.describe(sample[0]);
assert.equal(d.headline,'Updated EXIT-R-W');
assert.match(d.body,/64 units.*62 units/);
assert.match(d.body,/\(-2\)/);
assert.equal(a.CSGActivity.describe(sample[1]).headline,'Added VL1-22PS35-FCCT-H to EiKO inventory');
assert.equal(a.CSGActivity.describe(sample[2]).headline,'Signed in');
assert.match(a.CSGActivity.describe(sample[3]).headline,/BJ alert/);
const log=a.CSGActivity.render(sample,'','all');
assert.equal(log.total,6);
assert.match(log.html,/View 2 items/);
assert.doesNotMatch(log.html,/\{"to":62/);
assert.equal(a.CSGActivity.render(sample,'exit-r-w','inventory').total,1);
assert.equal(a.CSGActivity.render(sample,'','bj').total,1);
assert.equal(a.CSGActivity.render(sample,'cason','accounts').total,1);
const injection=a.CSGActivity.render([{actor:'<img src=x onerror=alert(1)>',action:'part',at:'',details:{part:'<script>',code:'XX',from:1,to:2}}],'','all');
assert(!injection.html.includes('<script>')&&!injection.html.includes('<img src=x'),'Activity names escape HTML.');
class FakeElement {
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.className='';this.children=[];this.attributes={};this.placeholder='';this._hidden=true;this.listeners={};this.classList={add:(v)=>{if(v==='hidden')this._hidden=true},remove:(v)=>{if(v==='hidden')this._hidden=false},toggle:(v,on)=>{if(v==='hidden')this._hidden=!!on},contains:(v)=>v==='hidden'?this._hidden:false};}
 setAttribute(k,v){this.attributes[k]=v}
 append(...xs){this.children.push(...xs)}
 appendChild(x){this.children.push(x)}
 replaceChildren(...xs){this.children=[...xs]}
 addEventListener(k,cb){this.listeners[k]=cb}
 querySelectorAll(q){return this.children.filter(x=>x.tagName==='button')}
 scrollIntoView(){}
 focus(){this.focused=true}
 closest(){return null}
}
const ids=['editPart','editCode','editDesc','editQty','editId','eikoPartSuggestions','eikoCodeSuggestions','eikoLookupInfo','eikoCatalogLookupHint'];
const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
elements.editId.value='0';elements.editQty.value='7';
const callbacks=[];
let apiCount=0,openedId=0;
const runtime={
 document:{getElementById:id=>elements[id]||null,createElement:tag=>{const e=new FakeElement();e.tagName=tag;return e},addEventListener(){}},
 editingDivision:'eiko',activeTab:'part', inventoryOf:()=>[],
 openPart:id=>{openedId=id},
 bjApi:async (action,{q})=>{apiCount++;assert.equal(action,'catalog');assert.equal(q,'TWP1');return {scope:'live_public_eiko_catalog',products:[{part_number:'TWP1-PS80-FCCT-V',ordering_code:'13661',description:'Wallpack'}]};},
 setTimeout:(fn)=>{callbacks.push(fn);return callbacks.length},
 clearTimeout:()=>{},console,
};
runtime.window=runtime;
vm.createContext(runtime);vm.runInContext(autocompleteCode,runtime);
(async()=>{
 elements.editPart.value='TWP1';
 runtime.eikoSuggestInput('part');
 assert.equal(callbacks.length,1,'Typing starts a debounced lookup.');
 callbacks.shift()();
 await new Promise(setImmediate);
 assert.equal(apiCount,1);
 assert.equal(elements.eikoPartSuggestions._hidden,false,'Dropdown should be visible.');
 assert(elements.eikoPartSuggestions.children.some(x=>x.tagName==='button'),'Dropdown contains a selectable product.');
 runtime.eikoSuggestPick(0);
 assert.equal(elements.editPart.value,'TWP1-PS80-FCCT-V');
 assert.equal(elements.editCode.value,'13661');
 assert.equal(elements.editDesc.value,'Wallpack');
 assert.equal(elements.editQty.value,'7','Choosing a catalog entry must NOT modify stock count');
 runtime.editingDivision='voltec';
 runtime.eikoLookupReset();
 runtime.eikoSuggestInput('part');
 assert.equal(callbacks.length,0,'Voltec should not query EiKO catalog.');
 assert.equal(openedId,0);
 console.log('Readable activity logs and EiKO live SKU autocomplete passed; quantity untouched.');
})().catch(e=>{console.error(e);process.exitCode=1});
