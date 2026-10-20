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
async function bjFillOriginalPDF(order,templateBytes){
 const {PDFDocument,StandardFonts,rgb}=await bjPdfLoadLibrary();
 const inputPDF=await PDFDocument.load(templateBytes);
 const resultPDF=await PDFDocument.create();
 const normal=await resultPDF.embedFont(StandardFonts.Helvetica);
 const bold=await resultPDF.embedFont(StandardFonts.HelveticaBold);
 const dark=rgb(.11,.21,.30),medium=rgb(.35,.46,.54),rule=rgb(.77,.81,.84),white=rgb(1,1,1);
 const rows=Array.isArray(order.lines)?order.lines:[];
 const pageCount=Math.max(1,Math.ceil(rows.length/22));
 for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
  const [page]=await resultPDF.copyPages(inputPDF,[0]);
  resultPDF.addPage(page);
  const height=page.getHeight();
  const top=(y)=>height-y;
  function put(x,topPos,value,options={}){
   const raw=bjPdfClean(value);if(!raw)return;
   const font=options.bold?bold:normal;
   const defaultSize=options.size||8.5;
   const maxWidth=options.width||250;
   let size=defaultSize;
   while(size>5.2&&font.widthOfTextAtSize(raw,size)>maxWidth)size-=.3;
   let output=raw;
   if(font.widthOfTextAtSize(output,size)>maxWidth){
    while(output.length>4&&font.widthOfTextAtSize(output+'...',size)>maxWidth)output=output.slice(0,-1);
    output+='...';
   }
   let xPos=x;
   if(options.align==='right')xPos=x-font.widthOfTextAtSize(output,size);
   page.drawText(output,{x:xPos,y:top(topPos),font,size,color:options.color||dark});
  }
  // The original title reads MAGIC CITY SUPPLY. No Cahaba logo is added.
  put(414,96,order.po_number,{size:11,bold:true,width:146});
  put(159,98,'SHIP FROM: CAHABA SALES GROUP',{size:7,bold:true,width:239});
  put(40,125,'EiKO',{size:9,bold:true,width:260});
  put(314,125,bjPdfDate(order.order_date),{size:9,width:235});
  put(40,186,order.vendor_address||'',{size:8.5,width:266});
  put(314,186,'Magic City Supply',{size:9,bold:true,width:250});
  const oldAddress='113 45th Place North, Birmingham, AL 35222';
  const recipientAddress=order.ship_to_address===oldAddress?'':(order.ship_to_address||'');
  put(40,219,recipientAddress,{size:8.5,width:523});
  put(40,247,order.ship_via||'',{size:8.2,width:119});
  put(175,247,order.fob||'',{size:8.2,width:119});
  put(307,247,order.terms||'',{size:8.2,width:119});
  put(439,247,bjPdfDate(order.date_required),{size:8.2,width:119});
  const onPage=rows.slice(pageIndex*22,(pageIndex+1)*22);
  for(let i=0;i<onPage.length;i++){
   const l=onPage[i],rowTop=309+19*i;
   put(139,rowTop+12,l.qty,{size:9,bold:true,width:63,align:'right'});
   const primary=bjPdfClean(l.part||l.code);
   put(150,rowTop+8.9,primary,{size:8.2,bold:true,width:229});
   const desc=[l.code?'EiKO CODE: '+l.code:'',l.description||''].filter(Boolean).join('  |  ');
   put(150,rowTop+16.1,desc,{size:6.4,width:229,color:medium});
   const price=l.price==null||l.price===''?'':Number(l.price).toFixed(2);
   put(438,rowTop+12,price,{size:8,width:48,align:'right'});
   put(450,rowTop+12,l.per||'',{size:7.6,width:29});
   put(489,rowTop+12,l.location||'',{size:8.2,width:76});
  }
  const bottom=309+19*onPage.length;
  // Remove every unused preprinted line, its line number, and the old footer
  // without touching the uploaded PDF's vendor, title or item table header.
  page.drawRectangle({x:39,y:top(773.5),width:535,height:773.5-bottom-.5,color:white,borderWidth:0});
  put(40,bottom+16,'Order number must appear on invoices, packages, and correspondence.',{size:7.2,width:354});
  put(420,bottom+16,'BUYER: '+(order.buyer||'Brent'),{size:8,bold:true,width:145});
  page.drawLine({start:{x:40,y:top(bottom+28)},end:{x:572,y:top(bottom+28)},thickness:.5,color:rule});
  put(40,bottom+43,'MAGIC CITY SUPPLY | PURCHASE ORDER',{size:8,bold:true,width:280});
 }
 resultPDF.setTitle('Magic City Supply - Purchase Order '+(order.po_number||'BJ'));
 resultPDF.setAuthor('Cahaba Sales Group');
 resultPDF.setSubject('BJ walk-in purchasing request');
 return await resultPDF.save();
}
async function bjExportOriginalPDF(download=false){
 if(bjPdfPrinting)return;
 const order=bjOrders.find(o=>o.id===bjCurrentPrintID);
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
  const bytes=await bjFillOriginalPDF(order,template);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const filename=(order.po_number||'BJ-PO').replace(/[^a-zA-Z0-9-]/g,'_')+'-Magic-City-Supply.pdf';
  if(download){
   const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  }else if(tab){
   tab.location.href=url;
  }else{
   const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  }
  if(status)status.textContent='Filled original PDF created. '+Math.max(1,Math.ceil((order.lines||[]).length/22))+' page(s), '+(order.lines||[]).length+' printed part line(s).';
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 }catch(error){
  if(tab)try{tab.close()}catch{}
  if(status)status.textContent='Could not generate PDF: '+error.message;
 }finally{bjPdfPrinting=false}
}
if(typeof module!=='undefined'&&module.exports)module.exports={bjFillOriginalPDF,bjPdfDate,bjPdfClean};
