const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {packingNormalizeOrder,packingBuildPDF,packingSafeText,packingWrap}=require('../../csg-inventory/packing-pdf.js');
(async()=>{
 const html=fs.readFileSync('csg-inventory/index.html','utf8');
 assert(html.includes('Create Order & Open Packing List'),'Create-order CTA promises packing list');
 assert(html.includes('openPacking(created.id)'),'Created order must navigate straight to packing list');
 assert(html.includes("window.packingPreviewPDF?.(o)"),'Open packing list automatically renders PDF');
 assert(html.includes('id="packingPDFPreview"'),'PDF preview must be mounted');
 assert(html.includes('onclick="packingOpenPDF(false)"'),'Open PDF / Print button must use real PDF');
 assert(html.includes('onclick="packingOpenPDF(true)"'),'Download PDF button must use real PDF');
 assert(!html.includes('onclick="window.print()">Print / Save PDF</button>'),'Old print-only control should be replaced');
 assert(html.includes('<script src="packing-pdf.js"></script>'));
 const src={
  id:'one',number:'CSG-2026-0047',created:'2026-11-11T15:00:00Z',person:'Cason',
  job:'Warehouse Job',recipient:'Acme Supply',shipAttention:'Shipping',
  shipStreet:'100 Example Street',shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
  notes:'Handle with care, deliver Monday',
  lines:[{part:'TWP1-PS80-FCCT-V',code:'13661',qty:3,desc:'Wallpack 80 W',division:'eiko'},
         {part:'04-00102',code:'04-00102',qty:2,desc:'Voltec sample',division:'voltec'}]
 };
 const before=JSON.stringify(src);
 const normalized=packingNormalizeOrder(src);
 assert.equal(normalized.totalUnits,5);
 assert.equal(normalized.lines.length,2);
 assert.equal(normalized.lines[0].division,'EiKO');
 assert.equal(normalized.lines[1].division,'Voltec');
 assert.equal(packingSafeText('A – B'),'A B');
 const wrapped=packingWrap('A very long description with multiple words repeated repeated repeated repeated',await PDFLib.PDFDocument.create().then(d=>d.embedFont(PDFLib.StandardFonts.Helvetica)),9,80,2);
 assert(wrapped.length<=2);
 const raw=fs.readFileSync('csg-inventory/csg-logo.base64','utf8').trim();
 const logo=Buffer.from(raw,'base64');
 const pdfData=await packingBuildPDF(src,{pdfLib:PDFLib,logoBytes:logo});
 const doc=await PDFLib.PDFDocument.load(pdfData);
 assert.equal(doc.getPageCount(),1);
 assert.equal(doc.getPages()[0].getWidth(),612);
 assert.equal(doc.getPages()[0].getHeight(),792);
 assert.equal(doc.getTitle(),'Cahaba Sales Group - Packing List - CSG-2026-0047');
 assert.equal(JSON.stringify(src),before,'PDF generation may not mutate saved order');
 const many={...src,lines:Array.from({length:75},(_,i)=>({
  part:'EIKO-'+i+'-REALLY-LONG-PART-NUMBER',qty:i+1,code:String(10000+i),
  division:'eiko',desc:'Descriptive item name for multi-page packing list verification'
 }))};
 const longer=await PDFLib.PDFDocument.load(await packingBuildPDF(many,{pdfLib:PDFLib,logoBytes:logo}));
 assert(longer.getPageCount()>=3,'Long orders must paginate instead of clipping items');
 assert(longer.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
 await assert.rejects(()=>packingBuildPDF({...src,lines:[]},{pdfLib:PDFLib}),/does not have any/);
 console.log('Packing PDF tests passed: auto navigation, real PDF, download buttons, logo, quantities, letter size, multi-page.');
})().catch(e=>{console.error(e);process.exitCode=1});
