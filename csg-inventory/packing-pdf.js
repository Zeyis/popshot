/* Cahaba Sales Group packing-list PDF generator.
   Uses the saved warehouse order; does not create or alter orders/stock.
   pdf-lib is shared with the existing BJ PDF generator.
*/
'use strict';
let packingPdfLogo=null,packingPreviewObjectURL=null,packingPreviewSerial=0,packingCurrentOrderId=null,packingPdfBusy=false;
function packingNormalizeOrder(order){
 if(!order||!Array.isArray(order.lines)||!order.lines.length)throw Error('This order does not have any packing-list lines.');
 return {
  id:String(order.id||''),number:String(order.number||'CSG-ORDER'),
  created:String(order.created||''),person:String(order.person||''),
  recipient:String(order.recipient||''),
  attention:String(order.shipAttention||''),street:String(order.shipStreet||''),
  city:String(order.shipCity||''),state:String(order.shipState||''),zip:String(order.shipZip||''),
  job:String(order.job||''),notes:String(order.notes||''),
  lines:order.lines.map((r,i)=>({
   index:i+1,division:r.division==='voltec'?'Voltec':'EiKO',
   part:String(r.part||''),code:String(r.code||''),description:String(r.desc||''),
   qty:Number.isFinite(Number(r.qty))?Number(r.qty):0
  })),
  totalUnits:order.lines.reduce((s,r)=>s+(Number(r.qty)||0),0)
 };
}
function packingSafeText(value){return String(value??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,' ').replace(/\s+/g,' ').trim()}
function packingDate(value){
 const d=new Date(value||Date.now());
 return Number.isNaN(d.getTime())?packingSafeText(value):d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});
}
function packingWrap(value,font,size,maxWidth,maxLines=2){
 const text=packingSafeText(value);
 if(!text)return [];
 const words=text.split(/\s+/);
 const result=[];
 let line='';
 const addWord=word=>{
  let wordPiece=word;
  while(wordPiece.length>1&&font.widthOfTextAtSize(wordPiece,size)>maxWidth)wordPiece=wordPiece.slice(0,-1);
  if(wordPiece!==word)wordPiece=wordPiece.slice(0,Math.max(0,wordPiece.length-3))+'...';
  return wordPiece;
 };
 for(const w of words){
  const tryLine=line?line+' '+w:w;
  if(font.widthOfTextAtSize(tryLine,size)<=maxWidth){line=tryLine;continue}
  if(line){result.push(line);line='';if(result.length===maxLines)break}
  line=addWord(w);
 }
 if(line&&result.length<maxLines)result.push(line);
 const out=result.slice(0,maxLines);
 if(out.length&&out.join(' ')!==text){
  let last=out[out.length-1];
  while(last.length>1&&font.widthOfTextAtSize(last+'...',size)>maxWidth)last=last.slice(0,-1);
  out[out.length-1]=last+'...';
 }
 return out;
}
async function packingBuildPDF(rawOrder,{pdfLib,logoBytes}={}){
 const {PDFDocument,StandardFonts,rgb}=pdfLib||globalThis.PDFLib||await bjPdfLoadLibrary();
 const order=packingNormalizeOrder(rawOrder);
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),
 bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const ink=rgb(.10,.19,.26),navy=rgb(.10,.21,.30),muted=rgb(.40,.47,.51),
 grey=rgb(.92,.95,.97),line=rgb(.79,.83,.86),white=rgb(1,1,1),gold=rgb(.96,.82,.17);
 let logo=null;
 if(logoBytes)try{logo=await pdf.embedJpg(logoBytes)}catch{}
 const pageW=612,pageH=792,left=42,right=570,usable=528;
 let page=null,y=0,pageNo=0;
 function write(text,x,base,size=9,useBold=false,color=ink,maxWidth=Infinity,alignRight=false){
  let v=packingSafeText(text),f=useBold?bold:font;
  if(!v)return;
  if(f.widthOfTextAtSize(v,size)>maxWidth){
   while(v.length>1&&f.widthOfTextAtSize(v+'...',size)>maxWidth)v=v.slice(0,-1);
   v+='...';
  }
  page.drawText(v,{x:alignRight?x-f.widthOfTextAtSize(v,size):x,y:base,font:f,size,color});
 }
 function divider(at,from=left,to=right){page.drawLine({start:{x:from,y:at},end:{x:to,y:at},thickness:.6,color:line});}
 function tableHeader(){
  page.drawRectangle({x:left,y:y-27,width:usable,height:27,color:navy});
  write('#',left+10,y-18,8.1,true,white);
  write('PART NUMBER / DESCRIPTION',left+39,y-18,8.1,true,white);
  write('ORDER CODE',left+348,y-18,8.1,true,white);
  write('QTY',right-12,y-18,8.1,true,white,80,true);
  y-=27;
 }
 function newPage(first=false){
  page=pdf.addPage([pageW,pageH]);pageNo++;
  page.drawRectangle({x:0,y:694,width:pageW,height:98,color:navy});
  page.drawRectangle({x:0,y:690,width:pageW,height:4,color:gold});
  if(logo){
   page.drawRectangle({x:left,y:716,width:112,height:54,color:white});
   const scaled=logo.scaleToFit(106,48);
   page.drawImage(logo,{x:left+(112-scaled.width)/2,y:719+(48-scaled.height)/2,width:scaled.width,height:scaled.height});
  }else{
   page.drawRectangle({x:left,y:728,width:55,height:35,color:gold});
   write('CSG',left+7,738,19,true,navy);
  }
  write('CAHABA SALES GROUP',logo?168:116,753,13.5,true,white);
  write('WAREHOUSE OPERATIONS',logo?168:116,735,9,false,white);
  write('PACKING LIST',right,750,17,true,white,190,true);
  write(order.number,right,727,9.3,true,white,190,true);
  divider(59);
  write('CAHABA SALES GROUP  |  113 45th Place North, Birmingham, AL 35222',left,45,7.3,false,muted,470);
  if(first){
   write('ORDER NUMBER',left,657,8,true,muted);
   write(order.number,left,637,11,true,navy);
   write('DATE PREPARED',196,657,8,true,muted);
   write(packingDate(order.created),196,637,9.2,false,ink);
   write('PREPARED BY',344,657,8,true,muted);
   write(order.person||'-',344,637,9.2,false,ink);
   write('JOB / PROJECT',left,606,8,true,muted);
   write(order.job||'-',left,587,9.2,false,ink,470);
   divider(576);
   write('SHIP FROM',left,552,8,true,muted);
   write('Cahaba Sales Group',left,532,11,true,navy);
   write('113 45th Place North',left,517,9,false,ink);
   write('Birmingham, AL 35222',left,502,9,false,ink);
   write('SHIP TO',328,552,8,true,muted);
   write(order.recipient||'Destination not entered',328,532,10,true,navy,236);
   let yy=516;
   for(const segment of [order.attention?('Attn: '+order.attention):'',order.street,
    [order.city,order.state,order.zip].filter(Boolean).join(', ').replace(/, ([^,]+), /,', $1 ')].filter(Boolean)){
    write(segment,328,yy,8.8,false,ink,235);yy-=14;
   }
   divider(475);
   write('ORDER CONTENTS',left,456,10.5,true,navy);
   write(order.lines.length+' line item(s)',right,456,9,false,muted,145,true);
   y=444;
  }else{
   write('PACKING LIST / CONTINUED',left,654,10,true,navy);
   write('Order '+order.number+'   |   '+order.recipient,left,636,9,false,muted,470);
   y=617;
  }
  tableHeader();
 }
 newPage(true);
 for(const item of order.lines){
  const part=packingWrap(item.part,bold,9,252,2);
  const desc=packingWrap((item.division+(item.description?'  |  '+item.description:'')),font,7.5,252,2);
  const height=26+(part.length===2?10:0)+(desc.length?12+(desc.length===2?10:0):0);
  if(y-height<125)newPage(false);
  const bottom=y-height;
  if(item.index%2===0)page.drawRectangle({x:left,y:bottom,width:usable,height,color:grey});
  write(item.index,left+10,y-17,8.3,false,muted);
  const pLines=part.length?part:['-'];pLines.forEach((text,j)=>write(text,left+39,y-15-j*11,9,true,ink,252));
  desc.forEach((text,j)=>write(text,left+39,y-15-pLines.length*11-j*10,7.5,false,muted,252));
  write(item.code||'-',left+348,y-19,9,false,ink,118);
  write(item.qty.toLocaleString('en-US'),right-12,y-19,10,true,navy,64,true);
  divider(bottom);
  y=bottom;
 }
 const notes=packingWrap(order.notes,font,8.5,usable-20,4);
 const notesHeight=notes.length?25+notes.length*12:0;
 if(y-(notesHeight+74)<100)newPage(false);
 y-=16;
 divider(y);
 write('TOTAL LINE ITEMS',left+6,y-19,8,true,muted);
 write(order.lines.length,left+6,y-38,13,true,navy);
 write('TOTAL UNITS',right-139,y-19,8,true,muted);
 write(order.totalUnits.toLocaleString('en-US'),right-12,y-41,21,true,navy,114,true);
 y-=59;
 if(notes.length){
  page.drawRectangle({x:left,y:y-notesHeight,width:usable,height:notesHeight,color:grey});
  write('DELIVERY / HANDLING NOTES',left+10,y-16,8,true,navy);
  notes.forEach((t,i)=>write(t,left+10,y-30-i*11,8.2,false,ink,usable-20));
 }
 pdf.setTitle('Cahaba Sales Group - Packing List - '+order.number);
 pdf.setAuthor('Cahaba Sales Group');
 pdf.setSubject('Order packing list and shipping contents');
 const pages=pdf.getPages();
 for(let i=0;i<pages.length;i++){
  const label='Page '+(i+1)+' of '+pages.length;
  pages[i].drawText(label,{x:right-bold.widthOfTextAtSize(label,8),y:45,size:8,font:bold,color:muted});
 }
 return pdf.save();
}
async function packingLoadLogo(){
 if(packingPdfLogo)return packingPdfLogo;
 const r=await fetch('csg-logo.base64',{cache:'force-cache'});
 if(!r.ok)throw Error('Cahaba logo unavailable');
 const encoded=(await r.text()).replace(/\s/g,'');
 const binary=atob(encoded);
 packingPdfLogo=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return packingPdfLogo;
}
async function packingGenerateBlob(order){
 const [lib,logo]=await Promise.all([bjPdfLoadLibrary(),packingLoadLogo().catch(()=>null)]);
 const bytes=await packingBuildPDF(order,{pdfLib:lib,logoBytes:logo});
 return new Blob([bytes],{type:'application/pdf'});
}
function packingStatus(message,isError=false){
 const el=document.getElementById('packingPdfStatus');
 if(!el)return;
 el.textContent=message;
 el.style.color=isError?'#9b2932':'#526976';
}
async function packingPreviewPDF(order){
 const current=++packingPreviewSerial;
 // A newly opened order must never reuse the previous order's PDF blob.
 if(packingPreviewObjectURL){URL.revokeObjectURL(packingPreviewObjectURL);packingPreviewObjectURL=null}
 packingCurrentOrderId=order.id;
 const target=document.getElementById('packingPDFPreview');
 const html=document.getElementById('packingHtmlFallback');
 if(target){target.innerHTML='';target.classList.add('hidden')}
 if(html)html.classList.remove('hidden');
 packingStatus('Preparing the PDF for order '+order.number+'...');
 try{
  const blob=await packingGenerateBlob(order);
  if(current!==packingPreviewSerial)return;
  if(packingPreviewObjectURL)URL.revokeObjectURL(packingPreviewObjectURL);
  packingPreviewObjectURL=URL.createObjectURL(blob);
  if(target){
   const frame=document.createElement('iframe');
   frame.src=packingPreviewObjectURL+'#toolbar=1&navpanes=0';
   frame.title='Packing list PDF - '+order.number;
   frame.setAttribute('loading','lazy');
   frame.style.cssText='display:block;width:100%;height:min(83vh,1000px);min-height:530px;border:0;background:#fff';
   target.replaceChildren(frame);
   target.classList.remove('hidden');
   if(html)html.classList.add('hidden');
  }
  packingStatus('Packing list PDF ready: '+order.number+'. Tap Open PDF / Print or Download PDF.');
 }catch(e){
  packingStatus('PDF preview unavailable: '+e.message+'. You can still view the packing list below, or retry Open PDF.',true);
 }
}
async function packingOpenPDF(download=false){
 if(packingPdfBusy)return;
 const order=(db.orders||[]).find(o=>o.id===selectedOrder);
 if(!order){packingStatus('Select an order first.',true);return}
 // Create a tab before the first await so Safari does not block this tap.
 const tab=download?null:window.open('','_blank');
 packingPdfBusy=true;
 packingStatus(download?'Downloading packing list PDF...':'Opening packing list PDF...');
 try{
  let url=packingPreviewObjectURL;
  if(!url||packingCurrentOrderId!==order.id){
   const blob=await packingGenerateBlob(order);
   if(packingPreviewObjectURL)URL.revokeObjectURL(packingPreviewObjectURL);
   url=packingPreviewObjectURL=URL.createObjectURL(blob);
   packingCurrentOrderId=order.id;
  }
  if(download||!tab){
   const a=document.createElement('a');
   a.href=url;
   a.download=(order.number||'CSG-Packing-List').replace(/[^A-Za-z0-9_-]/g,'_')+'-Packing-List.pdf';
   document.body.appendChild(a);a.click();a.remove();
   packingStatus('Packing list PDF downloaded for '+order.number+'.');
  }else{
   tab.location.href=url;
   packingStatus('Packing list PDF opened. Use Print or Share / Save from the PDF viewer.');
  }
 }catch(e){
  if(tab)try{tab.close()}catch{}
  packingStatus('Could not open packing list PDF: '+e.message,true);
 }finally{packingPdfBusy=false}
}
if(typeof window!=='undefined'){
 window.packingPreviewPDF=packingPreviewPDF;
 window.packingOpenPDF=packingOpenPDF;
}
if(typeof module!=='undefined'&&module.exports)module.exports={packingNormalizeOrder,packingBuildPDF,packingWrap,packingSafeText};
