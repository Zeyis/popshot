const urls=[
 'https://www.eiko.com/search?page=1',
 'https://www.eiko.com/search?q=LH1',
 'https://www.eiko.com/api/items?q=LH1&limit=3&fieldset=search'
];
(async()=>{
 for(const u of urls){
  try{
   const res=await fetch(u,{signal:AbortSignal.timeout(9000),headers:{'user-agent':'Mozilla/5.0 (CSG warehouse catalog reference research)'}});
   const s=await res.text();
   const i=s.indexOf('ORDER CODE');
   const j=s.toUpperCase().indexOf('SKU:');
   console.log(JSON.stringify({url:u,status:res.status,contentType:res.headers.get('content-type'),size:s.length,orderCodeMatches:(s.match(/ORDER CODE/g)||[]).length,sampleOrder:i>=0?s.slice(i-150,i+200).replace(/\s+/g,' '):null,sampleSKU:j>=0?s.slice(j-100,j+100).replace(/\s+/g,' '):null,hasNext:s.includes('__NEXT_DATA__'),hasNetSuite:s.includes('itemid')}));
  }catch(e){console.log(JSON.stringify({url:u,error:String(e)}))}
 }
})();
(async()=>{
 const url="https://www.eiko.com/api/items?q=LH1&limit=2&fieldset=search";
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(9500)});
  const d=await r.json();
  console.log('EiKO PUBLIC API TOPLEVEL',JSON.stringify(Object.keys(d)));
  const rows=d.items||d.data?.items||d.records||[];
  console.log('EiKO PUBLIC API TOTAL',d.total||d.totalRecords||d.total_results||d.item_count||'not disclosed');
  console.log('EiKO PUBLIC API FIRST ITEM',JSON.stringify(rows[0]||d).slice(0,3400));
 }catch(e){console.log('EiKO PUBLIC API PARSE ERROR',String(e))}
})();
