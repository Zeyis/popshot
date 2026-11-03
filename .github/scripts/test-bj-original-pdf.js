const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {bjFillOriginalPDF,bjFillBothCopiesPDF,bjLocationFieldsForCopy,bjCalculatePriceSummary,bjFormatUSD}=require('../../csg-inventory/bj-pdf.js');
(async()=>{
 const b64=fs.readFileSync('csg-inventory/magic-city-po-template.base64','utf8').trim();
 const base=Buffer.from(b64,'base64');
 assert(base.subarray(0,8).toString('binary').startsWith('%PDF-1.4'));
 const actualHash=crypto.createHash('sha256').update(base).digest('hex');
 assert.equal(actualHash,'861554a84959cd4b1958c7263da780623bfe3f02a5f2abb0f63789880b18ac23','Must use original uploaded PDF template bytes, not a substitute');
 const original=await PDFLib.PDFDocument.load(base);
 assert.equal(original.getPageCount(),1);
 const mock={po_number:'CSG-0001',order_date:'2026-10-20',buyer:'',vendor_address:'',
 ship_to_address:'',ship_via:'',terms:'',fob:'',date_required:null,
 lines:[{qty:5,part:'SEN5A-SPPR-WH',code:'13861',description:'Ceiling sensor',location:'1-6-A2',per:'EA',price:null}]};
 assert.equal(bjCalculatePriceSummary(mock.lines).pricedLines,0);
 const single=await bjFillOriginalPDF(mock,base);
 const one=await PDFLib.PDFDocument.load(single);
 assert.equal(one.getPageCount(),1,'One item must generate exactly ONE page');
 assert.equal(one.getPages()[0].getWidth(),612,'Use original letter-page width');
 assert.equal(one.getPages()[0].getHeight(),792,'Always print a full US Letter page even for one item');
 mock.lines=Array.from({length:22},(_,i)=>({...mock.lines[0],part:'PART-'+i,code:String(10000+i)}));
 const twentyTwo=await PDFLib.PDFDocument.load(await bjFillOriginalPDF(mock,base));
 assert.equal(twentyTwo.getPageCount(),1,'22 items fit on one original template page');
 assert.equal(twentyTwo.getPages()[0].getHeight(),792,'22 rows use the original full sheet height');
 mock.lines.push({...mock.lines[0],part:'PART-23'});
 const twentyThree=await PDFLib.PDFDocument.load(await bjFillOriginalPDF(mock,base));
 assert.equal(twentyThree.getPageCount(),2,'23 items create exactly two pages');
 assert.equal(twentyThree.getPages()[1].getHeight(),792,'Second page remains full letter-size for one extra item');
 const priced=[
  {qty:3,price:12.50,part:'PRICED-A',code:'111',location:'A1'},
  {qty:2,price:4.95,part:'PRICED-B',code:'222',location:'A2'}
 ];
 const total=bjCalculatePriceSummary(priced);
 assert.equal(total.totalCents,4740,'3 × 12.50 + 2 × 4.95 = 47.40');
 assert.equal(total.pricedLines,2);
 assert.equal(bjFormatUSD(total.totalCents),'$47.40');
 const mixed=bjCalculatePriceSummary([...priced,{qty:7,price:null}]);
 assert.equal(mixed.totalCents,4740);
 assert.equal(mixed.unpricedLines,1,'Missing price must never count as free');
 mock.lines=priced;
 const pricedPDF=await PDFLib.PDFDocument.load(await bjFillOriginalPDF(mock,base));
 assert.equal(pricedPDF.getPageCount(),1);
 assert.equal(pricedPDF.getPages()[0].getHeight(),792);
 mock.lines=Array.from({length:20},(_,i)=>({...priced[0],part:'P-'+i}));
 const manyPriced=await PDFLib.PDFDocument.load(await bjFillOriginalPDF(mock,base));
 assert.equal(manyPriced.getPageCount(),2,'Reserve room for a visible total on full pages');
 assert(manyPriced.getPages().every(p=>p.getHeight()===792));
 // Two copies of the SAME order: only internal warehouse copy prints bin locations.
 assert.deepEqual(bjLocationFieldsForCopy({location:'RACK-B7',source:'eiko'},'warehouse'),
  {location:'RACK-B7',sourceLabel:'EiKO WAREHOUSE'});
 assert.deepEqual(bjLocationFieldsForCopy({location:'RACK-B7',source:'eiko'},'clean'),
  {location:'',sourceLabel:''});
 assert.deepEqual(bjLocationFieldsForCopy({location:'A1',source:'ours'},'clean'),
  {location:'',sourceLabel:''});
 mock.lines=[{qty:2,part:'TWP1',code:'13661',description:'Wallpack',location:'RACK-B7',source:'eiko',price:17.25,per:'EA'}];
 const warehouseBytes=await bjFillOriginalPDF(mock,base,{copyType:'warehouse'});
 const cleanBytes=await bjFillOriginalPDF(mock,base,{copyType:'clean'});
 const warehouse=await PDFLib.PDFDocument.load(warehouseBytes);
 const clean=await PDFLib.PDFDocument.load(cleanBytes);
 assert.equal(warehouse.getPageCount(),1);
 assert.equal(clean.getPageCount(),1);
 assert.equal(warehouse.getPages()[0].getHeight(),792);
 assert.equal(clean.getPages()[0].getHeight(),792);
 assert.match(warehouse.getTitle(),/Warehouse Copy/);
 assert.match(clean.getTitle(),/Clean Copy/);
 assert.notDeepEqual(Buffer.from(warehouseBytes),Buffer.from(cleanBytes));
 const paired=await PDFLib.PDFDocument.load(await bjFillBothCopiesPDF(mock,base));
 assert.equal(paired.getPageCount(),2,'One-item BJ PO prints exactly two copies on separate letter-size pages');
 assert(paired.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
 assert.match(paired.getTitle(),/Warehouse and Clean Copies/);
 mock.lines=Array.from({length:23},(_,i)=>({...mock.lines[0],part:'TWP-'+i}));
 const many=await PDFLib.PDFDocument.load(await bjFillBothCopiesPDF(mock,base));
 assert.equal(many.getPageCount(),4,'Two-page BJ order has two internal and two clean PDF pages');
 console.log('BJ two-copy tests passed, clean copy hides locations, both copies use US letter pages.');
 console.log('BJ PDF money tests passed, $47.40 and partial total exclusion validated.');
 console.log('Original Magic City PDF source hash confirmed; 1-row=792pt, 22-row=792pt, 23-row=2 full pages.');
})().catch(e=>{console.error(e);process.exitCode=1;});
