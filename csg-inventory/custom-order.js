/* Custom order lines: manual SKU and ordering code when the warehouse catalog
   doesn't contain a special part. These are packing-list-only entries; they
   are never created in, or deducted from, the shared inventory. */
'use strict';
const manualOrderItems=Object.create(null);
function manualOrderKey(division){
 const uuid=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():
   String(Date.now())+'-'+String(Math.random()).slice(2);
 return division+':manual-'+uuid;
}
function manualOrderGet(key){
 return Object.prototype.hasOwnProperty.call(manualOrderItems,key)?
   {...manualOrderItems[key],qty:Number(cart[key]||0)}:null;
}
function manualOrderClear(){
 for(const key of Object.keys(manualOrderItems))delete manualOrderItems[key];
 const form=document.getElementById('manualOrderPanel');
 if(form)form.classList.add('hidden');
 for(const field of ['manualPart','manualCode','manualDescription','manualQuantity']){
  const el=document.getElementById(field);if(el)el.value='';
 }
}
function manualOrderOpen(){
 const panel=document.getElementById('manualOrderPanel');
 if(!panel)return;
 panel.classList.remove('hidden');
 const part=document.getElementById('manualPart');
 if(part&&!part.value)part.value=(document.getElementById('orderSearch')?.value||'').trim().toUpperCase();
 const qty=document.getElementById('manualQuantity');
 if(qty&&!qty.value)qty.value='1';
 part?.focus();
}
function manualOrderAdd(){
 if(!['voltec','eiko'].includes(activeOrderDivision))return;
 const part=(document.getElementById('manualPart')?.value||'').trim().toUpperCase();
 const code=(document.getElementById('manualCode')?.value||'').trim().toUpperCase();
 const desc=(document.getElementById('manualDescription')?.value||'').trim();
 const qty=Number(document.getElementById('manualQuantity')?.value||0);
 if(!part||part.length>120){alertMsg('Enter a custom part number (up to 120 characters).',true);return}
 if(!code||code.length>120){alertMsg('Enter its ordering code (up to 120 characters).',true);return}
 if(desc.length>350){alertMsg('Keep the custom description under 350 characters.',true);return}
 if(!Number.isSafeInteger(qty)||qty<1||qty>100000000){
  alertMsg('Enter a positive whole-number quantity.',true);return;
 }
 const existing=Object.keys(manualOrderItems).find(k=>
  k.startsWith(activeOrderDivision+':')&&
  manualOrderItems[k].part===part&&manualOrderItems[k].code===code);
 if(existing){
  cart[existing]+=qty;
  if(activeOrderDivision==='voltec')packingShipmentOrderedChanged(existing,manualOrderGet(existing),cart[existing]);
 }else{
  const key=manualOrderKey(activeOrderDivision);
  manualOrderItems[key]={manual:true,id:key.split(':')[1],
   division:activeOrderDivision,part,code,desc};
  cart[key]=qty;
  if(activeOrderDivision==='voltec')packingShipmentGet(key,manualOrderGet(key),qty);
 }
 for(const field of ['manualPart','manualCode','manualDescription']){
  const el=document.getElementById(field);if(el)el.value='';
 }
 const panel=document.getElementById('manualOrderPanel');
 if(panel)panel.classList.add('hidden');
 renderCart();
 alertMsg('Custom '+brandLabel(activeOrderDivision)+' part added to packing list. It does not change inventory stock.');
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={manualOrderKey,manualOrderItems,manualOrderClear};
