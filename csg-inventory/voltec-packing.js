/* Voltec shipment-specific CSG packing slip.
   Neutral black/gray layout, supplier order references, partial shipping and
   verified/manually entered case and weight data. No employee field. */
'use strict';
function voltecPackingNormalize(raw){
 if(!raw||!Array.isArray(raw.lines)||!raw.lines.length)throw Error('Missing saved packing-list items');
 const lines=raw.lines.map((r,index)=>{
  const ordered=Number(r.ordered??r.qty);
  const shipped=Number(r.shipped??r.qty);
  const backordered=Number(r.backordered??Math.max(0,ordered-shipped));
  const casesPulled=(r.casesPulled==null||r.casesPulled==='')?null:Number(r.casesPulled);
  const casePack=(r.casePack==null||r.casePack==='')?null:Number(r.casePack);
  const perCaseWeightLb=(r.perCaseWeightLb==null||r.perCaseWeightLb==='')?null:Number(r.perCaseWeightLb);
  const weightLb=perCaseWeightLb!==null&&casesPulled!==null
   ?Math.round(perCaseWeightLb*casesPulled*100)/100
   :(r.weightLb==null||r.weightLb==='')?null:Number(r.weightLb);
  return {index:index+1,part:String(r.part||''),code:String(r.code||''),
   description:String(r.desc||''),division:r.division==='reliance'?'Reliance':r.division==='voltec'?'Voltec':'EiKO',
   ordered,shipped,backordered,casesPulled,casePack,perCaseWeightLb,weightLb,
   weightEstimated:r.weightEstimated===true};
 });
 const supplier=raw.lines.some(line=>line.division==='reliance')?'Reliance':'Voltec';
 return {number:String(raw.number||''),created:String(raw.created||''),
  supplier,
  salesOrder:String(supplier==='Reliance'?raw.relianceSalesOrder||'':raw.voltecSalesOrder||''),
  customerPo:String(raw.customerPo||''),
  job:String(raw.job||''),recipient:String(raw.recipient||''),
  attention:String(raw.shipAttention||''),street:String(raw.shipStreet||''),
  city:String(raw.shipCity||''),state:String(raw.shipState||''),zip:String(raw.shipZip||''),
  notes:String(raw.notes||''),
  shippingMethod:raw.shippingMethod==='pallets'?'pallets':'cartons',
  palletCount:raw.shippingMethod==='pallets'?(Number(raw.palletCount)||0):0,
  shippingCartons:raw.shippingCartons==null||raw.shippingCartons===''?null:Number(raw.shippingCartons),
  manualTotalWeightLb:raw.manualTotalWeightLb==null||raw.manualTotalWeightLb===''?null:Number(raw.manualTotalWeightLb),
  lines};
}
function voltecPackingSummary(lines){
 const result={ordered:0,shipped:0,backordered:0,knownCases:0,casesKnown:0,knownLb:0,weightsKnown:0,estimatedWeight:false};
 for(const l of lines){
  result.ordered+=l.ordered;result.shipped+=l.shipped;result.backordered+=l.backordered;
  if(l.casesPulled!==null){result.knownCases+=l.casesPulled;result.casesKnown++}
  if(l.weightLb!==null){result.knownLb+=l.weightLb;result.weightsKnown++;if(l.weightEstimated)result.estimatedWeight=true}
 }
 return result;
}
function voltecPackingShippingTotals(order,itemsSummary){
 const isPallets=order.shippingMethod==='pallets';
 const palletCount=isPallets?Number(order.palletCount)||0:0;
 const palletWeightLb=palletCount*35; // Informational pallet tare only; do not add to the final weight.
 const manualCartons=order.shippingCartons!==null&&order.shippingCartons!==undefined;
 const knownCaseCounts=order.lines.map(line=>line.casesPulled);
 const autoCartons=knownCaseCounts.length>0&&knownCaseCounts.every(c=>Number.isSafeInteger(c)&&c>=0)
  ?knownCaseCounts.reduce((n,c)=>n+c,0):null;
 const shippingCartons=manualCartons?order.shippingCartons:autoCartons;
 const manualTotalWeightLb=order.manualTotalWeightLb===null||order.manualTotalWeightLb===undefined
  ?null:Number(order.manualTotalWeightLb);
 return {shippingMethod:isPallets?'pallets':'cartons',palletCount,palletWeightLb,
  shippingCartons,cartonsManuallySet:manualCartons,manualTotalWeightLb,
  itemsWeightLb:null,allWeightsKnown:false,knownCombinedLb:null,calculatedTotalLb:null,
  grandTotalLb:manualTotalWeightLb};
}
async function voltecPackingBuildPDF(original,options={}){
 const {PDFDocument,StandardFonts,rgb}=options.pdfLib||globalThis.PDFLib||await bjPdfLoadLibrary();
 const saved=voltecPackingNormalize(original),summary=voltecPackingSummary(saved.lines);
 const shipping=voltecPackingShippingTotals(saved,summary);
 const pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),
  bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const C={black:rgb(.13,.13,.13),dark:rgb(.21,.21,.21),mid:rgb(.41,.41,.41),
  border:rgb(.75,.75,.75),light:rgb(.95,.95,.95),white:rgb(1,1,1)};
 const pageW=612,pageH=792,left=42,right=570;
 let logo=null;
 if(options.logoBytes)try{logo=await pdf.embedJpg(options.logoBytes)}catch{}
 let page=null,y=0;
 const safe=value=>String(value??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
 const formattedDate=value=>{
  const d=new Date(value||Date.now());return isNaN(d.getTime())?safe(value):d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
 };
 const fit=(value,font,size,maxWidth)=>{
  let result=safe(value);
  if(font.widthOfTextAtSize(result,size)<=maxWidth)return result;
  while(result.length>1&&font.widthOfTextAtSize(result+'...',size)>maxWidth)result=result.slice(0,-1);
  return result+'...';
 };
 function put(text,x,at,size=9,strong=false,color=C.black,maxWidth=500,rightAlign=false){
  const font=strong?bold:normal,str=fit(text,font,size,maxWidth);
  if(!str)return;
  page.drawText(str,{x:rightAlign?x-font.widthOfTextAtSize(str,size):x,y:at,size,font,color});
 }
 function rule(at,x1=left,x2=right,weight=.6,color=C.border){
  page.drawLine({start:{x:x1,y:at},end:{x:x2,y:at},color,thickness:weight});
 }
 function wrap(text,maxWidth,font,size,maxLines=2){
  const words=safe(text).split(/\s+/).filter(Boolean),lines=[];let current='';
  for(const word of words){
   const s=current?current+' '+word:word;
   if(font.widthOfTextAtSize(s,size)<=maxWidth){current=s;continue}
   if(current){lines.push(current);current='';if(lines.length>=maxLines)break}
   current=fit(word,font,size,maxWidth);
  }
  if(current&&lines.length<maxLines)lines.push(current);
  return lines;
 }
 function meta(label,value,x,at,width){
  put(label,x,at,7.2,true,C.mid,width);
  put(value||'-',x,at-18,9.1,true,C.dark,width);
 }
 function tableHeader(){
  page.drawRectangle({x:left,y:y-35,width:right-left,height:35,color:C.dark});
  const h=y-15;
  put('PART / DESCRIPTION',left+9,h,7.7,true,C.white,200);
  put('ORDER',260,h+3,7,true,C.white,70);
  put('CODE',260,h-10,7,true,C.white,70);
  put('ORDERED',389,h-6,7,true,C.white,50,true);
  put('SHIPPED',449,h-6,7,true,C.white,50,true);
  put('B/O',498,h-6,7,true,C.white,35,true);
  put('CASES',562,h-6,7,true,C.white,52,true);
  y-=35;
 }
 function pageHeader(first){
  page=pdf.addPage([pageW,pageH]);
  // white paper and CSG branding, designed to print clearly in black and white
  if(logo){
   page.drawRectangle({x:left,y:720,width:106,height:48,color:C.white});
   const sized=logo.scaleToFit(102,45);
   page.drawImage(logo,{x:left+(106-sized.width)/2,y:722+(45-sized.height)/2,
    width:sized.width,height:sized.height});
  }else put('CAHABA SALES GROUP',left,746,13,true,C.dark,245);
  put('CAHABA SALES GROUP',logo?160:left,755,12.3,true,C.dark,230);
  put('WAREHOUSE OPERATIONS',logo?160:left,737,8.2,false,C.mid,230);
  put('PACKING SLIP',right,750,18,true,C.dark,194,true);
  put(saved.number,right,728,9.6,true,C.mid,180,true);
  rule(714,left,right,1.6,C.dark);
  if(first){
   // Three deliberately aligned reference blocks instead of scattered labels.
   page.drawRectangle({x:left,y:640,width:528,height:57,color:C.light});
   meta('CSG SO #',saved.number,left+12,681,148);
   meta(saved.supplier.toUpperCase()+' SALES ORDER #',saved.salesOrder,218,681,165);
   meta('CUSTOMER PO #',saved.customerPo,405,681,153);
   meta('ORDER DATE',formattedDate(saved.created),left,624,150);
   meta('JOB / PROJECT',saved.job,253,624,310);
   rule(584);
   put('SHIP FROM',left,565,8.3,true,C.mid);
   put('Cahaba Sales Group',left,549,10.6,true,C.black,236);
   put('113 45th Place North',left,532,8.7,false,C.dark);
   put('Birmingham, AL 35222',left,517,8.7,false,C.dark);
   put('SHIP TO',316,565,8.3,true,C.mid);
   put(saved.recipient||'Destination not supplied',316,549,10.5,true,C.black,247);
   const address=[saved.street,
     [saved.city,saved.state,saved.zip].filter(Boolean).join(' ')].filter(Boolean);
   address.slice(0,3).forEach((v,i)=>put(v,316,532-i*14,8.7,false,C.dark,248));
   rule(485);
   put('SHIPMENT CONTENTS',left,467,10,true,C.black);
   put(saved.lines.length+' part number(s)',right,467,8.2,false,C.mid,150,true);
   y=452;
  }else{
   put('PACKING SLIP / CONTINUED',left,680,11,true,C.black);
   put('CSG SO: '+saved.number+'  |  '+saved.supplier.toUpperCase()+' SO: '+(saved.salesOrder||'-')+
    '  |  CUSTOMER PO: '+(saved.customerPo||'-'),left,662,8,false,C.mid,523);
   y=641;
  }
  tableHeader();
 }
 function rowHeight(item){
  let h=36;
  if(safe(item.description).length>44)h+=10;
  if(item.casePack)h+=12;
  return h;
 }
 pageHeader(true);
 for(const line of saved.lines){
  const height=rowHeight(line);
  if(y-height<139)pageHeader(false);
  const bottom=y-height;
  if(line.index%2===0)page.drawRectangle({x:left,y:bottom,width:right-left,height,color:C.light});
  put(String(line.index).padStart(2,'0')+' '+line.part,left+9,y-15,8.3,true,C.dark,204);
  const ds=wrap((line.division==='EiKO'?'EiKO  |  ':'')+line.description,200,normal,7,2);
  ds.forEach((t,i)=>put(t,left+9,y-26-i*10,7,false,C.mid,202));
  if(line.casePack)put('CASE PACK: '+line.casePack+' EA',left+9,bottom+6,6.4,false,C.mid,198);
  put(line.code||'-',260,y-21,7.4,false,C.black,65);
  put(line.ordered.toLocaleString('en-US'),389,y-21,9,true,C.dark,50,true);
  put(line.shipped.toLocaleString('en-US'),449,y-21,9,true,C.dark,50,true);
  put(line.backordered.toLocaleString('en-US'),498,y-21,9,true,C.dark,35,true);
  if(line.casesPulled!==null)put(line.casesPulled.toLocaleString('en-US'),562,y-21,8.5,true,C.dark,52,true);
  rule(bottom,left,right,.5);
  y=bottom;
 }
 // Only an explicitly entered final weight is printed; never infer freight weight.
 if(y<257)pageHeader(false);
 const summaryTop=y-12;
 page.drawRectangle({x:left,y:summaryTop-112,width:528,height:112,color:C.light});
 put('SHIPMENT TOTALS',left+10,summaryTop-17,8.6,true,C.dark);
 const metrics=[
  ['ORDERED',summary.ordered.toLocaleString('en-US'),left+10,94],
  ['SHIPPED',summary.shipped.toLocaleString('en-US'),left+143,90],
  ['BACKORDERED',summary.backordered.toLocaleString('en-US'),left+280,99],
  ['CASES PULLED',summary.casesKnown?String(summary.knownCases)+(summary.casesKnown<saved.lines.length?'*':''):'-',left+414,100]
 ];
 for(const [label,val,x,width] of metrics){
  put(label,x,summaryTop-35,7.0,true,C.mid,width);
  put(val,x,summaryTop-54,13.0,true,C.dark,width);
 }
 rule(summaryTop-67,left+10,right-10,.5,C.border);
 put('ACTUAL BOXES: '+(shipping.shippingCartons===null?'Not entered':shipping.shippingCartons)+
  '   |   SHIPS: '+(shipping.shippingMethod==='pallets'?shipping.palletCount+' pallet(s)':'Cartons'),
  left+10,summaryTop-83,8,true,C.dark,510);
 put('FINAL SHIPPING WEIGHT (MANUAL): '+
  (shipping.manualTotalWeightLb===null?'Not entered':shipping.manualTotalWeightLb.toFixed(2)+' lb'),
  left+10,summaryTop-101,9.5,true,C.dark,512);
 let after=summaryTop-126;
 if(summary.casesKnown>0&&summary.casesKnown<saved.lines.length)
  put('* Case count includes only lines with known cases.',left,after,7.1,false,C.mid,524);
 if(saved.notes){
  after-=22;
  if(after<88){pageHeader(false);after=y-20}
  put('DELIVERY / HANDLING NOTES',left,after,8.4,true,C.mid);
  const noteLines=wrap(saved.notes,510,normal,7.7,3);
  noteLines.forEach((note,i)=>put(note,left,after-16-i*12,7.7,false,C.dark,516));
 }
 const pages=pdf.getPages();
 for(let i=0;i<pages.length;i++){
  const p=pages[i],label='Page '+(i+1)+' of '+pages.length;
  p.drawLine({start:{x:left,y:58},end:{x:right,y:58},color:C.border,thickness:.6});
  p.drawText('CAHABA SALES GROUP  |  113 45th Place North, Birmingham, AL 35222',
   {x:left,y:43,font:normal,size:7.2,color:C.mid});
  p.drawText(label,{x:right-bold.widthOfTextAtSize(label,8),y:43,font:bold,size:8,color:C.mid});
 }
 pdf.setTitle('Cahaba Sales Group - '+saved.supplier+' Packing Slip - '+saved.number);
 pdf.setAuthor('Cahaba Sales Group');
 pdf.setSubject(saved.supplier+' sales order shipment packing slip');
 return pdf.save();
}
function voltecPackingHTML(order){
 const o=voltecPackingNormalize(order),summ=voltecPackingSummary(o.lines),
  shipping=voltecPackingShippingTotals(o,summ);
 const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const date=new Date(o.created),shownDate=isNaN(date.getTime())?'':date.toLocaleDateString('en-US');
 const lines=o.lines.map(l=>'<tr><td><strong>'+esc(l.part)+'</strong><small>'+esc(l.description)+'</small></td>'+
  '<td>'+esc(l.code||'-')+'</td><td>'+l.ordered+'</td><td>'+l.shipped+'</td><td>'+l.backordered+'</td>'+
  '<td>'+(l.casesPulled==null?'—':l.casesPulled)+'</td></tr>').join('');
 return '<div class="voltec-fallback">'+
  '<div class="voltec-fallback-head"><div><strong>CAHABA SALES GROUP</strong><small>113 45th Place North · Birmingham, AL 35222</small></div><h2>PACKING SLIP</h2></div>'+
  '<div class="voltec-fallback-meta"><div><small>CSG SO #</small><strong>'+esc(o.number)+'</strong></div>'+
  '<div><small>'+esc(o.supplier.toUpperCase())+' SALES ORDER #</small><strong>'+esc(o.salesOrder||'-')+'</strong></div>'+
  '<div><small>CUSTOMER PO #</small><strong>'+esc(o.customerPo||'-')+'</strong></div></div>'+
  '<div class="voltec-fallback-address"><div><small>SHIP FROM</small><strong>Cahaba Sales Group</strong><p>113 45th Place North<br>Birmingham, AL 35222</p></div>'+
  '<div><small>SHIP TO</small><strong>'+esc(o.recipient)+'</strong><p>'+[o.street,[o.city,o.state,o.zip].filter(Boolean).join(' ')].filter(Boolean).map(esc).join('<br>')+'</p></div></div>'+
  '<div class="voltec-fallback-caption">Order date: '+esc(shownDate)+(o.job?' · Job: '+esc(o.job):'')+'</div>'+
  '<table class="voltec-fallback-table"><thead><tr><th>PART / DESCRIPTION</th><th>CODE</th><th>ORDERED</th><th>SHIPPED</th><th>B/O</th><th>CASES</th></tr></thead><tbody>'+lines+'</tbody></table>'+
  '<div class="voltec-fallback-total">TOTALS · '+summ.ordered+' ordered · '+summ.shipped+' shipped · '+summ.backordered+
  ' backordered'+(summ.casesKnown?' · '+summ.knownCases+' cases pulled':'')+'</div>'+
  '<div class="voltec-fallback-total"><strong>SHIPPING: '+
  (shipping.shippingMethod==='pallets'?shipping.palletCount+' pallet(s)':'Cartons')+
  ' · Actual boxes: '+(shipping.shippingCartons===null?'not entered':shipping.shippingCartons)+
  '</strong> · Final shipping weight (manual): '+
  (shipping.manualTotalWeightLb===null?'Not entered':shipping.manualTotalWeightLb.toFixed(2)+' lb')+'</div>'+
  (o.notes?'<p class="voltec-fallback-notes">'+esc(o.notes)+'</p>':'')+'</div>';
}
if(typeof window!=='undefined')window.voltecPackingHTML=voltecPackingHTML;
if(typeof module!=='undefined'&&module.exports)
 module.exports={voltecPackingNormalize,voltecPackingSummary,voltecPackingBuildPDF,voltecPackingHTML,voltecPackingShippingTotals};
