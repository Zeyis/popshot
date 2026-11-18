/* CSG packing list editor. Saved orders keep original IDs and PO numbers.
   Changing shipped quantities updates inventory through authenticated backend. */
'use strict';
let packingEditDraft=null;
const packingEditFields=['recipient','job','attention','street','city','state','zip','notes','voltecSalesOrder','customerPo','shippingMethod','palletCount'];
function packingEditEscape(v){
 return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function packingEditInitial(order){
 if(!order?.id||order.status==='cancelled')throw Error('Only confirmed packing lists can be edited.');
 return {
  id:order.id,number:order.number,isVoltec:(order.lines||[]).some(l=>l.division==='voltec'),
  recipient:order.recipient||'',job:order.job||'',attention:order.shipAttention||'',
  street:order.shipStreet||'',city:order.shipCity||'',state:order.shipState||'',zip:order.shipZip||'',
  notes:order.notes||'',voltecSalesOrder:order.voltecSalesOrder||'',customerPo:order.customerPo||'',
  shippingMethod:order.shippingMethod==='pallets'?'pallets':'cartons',
  palletCount:order.shippingMethod==='pallets'?String(order.palletCount||''):'',
  lines:(order.lines||[]).map(l=>({
    division:l.division,id:l.id,part:l.part,code:l.code||'',
    ordered:String(l.ordered??l.qty),shipped:String(l.shipped??l.qty),
    casesPulled:l.casesPulled==null?'':String(l.casesPulled),
    casePack:l.casePack==null?'':String(l.casePack),
    perCaseWeightLb:l.perCaseWeightLb==null?'':String(l.perCaseWeightLb),
    originalWeightLb:l.weightLb==null?null:Number(l.weightLb),
    weightEstimated:l.weightEstimated===true,
    weightSource:l.weightSource||'',weightSourceUrl:l.weightSourceUrl||''
  }))
 };
}
function packingEditComputed(draft){
 let ordered=0,shipped=0,cases=0,goodsWeightLb=0,known=0;
 for(const line of draft.lines){
  ordered+=Number(line.ordered)||0;
  shipped+=Number(line.shipped)||0;
  if(line.casesPulled!=='')cases+=Number(line.casesPulled)||0;
  if(line.perCaseWeightLb!==''&&line.casesPulled!==''){
   const w=Number(line.perCaseWeightLb)*Number(line.casesPulled);
   if(Number.isFinite(w)&&w>=0){goodsWeightLb+=w;known++;continue;}
  }
  if(line.perCaseWeightLb===''&&line.originalWeightLb!==null&&line.casesPulled===''){
   goodsWeightLb+=line.originalWeightLb;known++;
  }
 }
 const pallets=draft.shippingMethod==='pallets'?(Number(draft.palletCount)||0):0;
 const tare=Number.isSafeInteger(pallets)&&pallets>=0?pallets*35:0;
 const allKnown=known===draft.lines.length;
 return {ordered,shipped,backordered:ordered-shipped,cases,goodsWeightLb,
  pallets,palletWeightLb:tare,knownWeightLb:goodsWeightLb+tare,allKnown,
  totalWeightLb:allKnown?Math.round((goodsWeightLb+tare)*100)/100:null};
}
function packingEditTextField(label,key,options={}){
 const d=packingEditDraft;
 return '<label>'+packingEditEscape(label)+(options.optional?' <span class="muted">(optional)</span>':'')+
  (options.multiline?'<textarea rows="2" oninput="packingEditSet(\''+key+'\',this.value)">'+packingEditEscape(d[key])+'</textarea>':
  '<input value="'+packingEditEscape(d[key])+'" oninput="packingEditSet(\''+key+'\',this.value)"'+(options.required?' required':'')+'>')+
  '</label>';
}
function packingEditNumberField(label,index,key){
 const value=packingEditDraft.lines[index][key];
 return '<label>'+packingEditEscape(label)+'<input type="number" min="0" step="'+(key==='perCaseWeightLb'?'0.01':'1')+
  '" inputmode="'+(key==='perCaseWeightLb'?'decimal':'numeric')+
  '" value="'+packingEditEscape(value)+'" oninput="packingEditSetLine('+index+',\''+key+'\',this.value)"></label>';
}
function packingEditRender(){
 const d=packingEditDraft,el=document.getElementById('packingEditPanel');
 if(!d||!el)return;
 const isV=d.isVoltec;
 const lines=d.lines.map((line,index)=>{
  return '<article class="packing-edit-row"><strong>'+packingEditEscape(line.part)+'</strong> <span class="muted">'+
   packingEditEscape(line.code)+'</span>'+
   '<div class="packing-edit-grid">'+
   packingEditNumberField(isV?'Ordered':'Shipped quantity',index,'ordered')+
   (isV?packingEditNumberField('Shipped',index,'shipped'):'')+
   (isV?packingEditNumberField('Cases pulled',index,'casesPulled')+
    packingEditNumberField('Units / case',index,'casePack')+
    packingEditNumberField('Weight / case (lb)',index,'perCaseWeightLb'):'')+
   '</div></article>';
 }).join('');
 el.innerHTML='<div class="packing-edit-header"><div><h2>Edit Packing List</h2><p class="sub">PO '+packingEditEscape(d.number)+
  ' · Correct details without creating a second order. Editing shipped quantities will adjust shared stock.</p></div>'+
  '<button type="button" class="slim" onclick="packingEditClose()">Cancel Editing</button></div>'+
  '<div class="packing-edit-grid">'+packingEditTextField('Ship to / company','recipient',{required:true})+
  packingEditTextField('Job / project','job',{optional:true})+
  packingEditTextField('Attention','attention',{optional:true})+
  packingEditTextField('Street','street',{optional:true})+
  packingEditTextField('City','city',{optional:true})+
  packingEditTextField('State','state',{optional:true})+
  packingEditTextField('ZIP code','zip',{optional:true})+'</div>'+
  (isV?'<h3>Voltec shipping details</h3><div class="packing-edit-grid">'+
   packingEditTextField('Voltec Sales Order #','voltecSalesOrder',{optional:true})+
   packingEditTextField('Customer PO #','customerPo',{optional:true})+
   '<label>Shipping Method<select id="packingEditShippingMethod" onchange="packingEditSet(\'shippingMethod\',this.value)">'+
   '<option value="cartons"'+(d.shippingMethod==='cartons'?' selected':'')+'>Cartons</option>'+
   '<option value="pallets"'+(d.shippingMethod==='pallets'?' selected':'')+'>Pallets</option></select></label>'+
   '<label id="packingEditPalletLabel"'+(d.shippingMethod==='cartons'?' class="hidden"':'')+'>Number of pallets'+
   '<input type="number" min="1" max="1000" step="1" inputmode="numeric" id="packingEditPalletCount" value="'+
   packingEditEscape(d.palletCount)+'" oninput="packingEditSet(\'palletCount\',this.value)"></label></div>':'')+
  '<h3>Original order lines</h3><p class="sub">Part numbers stay fixed. Save a new order to add or remove parts.</p>'+
  lines+packingEditTextField('Notes','notes',{optional:true,multiline:true})+
  '<div id="packingEditTotals" class="packing-edit-summary"></div>'+
  '<div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap"><button type="button" onclick="packingEditClose()">Discard Changes</button>'+
  '<button type="button" class="primary" id="packingEditSaveButton" onclick="packingEditSave()">Save Changes & Refresh PDF</button></div>';
 packingEditSummary();
}
function packingEditSummary(){
 const host=document.getElementById('packingEditTotals');
 if(!host||!packingEditDraft)return;
 const s=packingEditComputed(packingEditDraft);
 host.textContent=s.ordered+' ordered · '+s.shipped+' shipped · '+Math.max(0,s.backordered)+
  ' backordered · '+s.cases+' cases'+
  (packingEditDraft.isVoltec?' · '+s.pallets+' pallets (+'+s.palletWeightLb+' lb)':'')+
  ' · '+(s.allKnown?'Total weight: ':'Known weight: ')+s.knownWeightLb.toFixed(2)+' lb'+
  (!s.allKnown?' (some weights unknown)':'');
}
function packingEditSet(key,value){
 if(!packingEditDraft||!packingEditFields.includes(key))return;
 packingEditDraft[key]=value;
 if(key==='shippingMethod'){
  const field=document.getElementById('packingEditPalletLabel');
  if(field)field.classList.toggle('hidden',value!=='pallets');
 }
 packingEditSummary();
}
function packingEditSetLine(index,key,value){
 if(!packingEditDraft||!packingEditDraft.lines[index]||
  !['ordered','shipped','casesPulled','casePack','perCaseWeightLb'].includes(key))return;
 packingEditDraft.lines[index][key]=value;
 packingEditSummary();
}
function packingEditPayload(d){
 if(!d?.id||!d.recipient.trim())throw Error('Enter the ship-to customer or company.');
 const lines=d.lines.map(l=>{
  const ordered=Number(l.ordered),shipped=d.isVoltec?Number(l.shipped):ordered;
  if(!Number.isSafeInteger(ordered)||ordered<1||!Number.isSafeInteger(shipped)||shipped<0||shipped>ordered)
   throw Error('Check ordered and shipped quantities for '+l.part+'.');
  const nullable=(v,label,integer)=>{
   if(v==='')return null;
   const n=Number(v);
   if(!Number.isFinite(n)||n<0||(integer&&!Number.isSafeInteger(n)))
    throw Error('Check '+label+' for '+l.part+'.');
   return n;
  };
  return {division:l.division,id:l.id,ordered,shipped,
   casesPulled:d.isVoltec?nullable(l.casesPulled,'cases pulled',true):null,
   casePack:d.isVoltec?nullable(l.casePack,'units per case',true):null,
   perCaseWeightLb:d.isVoltec?nullable(l.perCaseWeightLb,'weight per case',false):null,
   weightEstimated:l.weightEstimated,weightSource:l.weightSource,weightSourceUrl:l.weightSourceUrl};
 });
 const shippingMethod=d.isVoltec&&d.shippingMethod==='pallets'?'pallets':'cartons';
 const palletCount=shippingMethod==='pallets'?Number(d.palletCount):0;
 if(shippingMethod==='pallets'&&(!Number.isSafeInteger(palletCount)||palletCount<1||palletCount>1000))
  throw Error('Enter a valid whole number of pallets (1–1000).');
 return {id:d.id,recipient:d.recipient,job:d.job,attention:d.attention,street:d.street,
  city:d.city,state:d.state,zip:d.zip,notes:d.notes,voltecSalesOrder:d.voltecSalesOrder,
  customerPo:d.customerPo,shippingMethod,palletCount,lines};
}
function packingEditOpen(id){
 const o=(db.orders||[]).find(x=>x.id===(id||selectedOrder));
 if(!o){alertMsg('Packing list not found.',true);return}
 if(o.status==='cancelled'){alertMsg('Cancelled packing lists cannot be edited.',true);return}
 if(activeTab!=='packing'||selectedOrder!==o.id)openPacking(o.id);
 packingEditDraft=packingEditInitial(o);
 const host=document.getElementById('packingEditPanel');
 host.classList.remove('hidden');
 packingEditRender();
 host.scrollIntoView?.({behavior:'smooth',block:'start'});
}
function packingEditClose(){
 packingEditDraft=null;
 const host=document.getElementById('packingEditPanel');if(host)host.classList.add('hidden');
}
async function packingEditSave(){
 if(!packingEditDraft)return;
 const btn=document.getElementById('packingEditSaveButton');
 try{
  const p=packingEditPayload(packingEditDraft);
  const old=(db.orders||[]).find(o=>o.id===p.id);
  if(!old)throw Error('This packing list was not found.');
  const adjusted=p.lines.filter(l=>{
   const previous=(old.lines||[]).find(a=>a.id===l.id&&a.division===l.division);
   return previous&&Number(previous.shipped??previous.qty)!==Number(l.shipped);
  });
  if(adjusted.length&&!confirm('The shipped quantities changed for '+adjusted.length+
    ' part(s). Saving will adjust shared inventory to match the corrected packing list. Continue?'))return;
  if(btn)btn.disabled=true;
  const result=await change('edit_order',p);
  const updated=(result.content?.orders||[]).find(o=>o.id===p.id);
  packingEditClose();
  if(updated){
   selectedOrder=updated.id;
   renderPacking(updated.id);
   window.packingPreviewPDF?.(updated);
  }
  alertMsg('Packing list updated. The refreshed PDF is ready to view, print or download.');
 }catch(e){
  alertMsg('Could not save packing list: '+(e.message||e),true);
  if(e.conflict)refresh().catch(()=>{});
 }finally{if(btn)btn.disabled=false;}
}
if(typeof window!=='undefined'){
 Object.assign(window,{packingEditOpen,packingEditClose,packingEditSet,
 packingEditSetLine,packingEditSave});
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={packingEditInitial,packingEditComputed,packingEditPayload};
