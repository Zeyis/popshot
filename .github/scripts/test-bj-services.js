const assert=require('node:assert/strict');
(async()=>{
 const base='https://rqjjwtdswzljaeoxyorq.supabase.co/functions/v1/csg-bj';
 const r=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:'invalid',action:'list'}),signal:AbortSignal.timeout(12000)});
 const data=await r.json();
 assert.equal(r.status,401,'BJ order list must require a real staff login');
 assert.match(data.error||'',/sign in|session/i);
 console.log('BJ API security smoke test passed: unauthenticated access rejected.');
 const url='https://www.eiko.com/api/items?q=LH1&limit=3&fieldset=search';
 const e=await fetch(url,{signal:AbortSignal.timeout(13000)});
 const j=await e.json();
 assert(e.ok&&Array.isArray(j.items),'EiKO live public catalog must return product items');
 assert(j.items.some(x=>x.itemid&&x.custitem_ordercode),'EiKO results must contain SKU and ordering code');
 console.log('Live EiKO catalog smoke test passed:',j.items.length,'products and searchable ordering codes.');
})().catch(e=>{console.error(e);process.exit(1)});
