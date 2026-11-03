/* Fills the ORIGINAL uploaded Magic City Supply one-page PDF template.
   The original vector art/text remains intact; empty item rows are covered
   and the original-style footer is moved immediately below used lines. */
'use strict';
const BJ_PDF_TEMPLATE='magic-city-po-template.base64';
let bjPdfTemplateBytes=null,bjPdfLibraryPromise=null,bjPdfPrinting=false;
async function bjPdfLoadLibrary(){
 if(globalThis.PDFLib?.PDFDocument)return globalThis.PDFLib;
 if(!bjPdfLibraryPromise){
  bjPdfLibraryPromise=new Promise((resolve,reject)=>{
   const s=document.createElement('script');
   s.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
   s.async=true;
   const timer=setTimeout(()=>reject(Error('PDF editor timed out. Try again online.')),25000);
   s.onload=()=>{clearTimeout(timer);globalThis.PDFLib?.PDFDocument?resolve(globalThis.PDFLib):reject(Error('PDF editor unavailable.'))};
   s.onerror=()=>{clearTimeout(timer);reject(Error('Could not load the PDF editor.'))};
   document.head.appendChild(s);
  }).catch(e=>{bjPdfLibraryPromise=null;throw e});
 }
 return bjPdfLibraryPromise;
}
async function bjPdfLoadTemplate(){
 if(bjPdfTemplateBytes)return bjPdfTemplateBytes;
 const res=await fetch(BJ_PDF_TEMPLATE,{cache:'force-cache'});
 if(!res.ok)throw Error('Original Magic City Supply PDF template could not be loaded.');
 const encoded=(await res.text()).replace(/\s/g,'');
 if(!encoded.startsWith('JVBERi0')||encoded.length<2000)throw Error('The purchase-order PDF template is invalid.');
 const binary=atob(encoded);
 bjPdfTemplateBytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return bjPdfTemplateBytes;
}
function bjPdfClean(value){return String(value??'').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim()}
function bjPdfDate(value){
 if(!value)return '';
 const parts=String(value).slice(0,10).split('-');
 if(parts.length===3&&parts[0].length===4)return Number(parts[1])+'/'+Number(parts[2])+'/'+parts[0];
 return bjPdfClean(value);
}

/* Fill the original Magic City Supply PDF full-size, with a priced-order
   total immediately below the final item row when prices were entered. */
