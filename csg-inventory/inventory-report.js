/* CSG Warehouse - supplier-ready inventory export.
   Uses authenticated, fresh csg-inventory state and makes NO inventory changes.
   PDF is a shareable supplier document. CSV is for supplier spreadsheets.
*/
(function(root){
'use strict';
const COLORS={
 navy:[23,48,68],ink:[32,52,68],muted:[92,109,120],yellow:[240,207,61],
 pale:[243,246,247],line:[214,223,228],white:[255,255,255],warm:[254,252,244]
};
function csgSupplierReportData(content,division,updatedAt,generatedAt){
 const d=division==='voltec'?'voltec':'eiko';
 const source=d==='voltec'?(content?.voltec||[]):(content?.items||[]);
 const entries=source.map(item=>({
  part:String(item.part??'').trim(),
  code:String(item.code??'').trim(),
  qty:Number(item.qty)
 })).filter(item=>item.part&&Number.isSafeInteger(item.qty)&&item.qty>=0)
 .sort((a,b)=>a.part.localeCompare(b.part,undefined,{numeric:true,sensitivity:'base'}));
 return {
  division:d,supplier:d==='voltec'?'Voltec':'EiKO',
  codeLabel:d==='voltec'?'ITEM CODE':'EIKO ORDERING CODE',
  entries,totalParts:entries.length,
  totalUnits:entries.reduce((sum,item)=>sum+item.qty,0),
  outOfStock:entries.filter(item=>item.qty===0).length,
  updatedAt:updatedAt||null,
  generatedAt:generatedAt||new Date().toISOString()
 };
}
function csgReportSafeText(v){
 return String(v??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim();
}
function csgReportCsvCell(v){
 let s=String(v??'').replace(/\r\n?/g,' ').replace(/\n/g,' ');
 // CSV quotations are insufficient to prevent Excel formula injection.
 if(/^[\s]*[=+@-]/.test(s)&&!/^-[0-9]+$/.test(s))s="'"+s;
 return '"'+s.replace(/"/g,'""')+'"';
}
function csgSupplierReportCSV(report){
 const lines=[['Supplier','Part Number / SKU','Ordering Code','Quantity On Hand','Stock Updated At']];
 for(const item of report.entries){
  lines.push([report.supplier,item.part,item.code,item.qty,report.updatedAt||'']);
 }
 return '\uFEFF'+lines.map(row=>row.map(csgReportCsvCell).join(',')).join('\r\n')+'\r\n';
}
function csgReportFileDate(iso){
 const dt=iso?new Date(iso):new Date();
 const d=isNaN(dt.getTime())?new Date():dt;
 return [
  d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')
 ].join('-');
}
function csgReportTime(iso){
 if(!iso)return 'Not available';
 const d=new Date(iso);if(isNaN(d.getTime()))return String(iso);
 return d.toLocaleString('en-US',{year:'numeric',month:'short',day:'numeric',
   hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'});
}
function csgReportColor(rgb,arr){return rgb(arr[0]/255,arr[1]/255,arr[2]/255)}
function csgReportWrap(text,font,size,maxWidth,maxLines=2){
 const words=csgReportSafeText(text).split(/\s+/).filter(Boolean);
 if(!words.length)return [''];
 const lines=[];let current='';
 for(const word of words){
  const test=current?current+' '+word:word;
  if(font.widthOfTextAtSize(test,size)<=maxWidth){current=test;continue}
  if(current){lines.push(current);current='';if(lines.length>=maxLines)break}
  let chunk=word;
  while(chunk.length>1&&font.widthOfTextAtSize(chunk,size)>maxWidth)chunk=chunk.slice(0,-1);
  current=chunk;
  if(chunk!==word)break;
 }
 if(lines.length<maxLines&&current)lines.push(current);
 if(lines.length===0)lines.push('');
 if(lines.length>=maxLines&&words.join(' ')!==lines.join(' ')){
  let last=lines[maxLines-1];
  while(last.length>1&&font.widthOfTextAtSize(last+'...',size)>maxWidth)last=last.slice(0,-1);
  lines[maxLines-1]=last+'...';
 }
 return lines.slice(0,maxLines);
}
async function csgSupplierReportPDF(report,options={}){
 const pdfLib=options.pdfLib||globalThis.PDFLib||(typeof bjPdfLoadLibrary==='function'?await bjPdfLoadLibrary():null);
 if(!pdfLib?.PDFDocument)throw Error('PDF generator unavailable. Please try again online.');
 const {PDFDocument,StandardFonts,rgb}=pdfLib;
 const pdf=await PDFDocument.create();
 const regular=await pdf.embedFont(StandardFonts.Helvetica);
 const semibold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const c={};for(const [key,value] of Object.entries(COLORS))c[key]=csgReportColor(rgb,value);
 let logo=null;
 if(options.logoBytes){
  try{logo=await pdf.embedJpg(options.logoBytes)}catch{}
 }
 const W=612,H=792,left=42,right=570,contentW=right-left;
 let page,y,pageNo=0;
 const pages=[];
 function write(text,x,baseline,size=9,font=regular,color=c.ink,opts={}){
  const safe=csgReportSafeText(text);
  const max=opts.maxWidth||Infinity;
  let actual=safe;
  if(font.widthOfTextAtSize(actual,size)>max){
   while(actual.length>1&&font.widthOfTextAtSize(actual+'...',size)>max)actual=actual.slice(0,-1);
   actual+='...';
  }
  page.drawText(actual,{x:opts.right?x-font.widthOfTextAtSize(actual,size):x,
    y:baseline,size,font,color});
 }
 function line(x1,y1,x2,y2,color=c.line,width=.7){
  page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color,thickness:width});
 }
 function frame(first){
  page=pdf.addPage([W,H]);pages.push(page);pageNo++;
  page.drawRectangle({x:0,y:H-85,width:W,height:85,color:c.navy});
  page.drawRectangle({x:0,y:H-90,width:W,height:5,color:c.yellow});
  if(logo){
   // Show the original CSG logo on a white background for reliable print output.
   page.drawRectangle({x:left,y:726,width:92,height:46,color:c.white});
   const fitted=logo.scaleToFit(86,42);
   page.drawImage(logo,{x:left+(92-fitted.width)/2,y:728+(42-fitted.height)/2,
      width:fitted.width,height:fitted.height});
  }else{
   page.drawRectangle({x:left,y:733,width:56,height:33,color:c.yellow});
   write('CSG',left+8,743,18,semibold,c.navy);
  }
  write('CAHABA SALES GROUP',logo?151:112,755,16,semibold,c.white);
  write('SUPPLIER INVENTORY REPORT',logo?151:112,735,10,semibold,c.white);
  write('113 45th Place North  |  Birmingham, AL 35222',left,H-120,9,regular,c.muted);
  const footer='Supplier coordination only  |  Quantities subject to change  |  No pricing or internal warehouse data';
  line(left,49,right,49);
  write(footer,left,36,7,regular,c.muted,{maxWidth:445});

  if(first){
   write(report.supplier.toUpperCase()+' INVENTORY',left,631,21,semibold,c.ink);
   write('On-hand stock snapshot',left,612,10,regular,c.muted);
   write('Updated: '+csgReportTime(report.updatedAt),left,588,8.4,regular,c.muted);
   write('Generated: '+csgReportTime(report.generatedAt),left,574,8.4,regular,c.muted);
   const tiles=[
    {x:left,label:'PART NUMBERS',number:report.totalParts},
    {x:left+179,label:'TOTAL UNITS ON HAND',number:report.totalUnits},
    {x:left+358,label:'ZERO-QUANTITY ITEMS',number:report.outOfStock}
   ];
   for(const t of tiles){
    page.drawRectangle({x:t.x,y:494,width:170,height:62,color:c.pale});
    page.drawRectangle({x:t.x,y:551,width:170,height:5,color:c.yellow});
    write(t.label,t.x+12,532,7.4,semibold,c.muted,{maxWidth:149});
    write(Number(t.number).toLocaleString('en-US'),t.x+12,505,21,semibold,c.navy);
   }
   write('DETAILED STOCK REGISTER',left,470,10.5,semibold,c.ink);
   write('Includes all recorded SKUs, including zero-quantity items.',left,455,8.4,regular,c.muted);
   y=433;
  }else{
   write(report.supplier.toUpperCase()+' INVENTORY  /  CONTINUED',left,665,13,semibold,c.ink);
   write('Inventory updated: '+csgReportTime(report.updatedAt),left,645,8,regular,c.muted);
   y=617;
  }
  // Consistent supplier-facing table; intentionally excludes notes, staff,
  // private inventory thresholds, bin locations, and order history.
  const headerY=y;
  page.drawRectangle({x:left,y:headerY-30,width:contentW,height:30,color:c.navy});
  write('PART NUMBER / SKU',left+10,headerY-19,8.1,semibold,c.white);
  write(report.division==='eiko'?'EIKO ORDER CODE':'ITEM CODE',250,headerY-19,8,semibold,c.white);
  write('QTY ON HAND',right-10,headerY-19,8.1,semibold,c.white,{right:true});
  y=headerY-30;
 }
 frame(true);
 if(!report.entries.length){
  page.drawRectangle({x:left,y:y-56,width:contentW,height:56,color:c.pale});
  write('No recorded parts in this inventory.',left+12,y-34,11,regular,c.muted);
 }else{
  for(let i=0;i<report.entries.length;i++){
   if(y-34<72)frame(false);
   const item=report.entries[i];
   const rowH=34;
   if(i%2===1)page.drawRectangle({x:left,y:y-rowH,width:contentW,height:rowH,color:c.pale});
   const partLines=csgReportWrap(item.part,semibold,8.5,192,2);
   write(partLines[0],left+10,y-15,8.5,semibold,c.ink,{maxWidth:187});
   if(partLines[1])write(partLines[1],left+10,y-26,7.5,regular,c.ink,{maxWidth:187});
   write(item.code||'-',250,y-19,8.4,regular,c.ink,{maxWidth:156});
   write(item.qty.toLocaleString('en-US'),right-13,y-19,10,semibold,
     item.qty===0?c.muted:c.navy,{right:true});
   line(left,y-rowH,right,y-rowH,c.line,.5);
   y-=rowH;
  }
 }
 const final=pdf.getPages();
 // Number the footer after the complete report is paginated.
 for(let i=0;i<final.length;i++){
  const label='Page '+(i+1)+' of '+final.length;
  final[i].drawText(label,{
   x:567-semibold.widthOfTextAtSize(label,7.5),y:36,size:7.5,font:semibold,color:c.muted
  });
 }
 pdf.setTitle('Cahaba Sales Group - '+report.supplier+' Inventory Report');
 pdf.setAuthor('Cahaba Sales Group');
 pdf.setSubject('Supplier-facing warehouse on-hand inventory');
 pdf.setKeywords(['Cahaba Sales Group','supplier inventory',report.supplier]);
 return pdf.save();
}
async function csgReportLogoBytes(){
 const r=await fetch('csg-logo.base64',{cache:'force-cache'});
 if(!r.ok)throw Error('Logo unavailable');
 const encoded=(await r.text()).replace(/\s/g,'');
 const binary=atob(encoded);
 return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
function csgDownloadBlob(blob,filename){
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function csgDownloadSupplierReport(kind='pdf'){
 const status=document.getElementById('supplierReportStatus');
 const btn=document.getElementById(kind==='csv'?'supplierCsvButton':'supplierPdfButton');
 if(!status||btn?.disabled)return;
 if(btn)btn.disabled=true;
 status.textContent='Refreshing the shared inventory and preparing your '+kind.toUpperCase()+' report...';
 try{
  if(typeof request!=='function')throw Error('Please sign in to the warehouse first.');
  // Fetch a fresh authenticated snapshot. Do not read the stale visible table
  // or allow a typed search filter to exclude some stock entries.
  const r=await request('state');
  const scope=activeDivision==='voltec'?'voltec':'eiko';
  const report=csgSupplierReportData(r.content,scope,r.updated_at,new Date().toISOString());
  const base='CSG-'+report.supplier+'-Inventory-'+csgReportFileDate(report.generatedAt);
  if(kind==='csv'){
   csgDownloadBlob(new Blob([csgSupplierReportCSV(report)],{type:'text/csv;charset=utf-8'}),base+'.csv');
  }else{
   let logoBytes=null;
   try{logoBytes=await csgReportLogoBytes()}catch{}
   const bytes=await csgSupplierReportPDF(report,{logoBytes});
   csgDownloadBlob(new Blob([bytes],{type:'application/pdf'}),base+'.pdf');
  }
  status.textContent=report.supplier+' '+kind.toUpperCase()+' ready: '
    +report.totalParts+' part numbers, '+report.totalUnits.toLocaleString('en-US')
    +' units. Includes full inventory, not just search results.';
 }catch(error){
  status.textContent='Could not create report: '+(error.message||String(error));
 }finally{if(btn)btn.disabled=false}
}
root.csgSupplierReportData=csgSupplierReportData;
root.csgSupplierReportCSV=csgSupplierReportCSV;
root.csgSupplierReportPDF=csgSupplierReportPDF;
root.csgDownloadSupplierReport=csgDownloadSupplierReport;
if(typeof module!=='undefined'&&module.exports)
 module.exports={csgSupplierReportData,csgSupplierReportCSV,csgSupplierReportPDF,
  csgReportSafeText,csgReportWrap,csgReportTime,csgReportFileDate};
})(typeof window!=='undefined'?window:globalThis);
