const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {bjFillOriginalPDF}=require('../../csg-inventory/bj-pdf.js');
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
 console.log('Original Magic City PDF source hash confirmed; 1-row=792pt, 22-row=792pt, 23-row=2 full pages.');
})().catch(e=>{console.error(e);process.exitCode=1;});
