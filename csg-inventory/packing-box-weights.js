/* Manually entered weights per physical shipping box.
   No product-catalog weights or cases-to-weight estimates are used. */
'use strict';
const packingBoxDraft={weights:[],renderedCount:-1};
function packingBoxTotals(input){
 const count=input.cartons==null?null:Number(input.cartons);
 const weights=Array.isArray(input.boxWeightsLb)?input.boxWeightsLb:[];
 if(count!==null&&(!Number.isSafeInteger(count)||count<0||count>100000))
  throw Error('Enter a valid number of shipping boxes.');
 if(weights.length>200)throw Error('Up to 200 individual box weights can be recorded per order.');
 if(count!==null&&weights.length&&weights.length!==count)
  throw Error('The number of box-weight fields must match the shipping-box count.');
 let entered=0,sum=0;
 for(const v of weights){
  if(v==null||v==='')continue;
  const n=Number(v);
  if(!Number.isFinite(n)||n<0||n>1000000||Math.abs(n*100-Math.round(n*100))>1e-7)
   throw Error('Each box weight must be a valid number of pounds with up to 2 decimal places.');
  entered++;sum+=n;
 }
 const allEntered=count!==null&&count>0&&weights.length===count&&entered===count;
 const boxWeightLb=allEntered?Math.round(sum*100)/100:null;
 const palletCount=input.shippingMethod==='pallets'?(Number(input.palletCount)||0):0;
 if(!Number.isSafeInteger(palletCount)||palletCount<0||palletCount>1000)
  throw Error('Enter a valid pallet count.');
 const palletWeightLb=palletCount*35;
 const override=input.manualTotalWeightLb==null||input.manualTotalWeightLb===''?null:Number(input.manualTotalWeightLb);
 if(override!==null&&(!Number.isFinite(override)||override<0||override>1000000||
  Math.abs(override*100-Math.round(override*100))>1e-7))
  throw Error('Enter a valid final weight override.');
 const derived=boxWeightLb===null?null:Math.round((boxWeightLb+palletWeightLb)*100)/100;
 return {count,weights,entered,boxWeightLb,palletWeightLb,palletCount,
  calculatedTotalLb:derived,finalWeightLb:override!==null?override:derived,
  manualOverrideLb:override,allEntered};
}
function packingBoxCountFromForm(){
 const countRaw=document.getElementById('orderShippingCartons')?.value??'';
 if(countRaw!=='')return Number(countRaw);
 if(typeof cart==='undefined')return null;
 const lines=Object.keys(cart).filter(k=>!k.startsWith('eiko:'));
 if(!lines.length)return null;
 const counts=lines.map(k=>packingShipmentDraft[k]?.casesPulled??null);
 if(counts.some(c=>c===null||c===''||!Number.isSafeInteger(Number(c))))return null;
 return counts.reduce((s,n)=>s+Number(n),0);
}
function packingBoxesCountChanged(){
 packingBoxDraft.renderedCount=-1;
 packingBoxWeightsRender();
 if(typeof packingShipmentSummary==='function')packingShipmentSummary();
}
function packingBoxWeightsRender(){
 const host=document.getElementById('orderBoxWeights');
 if(!host)return;
 const count=packingBoxCountFromForm();
 if(packingBoxDraft.renderedCount===count)return;
 packingBoxDraft.renderedCount=count;
 if(count===null||count===0){
  host.innerHTML='<p class="sub">Enter the number of shipping boxes above to add each box weight.</p>';
  return;
 }
 if(!Number.isSafeInteger(count)||count<0){
  host.innerHTML='<p class="sub">Enter a valid whole number of boxes.</p>';return;
 }
 if(count>200){
  host.innerHTML='<p class="sub">Individual weights support up to 200 boxes. Use the final weight override for larger shipments.</p>';return;
 }
 if(packingBoxDraft.weights.length>count)packingBoxDraft.weights.length=count;
 while(packingBoxDraft.weights.length<count)packingBoxDraft.weights.push('');
 host.innerHTML='<p class="sub">Enter the actual weight of each shipping box. No product weights are estimated.</p>'+
  '<div class="packing-box-grid">'+packingBoxDraft.weights.map((v,i)=>
  '<label>Box '+(i+1)+' (lb)<input type="number" min="0" max="1000000" step="0.01" inputmode="decimal"'+
  ' aria-label="Weight of box '+(i+1)+' in pounds" value="'+String(v).replace(/"/g,'&quot;')+
  '" oninput="packingBoxWeightChanged('+i+',this.value)"></label>').join('')+'</div>'+
  '<p id="orderBoxWeightSubtotal" class="sub"></p>';
}
function packingBoxWeightChanged(index,value){
 if(index<0||index>=packingBoxDraft.weights.length)return;
 packingBoxDraft.weights[index]=value;
 if(typeof packingShipmentSummary==='function')packingShipmentSummary();
}
function packingBoxFormTotals(){
 const count=packingBoxCountFromForm();
 return packingBoxTotals({
  cartons:count,
  boxWeightsLb:count!==null&&count<=200?packingBoxDraft.weights.slice(0,count):[],
  shippingMethod:document.getElementById('orderShippingMethod')?.value||'cartons',
  palletCount:document.getElementById('orderPalletCount')?.value||0,
  manualTotalWeightLb:document.getElementById('orderManualTotalWeight')?.value??''
 });
}
function packingBoxClear(){
 packingBoxDraft.weights=[];
 packingBoxDraft.renderedCount=-1;
 const host=document.getElementById('orderBoxWeights');if(host)host.innerHTML='';
}
if(typeof module!=='undefined'&&module.exports)
 module.exports={packingBoxTotals,packingBoxDraft,packingBoxCountFromForm,packingBoxClear};
