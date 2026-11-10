const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
const {csgSupplierReportData,csgSupplierReportCSV,csgSupplierReportPDF,
 csgReportFileDate,csgReportSafeText}=require('../../csg-inventory/inventory-report.js');
(async()=>{
 const html=fs.readFileSync('csg-inventory/index.html','utf8');
 assert(html.includes('id="supplierPdfButton"'));
 assert(html.includes('id="supplierCsvButton"'));
 assert(html.includes('src="inventory-report.js"'));
 const original={
  items:[
   {part:'Z-100',code:'123',qty:8,min:10,desc:'PRIVATE NOTES; DO NOT SEND',location:'CONFIDENTIAL-BIN'},
   {part:'A-200',code:'456',qty:0,min:5,desc:'Internal staff note',staff:'Cason'}
  ],
  voltec:[{part:'VT-1',code:'X',qty:40,desc:'Internal Voltec note'}],
  orders:[{job:'PRIVATE CUSTOMER JOB'}]
 };
 const report=csgSupplierReportData(original,'eiko','2026-11-10T19:00:00Z','2026-11-10T20:00:00Z');
 assert.equal(report.totalParts,2);
 assert.equal(report.totalUnits,8);
 assert.equal(report.outOfStock,1);
 assert.deepEqual(report.entries.map(x=>x.part),['A-200','Z-100']);
 assert.deepEqual(Object.keys(report.entries[0]).sort(),['code','part','qty']);
 assert.equal(report.supplier,'EiKO');
 const csv=csgSupplierReportCSV(report);
 assert(csv.startsWith('\uFEFF'),'Spreadsheet export includes UTF-8 BOM');
 assert(csv.includes('"EiKO","A-200","456","0"'));
 assert(!csv.includes('PRIVATE NOTES')&&!csv.includes('Cason'));
 assert(!csv.includes('CONFIDENTIAL-BIN')&&!csv.includes('PRIVATE CUSTOMER'));
 const voltec=csgSupplierReportData(original,'voltec',null);
 assert.equal(voltec.totalParts,1);
 assert.equal(voltec.totalUnits,40);
 assert.equal(voltec.supplier,'Voltec');
 assert.equal(csgReportFileDate('2026-11-10T20:00:00Z'),'2026-11-10');
 assert.equal(csgReportSafeText('A–B'),'A B');
 const evil=csgSupplierReportCSV(csgSupplierReportData({items:[{part:'=1+1',qty:1,code:'@EXPLOIT'}]},'eiko'));
 assert(evil.includes("\"'=1+1\""),'Prevent CSV formula injection in SKU');
 assert(evil.includes("\"'@EXPLOIT\""),'Prevent CSV formula injection in ordering code');
 const logoEncoded=fs.readFileSync('csg-inventory/csg-logo.base64','utf8').trim();
 const logo=Buffer.from(logoEncoded,'base64');
 assert(logo.subarray(0,3).toString('hex')==='ffd8ff','Original company logo is a JPEG');
 const pdf=await csgSupplierReportPDF(report,{pdfLib:PDFLib,logoBytes:logo});
 const doc=await PDFLib.PDFDocument.load(pdf);
 assert(doc.getPageCount()===1,'Two inventory records fit on one letter page');
 assert(doc.getPages()[0].getWidth()===612);
 assert(doc.getPages()[0].getHeight()===792);
 assert(/EiKO Inventory Report/.test(doc.getTitle()));
 const long=csgSupplierReportData({items:Array.from({length:83},(_,i)=>({
   part:'FULL-LENGTH-ITEM-'+String(i).padStart(3,'0'),code:'ORDER-'+i,qty: i*3
 }))},'eiko','2026-11-10T20:00:00Z');
 const longPdf=await csgSupplierReportPDF(long,{pdfLib:PDFLib,logoBytes:logo});
 const longDoc=await PDFLib.PDFDocument.load(longPdf);
 assert(longDoc.getPageCount()>1);
 assert(longDoc.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
 console.log('Supplier inventory reports: PDF, CSV, accurate totals, privacy and multi-page checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
