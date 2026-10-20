/* CSG Packing List Receiving — review-first inventory workflow. */
'use strict';
const RECEIVING_API='https://rqjjwtdswzljaeoxyorq.supabase.co/functions/v1/csg-receiving';
let receivingLines=[],receivingFile=null,receivingObjectURL=null,receivingBusy=false;
function receiveMessage(msg,bad=false){
 const el=$('receivingStatus');if(!el)return;
 el.textContent=msg;el.className='alert'+(bad?' error':'');el.classList.remove('hidden');
}
function receivingDefaultDivision(){return $('receiveDivision')?.value==='eiko'?'eiko':'voltec'}
function receivingIsPdf(file){return file?.type==='application/pdf'||(file?.name||'').toLowerCase().endsWith('.pdf')}
function receivingShowPreview(file){
 if(receivingObjectURL){URL.revokeObjectURL(receivingObjectURL)}
 receivingObjectURL=URL.createObjectURL(file);
 const box=$('receivingFilePreview');box.innerHTML='';
 const label=document.createElement('p');label.className='muted';label.textContent=file.name+' · '+Math.ceil(file.size/1024)+' KB';box.appendChild(label);
 if(receivingIsPdf(file)){
  const link=document.createElement('a');link.href=receivingObjectURL;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open selected PDF for comparison';box.appendChild(link);
 }else{
  const image=document.createElement('img');image.src=receivingObjectURL;image.alt='Selected supplier packing list';image.style.cssText='width:100%;max-height:450px;object-fit:contain;background:#f4f5f3;border-radius:9px';box.appendChild(image);
 }
}
async function receivingFileChanged(input){
 const file=input.files?.[0];if(!file)return;
 if(file.size>14*1024*1024){receiveMessage('Please choose a file under 14 MB.',true);return}
 if(!receivingIsPdf(file)&&!file.type.startsWith('image/')&&!/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)){receiveMessage('Please select a photo or PDF.',true);return}
 receivingFile=file;receivingShowPreview(file);$('receivingFileLabel').textContent=file.name;
 await receivingRunScan();
}
async function receivingRunScan(){
 if(!receivingFile||receivingBusy)return;
 receivingBusy=true;$('receivingScanButton').disabled=true;
 try{
  receiveMessage('Reading document…');
  const text=receivingIsPdf(receivingFile)?await receivingPDFText(receivingFile):await receivingImageText(receivingFile);
  $('receivingRawText').value=text;
  const detected=parseReceivingText(text);receivingApplyDetected(detected);
  receivingLines=detected.lines;receivingRenderRows();
  receiveMessage(receivingLines.length?'Detected '+receivingLines.length+' possible items. Confirm all shipped values, pack sizes and SKUs before posting.':'No reliable item lines detected. You can edit the recognized text or enter lines manually.');
 }catch(error){receiveMessage(error.message||'Document reading failed. Enter items manually.',true)}
 finally{receivingBusy=false;$('receivingScanButton').disabled=false;receivingSummary()}
}
function receivingApplyDetected(data){
 if(data.supplier&&!$('receiveSupplier').value)$('receiveSupplier').value=data.supplier;
 if(data.reference&&!$('receiveReference').value)$('receiveReference').value=data.reference;
 if(data.date&&!$('receiveDate').value)$('receiveDate').value=data.date;
 if(data.supplier)$('receiveDivision').value=data.division;
}
function receivingParseEditedText(){
 const detected=parseReceivingText($('receivingRawText').value);
 if(!detected.lines.length){receiveMessage('No clear item numbers detected. You can add lines manually.',true);return}
 if(receivingLines.length&&!confirm('Replace the current receiving lines with newly detected rows?'))return;
 receivingApplyDetected(detected);receivingLines=detected.lines;receivingRenderRows();
 receiveMessage('Detected '+receivingLines.length+' item rows. Verify and correct each quantity before posting.');
}
function receivingAddManual(){
 const part=$('receivingNewPart').value.trim().toUpperCase();
 receivingLines.push({division:receivingDefaultDivision(),part,description:'',code:'',shipped:'',pack:1,mode:'units',warning:'Manually added.'});
 $('receivingNewPart').value='';receivingRenderRows();
}
function receivingRemove(i){receivingLines.splice(i,1);receivingRenderRows()}
function receivingChange(i,key,value){
 const line=receivingLines[i];if(!line)return;
 if(key==='pack'||key==='shipped')line[key]=value===''?'':Number(value);else line[key]=value;
 receivingSummary();
}
function receivingExisting(line){
 const normal=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
 return inventoryOf(line.division).find(x=>normal(x.part)===normal(line.part)||(line.code&&x.code&&normal(x.code)===normal(line.code)));
}
function receivingValid(line){
 return !!String(line.part||'').trim()&&['voltec','eiko'].includes(line.division)&&['units','cases'].includes(line.mode)
 && Number.isSafeInteger(Number(line.shipped))&&Number(line.shipped)>0&&Number.isSafeInteger(Number(line.pack))&&Number(line.pack)>0;
}
function receivingUnits(line){return receivingValid(line)?Number(line.shipped)*(line.mode==='cases'?Number(line.pack):1):0}
function receivingRenderRows(){
 const target=$('receivingLines');
 target.innerHTML=receivingLines.map((r,i)=>{
  const existing=receivingExisting(r);
  return '<div class="card"><div class="section-head"><div><strong>Item '+(i+1)+'</strong> <span class="tag">'+(existing?'In inventory':'New SKU — creates on approval')+'</span></div><button class="slim danger" onclick="receivingRemove('+i+')">Remove</button></div>'
  +'<div class="grid2"><div><label>Item # / SKU</label><input value="'+E(r.part)+'" onchange="receivingChange('+i+',\'part\',this.value);receivingRenderRows()" placeholder="08-00743"></div>'
  +'<div><label>Inventory brand</label><select onchange="receivingChange('+i+',\'division\',this.value);receivingRenderRows()"><option value="voltec"'+(r.division==='voltec'?' selected':'')+'>Voltec</option><option value="eiko"'+(r.division==='eiko'?' selected':'')+'>EiKO</option></select></div></div>'
  +'<label>Supplier description</label><input value="'+E(r.description)+'" onchange="receivingChange('+i+',\'description\',this.value)" placeholder="Description">'
  +'<div class="grid3"><div><label>Actually shipped</label><input type="number" min="1" step="1" inputmode="numeric" value="'+E(r.shipped)+'" oninput="receivingChange('+i+',\'shipped\',this.value)" placeholder="Verify on paper"></div>'
  +'<div><label>Shipped as</label><select onchange="receivingChange('+i+',\'mode\',this.value)"><option value="cases"'+(r.mode==='cases'?' selected':'')+'>Cases / cartons</option><option value="units"'+(r.mode==='units'?' selected':'')+'>Individual units</option></select></div>'
  +'<div><label>Units per case</label><input type="number" min="1" step="1" inputmode="numeric" value="'+E(r.pack)+'" oninput="receivingChange('+i+',\'pack\',this.value)"></div></div>'
  +'<p class="muted">'+E(r.warning||'Compare with original document.')+'</p>'
  +'<div class="row" style="justify-content:space-between"><strong>Units to add: <span id="receivingQty'+i+'">—</span></strong><span class="muted" id="receivingCurrent'+i+'"></span></div></div>';
 }).join('')||'<div class="card">No parts yet. Scan a packing list or add parts manually.</div>';
 receivingSummary();
}
function receivingSummary(){
 const el=$('receivingSummary');if(!el)return;
 let total=0,invalid=0,newCount=0;
 receivingLines.forEach((r,i)=>{
  const qty=receivingUnits(r),existing=receivingExisting(r),valid=receivingValid(r)&&qty<=1000000;
  if(valid)total+=qty;else invalid++;
  if(!existing)newCount++;
  if($('receivingQty'+i))$('receivingQty'+i).textContent=valid?qty.toLocaleString():'Needs review';
  if($('receivingCurrent'+i))$('receivingCurrent'+i).textContent=existing?'Stock: '+existing.qty+' → '+(existing.qty+qty):'New inventory part';
 });
 el.textContent=receivingLines.length+' lines · '+total.toLocaleString()+' units to receive · '+newCount+' new item(s)'+(invalid?' · '+invalid+' incomplete':'');
 $('receivePostButton').disabled=receivingBusy||receivingLines.length===0||invalid>0;
}
async function receivingCall(requestBody){
 const r=await fetch(RECEIVING_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token,version:stateVersion,...requestBody}),cache:'no-store'});
 const data=await r.json().catch(()=>({error:'Could not contact receiving service.'}));
 if(!r.ok){const error=Error(data.error||'Receiving failed.');error.status=r.status;error.conflict=!!data.conflict;throw error}
 return data;
}
async function receivingPost(){
 if(receivingBusy)return;
 const supplier=$('receiveSupplier').value.trim(),reference=$('receiveReference').value.trim();
 if(!supplier||!reference){receiveMessage('Supplier and packing-list / shipment number are required to prevent duplicates.',true);return}
 if(!receivingLines.length||receivingLines.some(r=>!receivingValid(r)||receivingUnits(r)>1000000)){receiveMessage('Check each SKU, shipped number, cases vs units, and pack size before posting.',true);return}
 const units=receivingLines.reduce((sum,line)=>sum+receivingUnits(line),0);
 if(!confirm('POST RECEIVING TO LIVE INVENTORY?\n\nSupplier: '+supplier+'\nPacking list #: '+reference+'\n'+receivingLines.length+' items / '+units.toLocaleString()+' total units.\n\nEvery quantity will ADD to the current stock, not replace it.\n\nConfirm you checked shipped numbers and units per case against the original document.'))return;
 receivingBusy=true;receivingSummary();
 try{
  const response=await receivingCall({action:'receive',confirmed:true,supplier,reference,documentDate:$('receiveDate').value,fileName:receivingFile?.name||'Manual entry',notes:$('receiveNotes').value,lines:receivingLines.map(r=>({division:r.division,part:r.part,code:r.code,description:r.description,mode:r.mode,shipped:Number(r.shipped),pack:Number(r.pack)}))});
  receivingLines=[];receivingFile=null;
  if(receivingObjectURL){URL.revokeObjectURL(receivingObjectURL);receivingObjectURL=null}
  for(const id of ['receiveSupplier','receiveReference','receiveDate','receiveNotes','receivingRawText','receivingNewPart'])$(id).value='';
  $('receivingFileLabel').textContent='No document selected';$('receivingFilePreview').innerHTML='';
  $('receivingUpload').value='';$('receivingCamera').value='';
  await refresh();
  receivingRenderRows();receivingHistory();
  receiveMessage('Received '+response.receipt.totalUnits+' units. Packing list '+response.receipt.reference+' was saved to inventory history.');
 }catch(error){receiveMessage(error.message,true);if(error.conflict)await refresh().catch(()=>{})}
 finally{receivingBusy=false;receivingSummary()}
}
function receivingHistory(){
 const host=$('receivingHistory');if(!host)return;
 host.innerHTML=(db.receipts||[]).slice(0,70).map(r=>'<div class="card"><div class="section-head"><div><strong>'+E(r.supplier)+' · '+E(r.reference)+'</strong><p class="muted" style="margin:4px 0">'+dateTime(r.receivedAt)+' · '+E(r.receivedBy)+' · '+E(r.fileName||'Manual')+'</p></div><span class="badge'+(r.status==='reversed'?' cancelled':'')+'">'+(r.status==='reversed'?'Reversed':'Received')+'</span></div>'
 +'<p><strong>'+Number(r.totalUnits).toLocaleString()+' units</strong> · '+r.lines.length+' lines</p><details><summary class="muted" style="cursor:pointer">View received items</summary><div style="margin:10px 0">'+r.lines.map(l=>'<p class="muted">'+E(l.division==='voltec'?'Voltec':'EiKO')+' · '+E(l.part)+' · '+Number(l.qty)+' units ('+Number(l.shipped)+' '+E(l.mode)+(l.mode==='cases'?' × '+l.pack+'/case':'')+')</p>').join('')+'</div></details>'
 +(r.status==='posted'?'<button class="slim danger" onclick="receivingReverse(\''+E(r.id)+'\')">Reverse this receipt</button>':'')+'</div>').join('')||'<div class="card">No received packing lists yet.</div>';
}
async function receivingReverse(id){
 if(receivingBusy||!confirm('Reverse this receiving record and remove all its posted units from stock? This only works while enough stock remains.'))return;
 receivingBusy=true;
 try{
  const r=await receivingCall({action:'reverse',id});
  await refresh();receivingHistory();receiveMessage('Receipt '+r.receipt.reference+' reversed: '+r.receipt.totalUnits+' units removed.');
 }catch(error){receiveMessage(error.message,true);if(error.conflict)await refresh().catch(()=>{})}
 finally{receivingBusy=false}
}
function renderReceiving(){receivingHistory();receivingSummary()}
