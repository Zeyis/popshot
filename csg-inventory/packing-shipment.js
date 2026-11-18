/* CSG packing-list shipment details: live form values, sourced case packs,
   optional weights and partial shipments. Do not assume gross freight weight. */
'use strict';
const PACKING_KNOWN_SPECS={
 'voltec:04-00102':{casePack:6,caseWeightLb:11,
  source:'Voltec product catalog (legacy; confirm current packaging)',
  url:'https://d3cacd5apmg13r.cloudfront.net/userfiles/ad/documents/voltec_08_00193_catalog.pdf'},
 'voltec:04-00105':{casePack:6,caseWeightLb:9,
  source:'Voltec product catalog (legacy; confirm current packaging)',
  url:'https://d3cacd5apmg13r.cloudfront.net/userfiles/ad/documents/voltec_08_00193_catalog.pdf'},
 'voltec:08-00743':{casePack:4,caseWeightLb:12,
  source:'Voltec current product specifications',
  url:'https://voltecindustries.com/products/voltec-6600-lumen-ac-led-work-light'}
};
const packingShipmentDraft={};
function packingShipmentSpec(item,division){
 return PACKING_KNOWN_SPECS[String(division)+':'+String(item?.part||'').trim().toUpperCase()]||null;
}
function packingShipmentDefault(item,division,ordered){
 const spec=packingShipmentSpec(item,division);
 const shipped=Math.min(Number(item.qty)||0,Number(ordered)||0);
 const casePack=spec?.casePack||'';
 const casesPulled=casePack&&shipped>0&&shipped%casePack===0?shipped/casePack:'';
 const weightLb=spec?.caseWeightLb||''; // Editable weight PER CASE, not line total.
 return {ordered:Number(ordered),shipped,casePack,casesPulled,weightLb,
  caseTouched:false,shippedTouched:false,weightTouched:false,casePackTouched:false,
  weightEstimated:weightLb!==''&&!!spec?.caseWeightLb,
  source:spec?.source||'',sourceUrl:spec?.url||'',caseWeightLb:spec?.caseWeightLb||null,
  suggestedCasePack:spec?.casePack||null};
}
function packingShipmentGet(key,item,ordered){
 const v=packingShipmentDraft[key];
 if(!v)return packingShipmentDraft[key]=packingShipmentDefault(item,key.split(':')[0],ordered);
 return v;
}
function packingShipmentUpdateAuto(v){
 if(!v.caseTouched){
  v.casesPulled=v.casePack&&v.shipped>0&&v.shipped%v.casePack===0?v.shipped/v.casePack:'';
 }
 if(!v.weightTouched){
  v.weightLb=v.caseWeightLb&&v.casePack===v.suggestedCasePack
   ?v.caseWeightLb:'';
  v.weightEstimated=v.weightLb!==''&&!!v.caseWeightLb;
 }
}
function packingShipmentOrderedChanged(key,item,ordered){
 const v=packingShipmentGet(key,item,ordered),previous=v.ordered;
 v.ordered=Number(ordered);
 if(!v.shippedTouched||v.shipped===previous){
  v.shipped=Math.min(Number(item.qty)||0,v.ordered);v.shippedTouched=false;
 }else if(v.shipped>v.ordered)v.shipped=v.ordered;
 packingShipmentUpdateAuto(v);
}
function packingShipmentSet(key,field,raw){
 const v=packingShipmentDraft[key];if(!v)return;
 const n=raw===''?'':Number(raw);
 if(n!==''&&(!Number.isFinite(n)||n<0))return;
 if(field==='shipped'){
  v.shipped=n;v.shippedTouched=true;
 }else if(field==='casePack'){
  v.casePack=n;v.casePackTouched=true;v.caseTouched=false;
 }else if(field==='casesPulled'){
  v.casesPulled=n;v.caseTouched=true;
 }else if(field==='weightLb'){
  v.weightLb=n;v.weightTouched=true;v.weightEstimated=false;
 }else return;
 if(field==='shipped'||field==='casePack'||field==='casesPulled')packingShipmentUpdateAuto(v);
 const suffix=key.replace(/[^A-Za-z0-9]/g,'_');
 const back=document.getElementById('shipBack_'+suffix);
 if(back)back.textContent=Number.isSafeInteger(Number(v.shipped))?Math.max(0,v.ordered-Number(v.shipped)).toLocaleString():'—';
 for(const name of ['casesPulled','weightLb']){
  const input=document.getElementById('ship_'+name+'_'+suffix);
  if(input&&name!==field)input.value=v[name]===''?'':String(v[name]);
 }
 const note=document.getElementById('shipWeightNote_'+suffix);
 if(note){
  const total=packingShipmentWeightTotal(v);
  note.textContent=total===null
   ?'Enter cases pulled and weight per case to calculate total weight.'
   :(v.weightEstimated?'Estimated':'Calculated')+' line weight: '+total.toFixed(2)+' lb ('+v.casesPulled+' × '+v.weightLb+' lb/case).';
 }
 if(typeof packingShipmentSummary==='function')packingShipmentSummary();
}
function packingShipmentWeightTotal(v){
 if(v?.casesPulled===''||v?.casesPulled==null||v?.weightLb===''||v?.weightLb==null)return null;
 const n=Number(v.casesPulled),w=Number(v.weightLb);
 if(!Number.isSafeInteger(n)||n<0||!Number.isFinite(w)||w<0)return null;
 return Math.round(n*w*100)/100;
}
function packingShipmentIsVoltecOrder(cartEntries){
 return Object.keys(cartEntries||{}).some(key=>key.startsWith('voltec:'));
}
function packingShipmentMarkup(key,item,ordered){
 const v=packingShipmentGet(key,item,ordered);
 const suffix=key.replace(/[^A-Za-z0-9]/g,'_'), esc=typeof E==='function'?E:(x=>String(x));
 const spec=packingShipmentSpec(item,key.split(':')[0]);
 const input=(field,opts={})=>'<input id="ship_'+field+'_'+suffix+'" type="number" min="0" step="'+(opts.decimal?'0.01':'1')+'" inputmode="'+(opts.decimal?'decimal':'numeric')+
  '" value="'+esc(v[field]===''?'':v[field])+'" placeholder="'+(opts.placeholder||'—')+
  '" oninput="packingShipmentSet(\''+esc(key)+'\',\''+field+'\',this.value)">';
 return '<article class="packing-shipment-row"><div class="packing-shipment-heading"><div><strong>'+esc(item.part)+'</strong> <span class="tag">'+(key.startsWith('voltec:')?'Voltec':'EiKO')+'</span><p class="muted">'+esc(item.code||'')+' · '+Number(item.qty)+' on hand</p></div><button class="slim danger" onclick="removeCart(\''+esc(key)+'\')">Remove</button></div>'+
  '<div class="packing-shipment-fields">'+
  '<label>Ordered <input type="number" min="1" step="1" inputmode="numeric" value="'+esc(ordered)+'" onchange="setCartQty(\''+esc(key)+'\',this.value)"></label>'+
  '<label>Shipped '+input('shipped')+'</label>'+
  '<label>Backordered <span class="ship-readonly" id="shipBack_'+suffix+'">'+Math.max(0,v.ordered-Number(v.shipped||0))+'</span></label>'+
  '<label>Cases pulled '+input('casesPulled')+'</label>'+
  '<label>Units / case '+input('casePack')+'</label>'+
  '<label>Weight / case (lb) '+input('weightLb',{decimal:true})+'</label>'+
  '</div><div class="packing-shipment-help"><span>'+
  (spec?'Case pack sourced from <a target="_blank" rel="noopener noreferrer" href="'+esc(spec.url)+'">'+esc(spec.source)+'</a>. ':'Case pack not verified; enter if known. ')+
  '</span><span id="shipWeightNote_'+suffix+'">'+
  (packingShipmentWeightTotal(v)===null
    ?'Enter cases pulled and weight per case to calculate total.'
    :(v.weightEstimated?'Estimated':'Calculated')+' line weight: '+packingShipmentWeightTotal(v).toFixed(2)+' lb ('+v.casesPulled+' × '+v.weightLb+' lb/case).')+
  '</span></div></article>';
}
function packingShipmentLine(key,item,ordered){
 const v=packingShipmentGet(key,item,ordered);
 const shipped=Number(v.shipped);
 if(!Number.isSafeInteger(shipped)||shipped<0||shipped>Number(ordered)||shipped>Number(item.qty))
  throw Error('Check shipped quantity for '+item.part+'. Shipped must not exceed ordered or available inventory.');
 const casesPulled=v.casesPulled===''?null:Number(v.casesPulled);
 const casePack=v.casePack===''?null:Number(v.casePack);
 const perCaseWeightLb=v.weightLb===''?null:Number(v.weightLb);
 const weightLb=packingShipmentWeightTotal(v);
 if(casesPulled!==null&&(!Number.isSafeInteger(casesPulled)||casesPulled<0))throw Error('Cases pulled must be a whole number for '+item.part+'.');
 if(casePack!==null&&(!Number.isSafeInteger(casePack)||casePack<1))throw Error('Units per case must be a positive whole number for '+item.part+'.');
 if(perCaseWeightLb!==null&&(!Number.isFinite(perCaseWeightLb)||perCaseWeightLb<0))
  throw Error('Check weight per case for '+item.part+'.');
 // An unknown pulled-case count leaves total weight blank; do not block the order.
 const [division,id]=key.split(':');
 return {division,id:Number(id),qty:Number(ordered),shipped,casesPulled,casePack,
  perCaseWeightLb,weightLb,
  weightEstimated:weightLb!==null&&v.weightEstimated,
  weightSource:weightLb!==null?(v.weightEstimated?v.source:'Manual'):v.casePackTouched?'Manual':v.source,
  weightSourceUrl:weightLb!==null&&v.weightEstimated?v.sourceUrl:''};
}
function packingShipmentSummary(){
 if(typeof cart==='undefined')return;
 let ordered=0,shipped=0,backordered=0,cases=0,weight=0,hasWeight=false;
 for(const [key,qty] of Object.entries(cart)){
  const v=packingShipmentDraft[key],q=Number(qty)||0,s=Number(v?.shipped??q);
  ordered+=q;shipped+=s;backordered+=Math.max(0,q-s);
  if(v?.casesPulled!=='')cases+=Number(v?.casesPulled)||0;
  const lineWeight=packingShipmentWeightTotal(v);
  if(lineWeight!==null){weight+=lineWeight;hasWeight=true}
 }
 const target=document.getElementById('cartTotal');
 if(target)target.textContent=ordered+' ordered · '+shipped+' shipped · '+backordered+' backordered'+(cases?' · '+cases+' cases':'')+(hasWeight?' · '+weight.toFixed(2)+' lb total':'');
}
function packingShipmentClear(){
 for(const k of Object.keys(packingShipmentDraft))delete packingShipmentDraft[k];
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={packingShipmentDefault,packingShipmentGet,packingShipmentLine,packingShipmentSpec,packingShipmentOrderedChanged,packingShipmentClear,packingShipmentSet,packingShipmentIsVoltecOrder,packingShipmentWeightTotal,packingShipmentDraft};
