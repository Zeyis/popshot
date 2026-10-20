/* CSG receiving OCR and flexible packing list line extraction (client side). */
'use strict';
const receivingSkuPattern=/\b(?:\d{2}\s*[-–]\s*\d{5}|\d{5,6}|[A-Z]{2,}[A-Z0-9]*-[A-Z0-9-]{3,})\b/i;
async function receivingLoadScript(url,test){
 if(test())return;
 await new Promise((ok,fail)=>{
  const s=document.createElement('script');s.src=url;s.async=true;s.crossOrigin='anonymous';
  const timer=setTimeout(()=>fail(Error('Scanner library timed out. Enter item lines manually or try again.')),30000);
  s.onload=()=>{clearTimeout(timer);ok()};s.onerror=()=>{clearTimeout(timer);fail(Error('Scanner library could not load. Check your internet connection, or enter items manually.'))};
  document.head.appendChild(s);
 });
 if(!test())throw Error('Document reader did not initialize.');
}
async function receivingCreateWorker(){
 await receivingLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',()=>!!window.Tesseract?.createWorker);
 return window.Tesseract.createWorker('eng',1,{logger:m=>{
  if(m&&m.status==='recognizing text'&&typeof m.progress==='number')receiveMessage('Recognizing text… '+Math.round(m.progress*100)+'%');
 }});
}
async function receivingOCRCanvas(canvas,worker){
 const data=(await worker.recognize(canvas)).data||{};
 return Array.isArray(data.lines)&&data.lines.length?data.lines.map(x=>x.text).join('\n'):String(data.text||'');
}
async function receivingImageCanvas(file){
 const image=new Image(),url=URL.createObjectURL(file);
 try{
  await new Promise((ok,fail)=>{image.onload=ok;image.onerror=()=>fail(Error('Could not open the image. Try JPG or PNG.'));image.src=url});
  const scale=Math.min(1,2600/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas;
 }finally{URL.revokeObjectURL(url)}
}
async function receivingImageText(file){
 const canvas=await receivingImageCanvas(file),worker=await receivingCreateWorker();
 try{return await receivingOCRCanvas(canvas,worker)}
 finally{await worker.terminate();canvas.width=0;canvas.height=0}
}
function receivingPDFTypedLines(content){
 const words=(content.items||[]).filter(x=>typeof x.str==='string'&&x.str.trim()),rows=[];
 for(const w of words){
  const y=Math.round((w.transform?.[5]||0)*2)/2;
  let row=rows.find(x=>Math.abs(x.y-y)<3);
  if(!row){row={y,words:[]};rows.push(row)}
  row.words.push({x:w.transform?.[4]||0,text:w.str});
 }
 return rows.sort((a,b)=>b.y-a.y).map(x=>x.words.sort((a,b)=>a.x-b.x).map(w=>w.text).join(' ')).join('\n');
}
async function receivingPDFText(file){
 await receivingLoadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',()=>!!window.pdfjsLib);
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 let worker=null;const output=[];
 try{
  for(let pageNumber=1;pageNumber<=Math.min(3,pdf.numPages);pageNumber++){
   receiveMessage('Reading PDF page '+pageNumber+'…');
   const page=await pdf.getPage(pageNumber),typed=receivingPDFTypedLines(await page.getTextContent());
   if(typed.length>100&&receivingSkuPattern.test(typed)){output.push(typed);continue}
   if(!worker)worker=await receivingCreateWorker();
   const width=page.getViewport({scale:1}).width;
   const viewport=page.getViewport({scale:Math.min(2.3,1800/width)});
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   output.push(await receivingOCRCanvas(canvas,worker)||typed);canvas.width=0;canvas.height=0;
  }
 }finally{if(worker)await worker.terminate()}
 if(pdf.numPages>3)receiveMessage('Only the first three PDF pages were scanned. Process remaining pages separately.');
 return output.join('\n\n');
}
function parseReceivingText(raw){
 const text=String(raw||''),lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const isVoltec=/\b(?:FLEXWELT|FLEXWELL|VOLTEC|TASCO)\b/i.test(text);
 const isEiKO=/\bEIKO\b/i.test(text);
 const supplier=isVoltec?'Flexwelt / Voltec':isEiKO?'EiKO':'';
 const division=isEiKO&&!isVoltec?'eiko':'voltec';
 const headerRef=text.match(/\b(?:shipper\s*(?:number|no\.?|#)|packing\s*list\s*(?:number|no\.?|#)|delivery\s*(?:number|no\.?|#)|invoice\s*(?:number|no\.?|#))\s*[:#-]?\s*([A-Z0-9-]{4,})/i);
 const fallbackRef=text.match(/\bP\.?\s*O\.?\s*(?:number|no\.?|#)\s*[:#-]?\s*([A-Z0-9-]{3,})/i);
 const date=text.match(/\b(?:order\s*date|ship\s*date|date)\s*[:#-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
 const hasCaseHeading=/\bcases?\s+(?:this\s+)?ord\b|\bpack\b/i.test(text);
 const found=[];
 for(const line of lines){
  const m=receivingSkuPattern.exec(line);
  if(!m||m.index>15)continue;
  const part=m[0].replace(/\s+/g,'').replace('–','-').toUpperCase();
  const rest=line.slice(m.index+m[0].length).trim();
  const tokens=rest.split(/\s+/).filter(Boolean);
  const isNum=t=>/^\d+(?:\.\d+)?[,;]?$/.test(t);
  const numericIndex=tokens.findIndex(isNum);
  const description=(numericIndex<0?rest:tokens.slice(0,numericIndex).join(' ')).replace(/[|]+/g,' ').slice(0,180);
  const numbers=numericIndex<0?[]:tokens.slice(numericIndex).filter(isNum).map(n=>Number(n.replace(/[,;]$/,'')));
  let shipped='',pack=1,mode='units',warning='Verify against the supplier document.';
  if(numbers.length>=4){
   pack=Number.isSafeInteger(numbers[numbers.length-3])?numbers[numbers.length-3]:1;
   shipped=numbers[numbers.length-1];
   mode=hasCaseHeading?'cases':'units';
   warning='Confirm handwritten Shipped count and whether it means cases or units.';
  }else if(numbers.length===3){
   pack=Number.isSafeInteger(numbers[1])?numbers[1]:1;
   mode=hasCaseHeading?'cases':'units';
   warning='Shipped quantity missing/unclear — enter the quantity actually received.';
  }else if(numbers.length===2){
   shipped=numbers[1];
   warning='Confirm the number is shipped quantity, not ordered quantity.';
  }else if(numbers.length===1){
   shipped=numbers[0];
   warning='Confirm the single number is received quantity, not ordered quantity.';
  }
  if(!Number.isSafeInteger(shipped)||shipped<1)shipped='';
  if(!Number.isSafeInteger(pack)||pack<1)pack=1;
  if(!found.some(x=>x.part===part))found.push({division,part,description,code:'',shipped,pack,mode,warning});
 }
 let normalizedDate='';
 if(date?.[1]){const [m,d,y]=date[1].split('/');normalizedDate=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');}
 return {supplier,reference:headerRef?.[1]||fallbackRef?.[1]||'',date:normalizedDate,division,lines:found.slice(0,100)};
}
