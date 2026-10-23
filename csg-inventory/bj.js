/* BJ walk-in purchasing requests. EiKO supplier stock is never adjusted by this feature. */
'use strict';
const BJ_API='https://rqjjwtdswzljaeoxyorq.supabase.co/functions/v1/csg-bj';
let bjOrders=[],bjOpenCount=0,bjCanDismiss=false,bjLines=[],bjEditingId=null,bjCatalogResults=[],bjPolling=false,bjFormLoaded=false,bjFormStaff=null,bjPreviouslySeen=null,bjSearchTimer=null;
let bjCurrentPrintID=null,bjCurrentPrintOrder=null;
const bjField=id=>$(id);
const bjEsc=typeof E==='function'?E:(x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
function bjToast(msg,error=false){const e=bjField('bjStatus');e.className='alert'+(error?' error':'');e.textContent=msg;e.classList.remove('hidden')}
function bjClearToast(){bjField('bjStatus')?.classList.add('hidden')}
async function bjApi(action,more={}){
 const res=await fetch(BJ_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,action,...more}),cache:'no-store'});
 const body=await res.json().catch(()=>({error:'Could not contact order service.'}));
 if(!res.ok){const error=Error(body.error||'BJ order service error');error.status=res.status;throw error}
 return body;
}
function bjDraftKey(){return 'csg_bj_draft_'+(staff||'staff')}
function bjLineDefault(){return {qty:'',part:'',code:'',description:'',price:'',per:'EA',location:'',source:'ours',note:''}}
function bjFormState(){
 return {buyer:bjField('bjBuyer').value,shipVia:bjField('bjShipVia').value,fob:bjField('bjFOB').value,terms:bjField('bjTerms').value,dateRequired:bjField('bjRequiredDate').value,vendorAddress:bjField('bjVendorAddress').value,shipToAddress:bjField('bjShipToAddress').value,notes:bjField('bjNotes').value,lines:bjLines};
}
function bjSaveLocal(){
 try{if(!bjEditingId)localStorage.setItem(bjDraftKey(),JSON.stringify(bjFormState()))}catch{}
}
function bjRestoreDraft(){
 if(bjFormLoaded)return;
 bjFormLoaded=true;
 let old=null;
 try{old=JSON.parse(localStorage.getItem(bjDraftKey())||'null')}catch{}
 bjAssignFields(old||{});
 bjLines=Array.isArray(old?.lines)&&old.lines.length?old.lines:[bjLineDefault()];
 bjRenderLines();
}
function bjAssignFields(record={}){
 bjField('bjBuyer').value=record.buyer||'';
 bjField('bjShipVia').value=record.shipVia||record.ship_via||'';
 bjField('bjFOB').value=record.fob||'';
 bjField('bjTerms').value=record.terms||'';
 bjField('bjRequiredDate').value=record.dateRequired||record.date_required||'';
 bjField('bjVendorAddress').value=record.vendorAddress||record.vendor_address||'';
 bjField('bjShipToAddress').value=record.shipToAddress||((record.ship_to_address||'').includes('113 45th Place North')?'':record.ship_to_address)||'';
 bjField('bjNotes').value=record.notes||'';
 bjField('bjEditLabel').textContent=record.po_number?'Editing '+record.po_number:'New walk-in request · PO number generated when submitted';
}
function bjResetForm(){
 if(!confirm('Start a blank BJ order? Any unsent changes on this device will be cleared.'))return;
 bjEditingId=null;bjAssignFields({});bjLines=[bjLineDefault()];
 localStorage.removeItem(bjDraftKey());bjRenderLines();bjClearToast();
}
function bjChangeRow(i,prop,value){
 if(!bjLines[i])return;
 bjLines[i][prop]=value;
 bjSaveLocal();
}
function bjAddLine(item=null){
 if(bjLines.length>=22){bjToast('This form matches the 22-line sheet. Create a second BJ order if you need more rows.',true);return}
 if(item){const blank=bjLines.findIndex(r=>!r.part&&!r.code&&!r.qty);
   if(blank>=0){bjLines[blank]={...bjLineDefault(),...item};bjRenderLines();bjSaveLocal();return}}
 bjLines.push({...bjLineDefault(),...(item||{})});bjRenderLines();bjSaveLocal();
}
function bjRemoveLine(i){bjLines.splice(i,1);if(!bjLines.length)bjLines.push(bjLineDefault());bjRenderLines();bjSaveLocal()}
function bjRenderLines(){
 const tb=bjField('bjItemRows');if(!tb)return;
 tb.innerHTML=bjLines.map((l,i)=>'<tr>'
 +'<td data-label="#"><strong>'+(i+1)+'</strong></td>'
 +'<td data-label="Qty" class="qty"><input type="number" min="1" step="1" inputmode="numeric" value="'+bjEsc(l.qty)+'" oninput="bjChangeRow('+i+',\'qty\',this.value)" aria-label="Quantity item '+(i+1)+'"></td>'
 +'<td data-label="EiKO ordering code" class="code"><input value="'+bjEsc(l.code)+'" autocomplete="off" oninput="bjChangeRow('+i+',\'code\',this.value)" placeholder="Code"></td>'
 +'<td data-label="EiKO part number" class="sku"><input value="'+bjEsc(l.part)+'" autocomplete="off" oninput="bjChangeRow('+i+',\'part\',this.value)" placeholder="Part / SKU"></td>'
 +'<td data-label="Description" class="description"><input value="'+bjEsc(l.description)+'" oninput="bjChangeRow('+i+',\'description\',this.value)" placeholder="Description"></td>'
 +'<td data-label="Price (optional)" class="price"><input type="number" min="0" step="0.01" inputmode="decimal" value="'+bjEsc(l.price)+'" oninput="bjChangeRow('+i+',\'price\',this.value)" placeholder="—"></td>'
 +'<td data-label="Per" class="per"><input value="'+bjEsc(l.per)+'" oninput="bjChangeRow('+i+',\'per\',this.value)" placeholder="EA"></td>'
 +'<td data-label="Warehouse location" class="location"><input value="'+bjEsc(l.location)+'" oninput="bjChangeRow('+i+',\'location\',this.value)" placeholder="1-6-A1"></td>'
 +'<td data-label="Source" class="source"><select onchange="bjChangeRow('+i+',\'source\',this.value)"><option value="ours"'+(l.source!=='eiko'?' selected':'')+'>Our Warehouse</option><option value="eiko"'+(l.source==='eiko'?' selected':'')+'>EiKO Warehouse</option></select></td>'
 +'<td data-label="Optional note" class="note"><input value="'+bjEsc(l.note||'')+'" maxlength="220" oninput="bjChangeRow('+i+',\'note\',this.value)" placeholder="Optional note"></td>'
 +'<td data-label="Remove" class="action"><button class="slim danger" onclick="bjRemoveLine('+i+')" title="Remove line">×</button></td></tr>').join('');
 bjField('bjLineCount').textContent=bjLines.filter(l=>l.part||l.code).length+' of 22 lines';
}
function bjQueueUI(){
 const queue=bjField('bjQueueList');if(!queue)return;
 queue.innerHTML=bjOrders.map(o=>{
  const canEdit=o.status==='needs_po'&&(staff===o.entered_by||bjCanDismiss);
  return '<article class="bj-order '+(o.status==='needs_po'?'status-open':'status-done')+'"><div class="section-head"><div><strong>'+bjEsc(o.po_number)+'</strong> <span class="tag">'+(o.status==='needs_po'?'NEEDS EIKO PO':'DISMISSED')+'</span><div class="muted">'+bjEsc(o.entered_by)+' · '+dateTime(o.created_at)+' · '+(o.lines?.length||0)+' items</div></div>'
  +'<div class="row"><button class="slim primary" onclick="bjShowPrint(\''+bjEsc(o.id)+'\')">View / Print</button>'
  +(canEdit?'<button class="slim" onclick="bjEdit(\''+bjEsc(o.id)+'\')">Edit</button>':'')
  +(o.status==='needs_po'&&bjCanDismiss?'<button class="slim danger" onclick="bjDismiss(\''+bjEsc(o.id)+'\')">Dismiss alert</button>':'')
  +'</div></div><div class="muted" style="margin-top:6px">Buyer: '+bjEsc(o.buyer)+' · '+bjEsc(o.vendor)+' · Created '+dateText(o.order_date)+'</div></article>';
 }).join('')||'<div class="card">No BJ orders submitted yet.</div>';
 const open=bjOrders.filter(o=>o.status==='needs_po');
 bjField('bjQueueHeading').textContent=open.length+' BJ request'+(open.length===1?'':'s')+' waiting for an EiKO PO';
}
async function bjPoll(){
 if(!token||bjPolling)return;
 bjPolling=true;
 try{
  const res=await bjApi('list');
  const newLatest=res.orders.find(o=>o.status==='needs_po')?.id||null;
  const was=bjPreviouslySeen;
  bjOrders=res.orders;bjOpenCount=res.open;bjCanDismiss=res.canDismiss;
  const alert=bjField('bjAlert'),badge=bjField('bjNavBadge');
  badge.textContent=res.open;badge.classList.toggle('hidden',res.open===0);
  alert.classList.toggle('show',res.open>0);
  bjField('bjAlertText').textContent=res.open+' BJ walk-in order'+(res.open===1?'':'s')+' need'+(res.open===1?'s':'')+' an EiKO PO.';
  if(res.open&&bjPreviouslySeen!==null&&newLatest!==was&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&!document.hidden){
   try{new Notification('BJ order waiting',{body:'A BJ walk-in request needs an EiKO purchase order.'})}catch{}
  }
  bjPreviouslySeen=newLatest;
  if(typeof bjQueueUI==='function')bjQueueUI();
 }catch(e){if(e.status!==401&&bjField('bjQueueError'))bjField('bjQueueError').textContent='BJ alerts could not sync. Retry from the tab.'}
 finally{bjPolling=false}
}
function bjEnableDesktopAlerts(){
 if(!('Notification' in window)){bjToast('This browser does not support desktop notifications. In-app alerts still work.',true);return}
 Notification.requestPermission().then(p=>bjToast(p==='granted'?'Desktop notifications enabled while the browser is running.':'Desktop notifications are not enabled; in-app alerts remain active.',p!=='granted'));
}
function bjOpenQueue(){tab('bj');bjField('bjOrderQueue')?.scrollIntoView({behavior:'smooth'});bjPoll()}
function bjEdit(id){
 const record=bjOrders.find(x=>x.id===id);if(!record)return;
 if(record.status!=='needs_po'){bjToast('Dismissed orders cannot be edited.',true);return}
 bjEditingId=id;bjAssignFields(record);
 bjLines=record.lines.map(l=>({...l,qty:l.qty??'',price:l.price??''}));bjRenderLines();
 tab('bj');window.scrollTo({top:0,behavior:'smooth'});
 bjToast('Editing saved request '+record.po_number+'. Saving will keep the same PO number.');
}
async function bjSubmit(){
 const lines=bjLines.filter(l=>l.part||l.code||l.qty||l.location);
 if(!lines.length){bjToast('Add at least one EiKO item.',true);return}
 for(let i=0;i<lines.length;i++){
  if(!String(lines[i].code||'').trim()){bjToast('Line '+(i+1)+': enter the EiKO ordering code.',true);return}
  if(!String(lines[i].location||'').trim()){bjToast('Line '+(i+1)+': enter its warehouse location.',true);return}
  if(!Number.isSafeInteger(Number(lines[i].qty))||Number(lines[i].qty)<=0){bjToast('Line '+(i+1)+': enter a positive whole-number quantity.',true);return}
 }
 const body={...bjFormState(),lines,id:bjEditingId};
 if(!confirm((bjEditingId?'Update':'Submit')+' BJ order with '+lines.length+' line(s)? It will notify staff that an EiKO PO needs to be placed. No stock will change.'))return;
 const button=bjField('bjSubmitButton');button.disabled=true;button.textContent='Saving request…';
 try{
  const out=await bjApi(bjEditingId?'update':'create',body);
  bjEditingId=null;bjLines=[bjLineDefault()];bjAssignFields({});bjRenderLines();localStorage.removeItem(bjDraftKey());
  await bjPoll();bjToast('BJ order '+out.order.po_number+' saved and staff alerted. No supplier stock was changed.');
  bjShowPrintObject(out.order);
 }catch(e){bjToast(e.message,true)}
 finally{button.disabled=false;button.textContent='Submit BJ request & notify team'}
}
async function bjDismiss(id){
 if(!bjCanDismiss){bjToast('You must be signed in to dismiss a BJ request.',true);return}
 if(!confirm('Dismiss this BJ notification? The order will remain in history for printing.'))return;
 try{await bjApi('dismiss',{id});await bjPoll();bjToast('BJ alert dismissed. The order remains in history.')}
 catch(e){bjToast(e.message,true)}
}
function bjShowPrintObject(o){
 bjCurrentPrintID=o.id;
 bjCurrentPrintOrder=o;
 bjPreviewOriginalPDF(o);
 bjField('bjPrintLabel').textContent=o.po_number;
 tab('bjprint');
}
function bjShowPrint(id){
 const o=bjOrders.find(x=>x.id===id);if(!o)return;
 bjShowPrintObject(o);
}
function bjGoBack(){tab('bj');bjField('bjOrderQueue')?.scrollIntoView({behavior:'smooth'})}
function bjRender(){
 if(bjFormStaff!==staff){bjFormLoaded=false;bjEditingId=null;bjLines=[];bjFormStaff=staff;}
 if(!bjFormLoaded)bjRestoreDraft();
 const importer=bjField('bjImporter');if(importer)importer.classList.toggle('hidden',staff!=='Cason'&&staff!=='Brent');
 bjQueueUI();
}
function bjSearchDelayed(){
 clearTimeout(bjSearchTimer);
 bjSearchTimer=setTimeout(bjSearchNow,260);
}
async function bjSearchNow(){
 const q=bjField('bjCatalogSearch').value.trim();
 if(q.length<2){bjField('bjCatalogResults').innerHTML='<div class="muted" style="padding:10px">Enter at least 2 characters to search the indexed EiKO catalog.</div>';return}
 try{
  const res=await bjApi('catalog',{q});
  bjCatalogResults=res.products||[];
  const searchInfo=res.scope==='live_public_eiko_catalog'?'Live EiKO public catalog · '+bjCatalogResults.length+' shown'+(res.total?' of '+res.total+' matches':'')+'. Refine your search if needed.':(res.warning||'Showing saved/imported EiKO products.');
  bjField('bjCatalogResults').innerHTML='<div class="muted" style="padding:9px 12px;background:#f4f6f2">'+bjEsc(searchInfo)+'</div>'+bjCatalogResults.map((p,i)=>
   '<div class="bj-suggest"><div style="flex:1;min-width:0"><strong>'+bjEsc(p.part_number)+'</strong> <span class="tag">Code '+bjEsc(p.ordering_code)+'</span><div class="muted">'+bjEsc(p.description||'')+'</div></div><button class="slim" onclick="bjChooseCatalog('+i+')">+ Add</button></div>').join('')
   ||'<div class="muted" style="padding:12px">No matching entries in the indexed catalog. You can still type any EiKO part and ordering code manually, or use EiKO’s official public search.</div>';
 }catch(e){bjField('bjCatalogResults').textContent=e.message}
}
function bjChooseCatalog(i){
 const p=bjCatalogResults[i];if(!p)return;
 bjAddLine({qty:1,part:p.part_number,code:p.ordering_code,description:p.description,location:'',per:'EA',price:''});
 bjField('bjCatalogSearch').value='';bjField('bjCatalogResults').innerHTML='';
}
function bjParseCSV(raw){
 const rows=[],out=[];let fields=[],value='',quoted=false;
 for(let i=0;i<raw.length;i++){
  const c=raw[i];if(quoted){if(c==='"'&&raw[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=false;else value+=c}
  else if(c==='"')quoted=true;else if(c===','||c==='\t'){fields.push(value);value=''}
  else if(c==='\n'||c==='\r'){fields.push(value);if(fields.some(f=>f.trim()))rows.push(fields);fields=[];value='';if(c==='\r'&&raw[i+1]==='\n')i++}
  else value+=c;
 }
 fields.push(value);if(fields.some(x=>x.trim()))rows.push(fields);
 if(!rows.length)return[];
 const headers=rows[0].map(s=>s.toLowerCase().replace(/[^a-z0-9]+/g,''));
 const col=(variants)=>headers.findIndex(h=>variants.some(v=>h===v||h.includes(v)));
 const code=col(['ordercode','orderingcode','eikocode','itemnumber','itemcode']);
 const part=col(['partnumber','partno','sku','productid','productnumber','model']);
 const description=col(['description','productname','details']);
 const url=col(['producturl','url','link']);
 if(code<0||part<0)throw Error('Catalog file needs columns for EiKO ordering code and part number / SKU.');
 for(const r of rows.slice(1)){
  const c=String(r[code]||'').trim(),p=String(r[part]||'').trim();
  if(c&&p)out.push({code:c,part:p,description:description>=0?(r[description]||''):'',url:url>=0?(r[url]||''):''});
 }
 return out;
}
async function bjImportCatalog(input){
 const file=input.files?.[0];if(!file)return;
 if(staff!=='Cason'&&staff!=='Brent'){bjToast('Only Cason or Brent can import the EiKO catalog.',true);return}
 if(file.size>10*1024*1024){bjToast('Please upload a catalog CSV smaller than 10 MB.',true);return}
 try{
  const rows=bjParseCSV(await file.text());
  if(!rows.length)throw Error('No valid SKU/ordering code pairs found.');
  if(!confirm('Import '+rows.length+' EiKO catalog entries for searching? This will not affect inventory or stock quantities.'))return;
  let count=0;
  for(let i=0;i<rows.length;i+=300){
   const res=await bjApi('catalog_import',{rows:rows.slice(i,i+300)});
   count+=res.added;
   bjField('bjImportStatus').textContent='Catalog import: '+Math.min(i+300,rows.length)+' / '+rows.length+' processed';
  }
  bjField('bjImportStatus').textContent='Imported / updated '+count+' ordering codes. You can now search them in BJ Mode.';
  await bjSearchNow();
 }catch(e){bjField('bjImportStatus').textContent=e.message}
 finally{input.value=''}
}
function bjInit(){
 if(!bjField('bjAlert'))return;
 const link=bjField('bjOfficialLink');
 link.href='https://www.eiko.com/search';
 const importBox=bjField('bjImporter');
 if(importBox)importBox.classList.toggle('hidden',staff!=='Cason'&&staff!=='Brent');
 if(token)bjPoll().catch(()=>{});
}
setInterval(()=>{if(token&&!document.hidden)bjPoll().catch(()=>{})},20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)bjPoll().catch(()=>{})});
setTimeout(bjInit,0);
