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
 const weightLb=''; // Shipment weight is entered once, manually, at order level.
 return {ordered:Number(ordered),shipped,casePack,casesPulled,weightLb,
  caseTouched:false,shippedTouched:false,weightTouched:false,casePackTouched:false,
  weightEstimated:false,
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
 // Case packs can suggest case counts; weights are never inferred from product specs.
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
 }else return;
 if(field==='shipped'||field==='casePack'||field==='casesPulled')packingShipmentUpdateAuto(v);
 const suffix=key.replace(/[^A-Za-z0-9]/g,'_');
 const back=document.getElementById('shipBack_'+suffix);
 if(back)back.textContent=Number.isSafeInteger(Number(v.shipped))?Math.max(0,v.ordered-Number(v.shipped)).toLocaleString():'—';
 for(const name of ['casesPulled']){
  const input=document.getElementById('ship_'+name+'_'+suffix);
  if(input&&name!==field)input.value=v[name]===''?'':String(v[name]);
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
 return '<article class="packing-shipment-row"><div class="packing-shipment-heading"><div><strong>'+esc(item.part)+'</strong> <span class="tag">'+(item.manual?'Custom '+(key.startsWith('reliance:')?'Reliance':'Voltec'):key.startsWith('reliance:')?'Reliance':key.startsWith('voltec:')?'Voltec':'EiKO')+'</span><p class="muted">'+esc(item.code||'')+(item.manual?' · Manual part · no inventory deduction':' · '+Number(item.qty)+' on hand')+'</p></div><button class="slim danger" onclick="removeCart(\''+esc(key)+'\')">Remove</button></div>'+
  '<div class="packing-shipment-fields">'+
  '<label>Ordered <input type="number" min="1" step="1" inputmode="numeric" value="'+esc(ordered)+'" onchange="setCartQty(\''+esc(key)+'\',this.value)"></label>'+
  '<label>Shipped '+input('shipped')+'</label>'+
  '<label>Backordered <span class="ship-readonly" id="shipBack_'+suffix+'">'+Math.max(0,v.ordered-Number(v.shipped||0))+'</span></label>'+
  '<label>Cases pulled '+input('casesPulled')+'</label>'+
  '<label>Units / case '+input('casePack')+'</label>'+
  '</div><div class="packing-shipment-help">'+
  (spec?'Case pack sourced from <a target="_blank" rel="noopener noreferrer" href="'+esc(spec.url)+'">'+esc(spec.source)+'</a>. ':'Enter the case pack if known. ')+
  'Final shipment weight is entered manually below, not calculated from cases.</div></article>';
}
function packingShipmentLine(key,item,ordered){
 const v=packingShipmentGet(key,item,ordered);
 const shipped=Number(v.shipped);
 if(!Number.isSafeInteger(shipped)||shipped<0||shipped>Number(ordered)||(!item.manual&&shipped>Number(item.qty)))
  throw Error('Check shipped quantity for '+item.part+'. Shipped must not exceed ordered or available inventory.');
 const casesPulled=v.casesPulled===''?null:Number(v.casesPulled);
 const casePack=v.casePack===''?null:Number(v.casePack);
 if(casesPulled!==null&&(!Number.isSafeInteger(casesPulled)||casesPulled<0))
  throw Error('Cases pulled must be a whole number for '+item.part+'.');
 if(casePack!==null&&(!Number.isSafeInteger(casePack)||casePack<1))
  throw Error('Units per case must be a positive whole number for '+item.part+'.');
 const perCaseWeightLb=null,weightLb=null;
 const [division,id]=key.split(':');
 return {division,id:item.manual?item.id:Number(id),
  ...(item.manual?{manual:true,part:item.part,code:item.code,desc:item.desc}:{}),
  qty:Number(ordered),shipped,casesPulled,casePack,
  perCaseWeightLb,weightLb,
  weightEstimated:false,weightSource:'',weightSourceUrl:''};
}
const PACKING_PALLET_TARE_LB=35;
function packingShippingCalculation(method,palletCount,itemsWeightLb){
 const mode=method==='pallets'?'pallets':'cartons';
 const count=mode==='pallets'?Number(palletCount):0;
 if(!Number.isSafeInteger(count)||count<0||count>1000)
  throw Error('Enter a valid whole number of pallets (1–1000).');
 const base=itemsWeightLb===null?null:Number(itemsWeightLb);
 const palletWeightLb=count*PACKING_PALLET_TARE_LB;
 return {shippingMethod:mode,palletCount:count,palletWeightLb,
  itemsWeightLb:base,grandWeightLb:base===null?null:Math.round((base+palletWeightLb)*100)/100};
}
function packingShippingModeChanged(){
 const mode=document.getElementById('orderShippingMethod')?.value||'cartons';
 const palletFields=document.getElementById('orderPalletFields');
 if(palletFields)palletFields.classList.toggle('hidden',mode!=='pallets');
 packingShipmentSummary();
}
function packingAddPalletWeight(){
 // Tapping the button is equivalent to adding one 35-lb pallet.
 // It also switches from Cartons to Pallets without erasing existing counts.
 const mode=document.getElementById('orderShippingMethod');
 const countField=document.getElementById('orderPalletCount');
 if(!mode||!countField)return;
 const raw=String(countField.value||'').trim();
 const count=raw===''?0:Number(raw);
 if(!Number.isSafeInteger(count)||count<0||count>=1000){
  if(typeof alertMsg==='function')alertMsg('Enter a valid whole pallet count below 1000 before adding another pallet.',true);
  return;
 }
 mode.value='pallets';
 countField.value=String(count+1);
 packingShippingModeChanged();
}
function packingShippingCartonCount(casesPulled,override){
 const manual=override!==null&&override!==undefined&&override!=='';
 if(manual){
  const n=Number(override);
  if(!Number.isSafeInteger(n)||n<0||n>100000)throw Error('Total shipping cartons must be a whole number from 0 to 100,000.');
  return {cartons:n,manual:true};
 }
 if(!Array.isArray(casesPulled)||!casesPulled.length)return {cartons:null,manual:false};
 if(casesPulled.some(n=>n===null||n===undefined||n===''||!Number.isSafeInteger(Number(n))||Number(n)<0))
  return {cartons:null,manual:false};
 return {cartons:casesPulled.reduce((sum,n)=>sum+Number(n),0),manual:false};
}
function packingManualTotalWeight(raw){
 if(raw===null||raw===undefined||String(raw).trim()==='')return null;
 const n=Number(raw);
 if(!Number.isFinite(n)||n<0||n>1000000||Math.abs(Math.round(n*100)-n*100)>1e-7)
  throw Error('Enter a valid manual total shipping weight (lb), up to 2 decimal places.');
 return n;
}
function packingShippingDetails(){
 const mode=document.getElementById('orderShippingMethod')?.value||'cartons';
 const raw=document.getElementById('orderPalletCount')?.value||'';
 if(mode==='pallets'&&(!/^\d+$/.test(raw)||Number(raw)<1))
  throw Error('Enter how many pallets you are shipping.');
 const calc=packingShippingCalculation(mode,mode==='pallets'?Number(raw):0,null);
 if(mode==='pallets'&&calc.palletCount<1)throw Error('Enter at least one pallet.');
 const cartons=document.getElementById('orderShippingCartons')?.value??'';
 const counts=Object.keys(cart||{}).filter(k=>!k.startsWith('eiko:')).map(k=>packingShipmentDraft[k]?.casesPulled??null);
 const cartonResult=packingShippingCartonCount(counts,cartons);
 const manualTotalWeightLb=packingManualTotalWeight(document.getElementById('orderManualTotalWeight')?.value??'');
 return {shippingMethod:calc.shippingMethod,palletCount:calc.palletCount,
  shippingCartons:cartonResult.manual?cartonResult.cartons:null,manualTotalWeightLb};
}
function packingShippingReset(){
 const mode=document.getElementById('orderShippingMethod');
 const qty=document.getElementById('orderPalletCount');
 if(mode)mode.value='cartons';
 if(qty)qty.value='';
 const cartonField=document.getElementById('orderShippingCartons');
 if(cartonField)cartonField.value='';
 const manualField=document.getElementById('orderManualTotalWeight');
 if(manualField)manualField.value='';
 packingShippingModeChanged();
}
function packingShipmentSummary(){
 if(typeof cart==='undefined')return;
 let ordered=0,shipped=0,backordered=0,cases=0;
 for(const [key,qty] of Object.entries(cart)){
  const v=packingShipmentDraft[key],q=Number(qty)||0,n=Number(v?.shipped??q);
  ordered+=q;shipped+=n;backordered+=Math.max(0,q-n);
  if(v?.casesPulled!==''&&v?.casesPulled!=null)cases+=Number(v.casesPulled)||0;
 }
 const mode=document.getElementById('orderShippingMethod')?.value||'cartons';
 const palletRaw=document.getElementById('orderPalletCount')?.value||'';
 const pallets=mode==='pallets'&&/^\d+$/.test(palletRaw)?Number(palletRaw):0;
 const knownCases=Object.keys(cart).filter(k=>!k.startsWith('eiko:')).map(k=>packingShipmentDraft[k]?.casesPulled??null);
 let boxes={cartons:null,manual:false};
 try{boxes=packingShippingCartonCount(knownCases,document.getElementById('orderShippingCartons')?.value??'')}catch{}
 const raw=document.getElementById('orderManualTotalWeight')?.value??'';
 const manual=raw.trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0?Number(raw):null;
 const target=document.getElementById('cartTotal');
 if(target)target.textContent=ordered+' ordered · '+shipped+' shipped · '+backordered+' backordered'+
  (cases?' · '+cases+' cases pulled':'')+
  (boxes.cartons!==null?' · '+boxes.cartons+' shipping boxes':'')+
  (mode==='pallets'?' · '+(pallets||'Enter')+' pallet(s)':'')+
  ' · Final shipping weight: '+(manual===null?'Not entered':manual.toFixed(2)+' lb (manual, includes packaging)');
}
function packingShipmentClear(){
 for(const k of Object.keys(packingShipmentDraft))delete packingShipmentDraft[k];
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={packingShipmentDefault,packingShipmentGet,packingShipmentLine,packingShipmentSpec,packingShipmentOrderedChanged,packingShipmentClear,packingShipmentSet,packingShipmentIsVoltecOrder,packingShipmentWeightTotal,packingShipmentDraft,PACKING_PALLET_TARE_LB,packingShippingCalculation,packingShippingDetails,packingAddPalletWeight,packingShippingCartonCount,packingManualTotalWeight};