function bjCalculatePriceSummary(lines){
 const rows=Array.isArray(lines)?lines:[];
 let totalCents=0,pricedLines=0;
 for(const item of rows){
  if(item?.price==null||String(item.price).trim()==='')continue;
  const qty=Number(item.qty), price=Number(item.price);
  if(!Number.isSafeInteger(qty)||qty<0||!Number.isFinite(price)||price<0)continue;
  const cents=Math.round(price*100),extended=cents*qty;
  if(!Number.isSafeInteger(extended))continue;
  totalCents+=extended;pricedLines++;
 }
 return {totalCents,pricedLines,unpricedLines:rows.length-pricedLines};
}
function bjFormatUSD(cents){
 return '$'+(cents/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function bjLocationFieldsForCopy(line,copyType='warehouse'){
 if(copyType==='clean')return {location:'',sourceLabel:''};
 return {
  location:String(line?.location||''),
  sourceLabel:line?.source==='eiko'?'EiKO WAREHOUSE':'OUR WAREHOUSE'
 };
}
async function bjFillOriginalPDF(order,templateBytes,options={}){
 const {PDFDocument,StandardFonts,rgb}=await bjPdfLoadLibrary();
 const original=await PDFDocument.load(templateBytes);
 const srcPage=original.getPage(0);
 const output=await PDFDocument.create();
 const regular=await output.embedFont(StandardFonts.Helvetica);
 const bold=await output.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(.11,.21,.30),muted=rgb(.35,.46,.54),white=rgb(1,1,1);
 const lines=Array.isArray(order.lines)?order.lines:[];
 const copyType=options.copyType==='clean'?'clean':'warehouse';
 if(!lines.length)throw Error('This BJ request does not contain any item lines.');
 const totals=bjCalculatePriceSummary(lines);
 const maxRows=totals.pricedLines>0?19:22,headHeight=307,rowHeight=19,footerHeight=67,sourceHeight=792,sourceWidth=612;
 for(let offset=0;offset<lines.length;offset+=maxRows){
  const visible=lines.slice(offset,offset+maxRows);
  const n=visible.length;
  const height=sourceHeight;
  const page=output.addPage([sourceWidth,height]);
  const [topGraphic,rowGraphic,footerGraphic]=await output.embedPages(
   [srcPage,srcPage,srcPage],
   [
    {left:0,bottom:sourceHeight-headHeight,right:sourceWidth,top:sourceHeight},
    {left:0,bottom:sourceHeight-headHeight-n*rowHeight,right:sourceWidth,top:sourceHeight-headHeight},
    {left:0,bottom:0,right:sourceWidth,top:footerHeight}
   ]
  );
  page.drawPage(topGraphic,{x:0,y:sourceHeight-headHeight,width:sourceWidth,height:headHeight});
  page.drawPage(rowGraphic,{x:0,y:sourceHeight-headHeight-n*rowHeight,width:sourceWidth,height:n*rowHeight});
  page.drawPage(footerGraphic,{x:0,y:0,width:sourceWidth,height:footerHeight});
  const top=y=>height-y;
  function put(x,y,value,{size=8.5,width=240,boldText=false,align='left',color=navy}={}){
   const raw=bjPdfClean(value);
   if(!raw)return;
   const font=boldText?bold:regular;
   let s=size,display=raw;
   while(s>5.2&&font.widthOfTextAtSize(display,s)>width)s-=0.3;
   if(font.widthOfTextAtSize(display,s)>width){
    while(display.length>4&&font.widthOfTextAtSize(display+'...',s)>width)display=display.slice(0,-1);
    display+='...';
   }
   const drawX=align==='right'?x-font.widthOfTextAtSize(display,s):x;
   page.drawText(display,{x:drawX,y:top(y),font,size:s,color});
  }
  // Same positions used by the supplied printed PDF. The original Magic City
  // title is left untouched; no Cahaba logo is ever inserted in BJ documents.
  put(414,96,order.po_number||'RNG',{size:9.4,width:143,boldText:true});
  put(159,98,'SHIP FROM: CAHABA SALES GROUP',{size:7.0,width:235,boldText:true});
  put(40,125,'EiKO',{size:9,width:260,boldText:true});
  put(314,125,bjPdfDate(order.order_date),{size:9,width:220});
  put(40,186,order.vendor_address||'',{size:8.5,width:260});
  put(314,186,order.ship_to||'Magic City Supply',{size:9,width:240,boldText:true});
  const obsolete='113 45th Place North, Birmingham, AL 35222';
  const destination=order.ship_to_address===obsolete?'':(order.ship_to_address||'');
  put(40,219,destination,{size:8.4,width:530});
  put(40,247,order.ship_via||'',{size:8,width:121});
  put(175,247,order.fob||'',{size:8,width:121});
  put(307,247,order.terms||'',{size:8,width:121});
  put(439,247,bjPdfDate(order.date_required),{size:8,width:121});
  for(let i=0;i<n;i++){
   const l=visible[i],rowTop=headHeight+rowHeight*i;
   put(139,rowTop+12,l.qty,{size:9,width:62,align:'right',boldText:true});
   put(150,rowTop+8.9,l.part||l.code,{size:8.2,width:229,boldText:true});
   const smaller=[l.code?'EiKO CODE: '+l.code:'',l.note?'NOTE: '+l.note:'',l.description||''].filter(Boolean).join('  |  ');
   put(150,rowTop+16.1,smaller,{size:6.4,width:229,color:muted});
   const price=l.price==null||l.price===''?'':Number(l.price).toFixed(2);
   put(438,rowTop+12,price,{size:8,width:48,align:'right'});
   put(450,rowTop+12,l.per||'',{size:7.6,width:29});
   const locationFields=bjLocationFieldsForCopy(l,copyType);
   put(489,rowTop+9,locationFields.location,{size:8.2,width:76});
   put(489,rowTop+16.5,locationFields.sourceLabel,{size:5.7,width:76,color:muted});
  }
  // Footer is preserved directly from the original template and shifted
  // upward to follow the final item. The buyer remains blank unless entered.
  // Total is printed directly under the last entered item on a full-size page.
  if(totals.pricedLines>0){
   const pageTotals=bjCalculatePriceSummary(visible);
   const isLastPage=offset+n>=lines.length;
   const money=isLastPage?totals.totalCents:pageTotals.totalCents;
   const heading=isLastPage?(totals.unpricedLines?'TOTAL (PRICED ITEMS ONLY)':'ORDER TOTAL'):'PAGE SUBTOTAL';
   const y=headHeight+n*rowHeight+9;
   page.drawLine({start:{x:355,y:top(y)},end:{x:566,y:top(y)},thickness:.7,color:muted});
   put(357,y+17,heading,{size:8,width:175,boldText:true});
   put(565,y+17,bjFormatUSD(money),{size:11,width:118,boldText:true,align:'right'});
   if(isLastPage&&totals.unpricedLines)
    put(357,y+30,totals.unpricedLines+' item(s) without prices excluded',{size:7,width:206,color:muted});
  }
  const buyer=bjPdfClean(order.buyer||'');
  if(buyer){
   const footerTop=sourceHeight-footerHeight;
   page.drawRectangle({x:452,y:top(footerTop+15),width:105,height:13,color:white});
   put(456,footerTop+11,buyer,{size:8.4,width:99,boldText:true});
  }
 }
 output.setTitle('Magic City Supply - '+(copyType==='clean'?'Clean Copy':'Warehouse Copy')+' - Purchase Order '+(order.po_number||'CSG-####'));
 output.setAuthor('Magic City Supply');
 output.setSubject('BJ walk-in purchasing request from Cahaba Sales Group');
 return await output.save();
}
async function bjFillBothCopiesPDF(order,templateBytes){
 const {PDFDocument}=await bjPdfLoadLibrary();
 const merged=await PDFDocument.create();
 // Print in picking order: our location-marked warehouse copy first,
 // followed by an outward-facing clean copy without warehouse locations.
 for(const copyType of ['warehouse','clean']){
  const bytes=await bjFillOriginalPDF(order,templateBytes,{copyType});
  const doc=await PDFDocument.load(bytes);
  const pages=await merged.copyPages(doc,doc.getPageIndices());
  pages.forEach(p=>merged.addPage(p));
 }
 merged.setTitle('Magic City Supply - '+(order.po_number||'CSG-####')+' - Warehouse and Clean Copies');
 merged.setSubject('Two copies: internal warehouse locations and clean external purchase order');
 return await merged.save();
}
let bjPDFPreviewURL=null,bjPDFPreviewSerial=0,bjPDFPreviewOrderID=null;
async function bjPreviewOriginalPDF(order){
 const serial=++bjPDFPreviewSerial;
 const panel=document.getElementById('bjPrintPaper');
 const status=document.getElementById('bjPDFStatus');
 if(panel)panel.innerHTML='<div class="card">Preparing the original Magic City Supply PDF preview…</div>';
 if(status)status.textContent='Filling your original Magic City Supply PDF…';
 try{
  const [bytes]=await Promise.all([bjPdfLoadTemplate(),bjPdfLoadLibrary()]);
  const generated=await bjFillOriginalPDF(order,bytes);
  if(serial!==bjPDFPreviewSerial)return;
  if(bjPDFPreviewURL)URL.revokeObjectURL(bjPDFPreviewURL);
  const blob=new Blob([generated],{type:'application/pdf'});
  bjPDFPreviewURL=URL.createObjectURL(blob);
  bjPDFPreviewOrderID=order.id;
  if(panel){
   const frame=document.createElement('iframe');
   frame.src=bjPDFPreviewURL+'#toolbar=1&navpanes=0';
   frame.title='Original Magic City Supply purchase order PDF';
   frame.style.cssText='display:block;width:100%;height:min(76vh,850px);min-height:420px;border:0;background:#fff';
   panel.replaceChildren(frame);
  }
  if(status){
   const info=bjCalculatePriceSummary(order.lines);
   status.textContent=generated.length.toLocaleString()+' PDF bytes · '+Math.ceil(order.lines.length/(info.pricedLines?19:22))+' page(s) · '+order.lines.length+' filled line(s)'
     +(info.pricedLines?' · '+(info.unpricedLines?'Priced items total: ':'Order total: ')+bjFormatUSD(info.totalCents):'');
  }
 }catch(error){
  if(status)status.textContent='Preview unavailable: '+error.message+'. Try Open Original PDF or Download Filled PDF.';
  if(panel)panel.innerHTML='<div class="card">Could not render the PDF preview. Use the download button above.</div>';
 }
}

async function bjExportOriginalPDF(download=false,copyType='both'){
 if(bjPdfPrinting)return;
 const order=bjOrders.find(o=>o.id===bjCurrentPrintID)||bjCurrentPrintOrder;
 if(!order){bjToast('Select a BJ request before printing.',true);return}
 // Reserve the browser tab immediately so Safari/Chrome do not block it after
 // asynchronous PDF generation. Downloads do not need a new tab.
 let tab=null;
 if(!download)tab=window.open('','_blank');
 bjPdfPrinting=true;
 const status=bjField('bjPDFStatus');
 if(status)status.textContent='Filling the original Magic City Supply PDF…';
 try{
  const [template]=await Promise.all([bjPdfLoadTemplate(),bjPdfLoadLibrary()]);
  const selected=['warehouse','clean','both'].includes(copyType)?copyType:'both';
  const bytes=selected==='both'
    ?await bjFillBothCopiesPDF(order,template)
    :await bjFillOriginalPDF(order,template,{copyType:selected});
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const filename=(order.po_number||'BJ-PO').replace(/[^a-zA-Z0-9-]/g,'_')+'-'+(
    selected==='warehouse'?'Warehouse-With-Locations':
    selected==='clean'?'Clean-Without-Locations':'Both-Copies'
  )+'-Magic-City-Supply.pdf';
  if(download){
   const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  }else if(tab){
   tab.location.href=url;
  }else{
   const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  }
  if(status){
   const info=bjCalculatePriceSummary(order.lines);
   status.textContent='Filled original PDF created. '+(
     Math.ceil(order.lines.length/(info.pricedLines?19:22))*(copyType==='both'?2:1)
    )+' page(s), '+order.lines.length+' item line(s) per copy'
     +(info.pricedLines?', '+(info.unpricedLines?'priced items total ':'order total ')+bjFormatUSD(info.totalCents):'')+'.';
  }
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 }catch(error){
  if(tab)try{tab.close()}catch{}
  if(status)status.textContent='Could not generate PDF: '+error.message;
 }finally{bjPdfPrinting=false}
}
if(typeof module!=='undefined'&&module.exports)module.exports={bjFillOriginalPDF,bjFillBothCopiesPDF,bjLocationFieldsForCopy,bjPdfDate,bjPdfClean,bjCalculatePriceSummary,bjFormatUSD};
