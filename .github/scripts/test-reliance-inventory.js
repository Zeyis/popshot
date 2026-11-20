const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
const originalPdf=fs.readFileSync('csg-inventory/packing-pdf.js','utf8');
const {voltecPackingNormalize,voltecPackingSummary,voltecPackingShippingTotals,voltecPackingHTML,voltecPackingBuildPDF}=require('../../csg-inventory/voltec-packing.js');
const {packingShipmentGet,packingShipmentLine,packingShipmentWeightTotal}=require('../../csg-inventory/packing-shipment.js');
const {csgSupplierReportData,csgSupplierReportCSV,csgSupplierReportPDF}=require('../../csg-inventory/inventory-report.js');
const {packingEditInitial,packingEditPayload,packingEditComputed}=require('../../csg-inventory/packing-edit.js');
(async()=>{
 assert(html.includes('id="nav-reliance"'),"Dedicated Reliance Inventory tab");
 assert(html.includes('id="nav-order-reliance"'),"Dedicated Create Reliance Order tab");
 assert(html.includes("tab('reliance')"));
 assert(html.includes("tab('order-reliance')"));
 assert(html.includes("name==='order-reliance'?'reliance':null"));
 assert(html.includes("db.reliance||[]"),"Reliance routes to separate inventory array");
 assert(html.includes("activeTab==='order-reliance'"));
 assert(html.includes("division==='reliance'?"),"Reliance brand displayed");
 assert(html.includes("hasVoltec||hasReliance"),"Reliance uses Voltec-style shipping inputs");
 assert(html.includes("if(division!=='eiko')return packingShipmentMarkup(key,x,qty)"));
 assert(html.includes("if(division!=='eiko')return packingShipmentLine(key,item,ordered)"));
 assert(html.includes("relianceSalesOrder:hasReliance?"),"Supplier-specific Reliance sales order field");
 assert(html.includes("l.division==='voltec'||l.division==='reliance'"),"On-screen PDF preview includes Reliance");
 assert(originalPdf.includes("line.division==='voltec'||line.division==='reliance'"),
  "Downloaded PDF uses supplier shipping renderer");
 assert(html.includes('id="relianceSource"'),"User can see Odoo screenshot import disclaimer");
 const saved={
  id:'rel-order-1',number:'CSG-2026-0801',status:'confirmed',
  recipient:'Example Electrical Contractors',job:'Reliance generator installation',
  relianceSalesOrder:'REL-SO-101',customerPo:'BUYER-PO-22',
  shippingMethod:'pallets',palletCount:2,shippingCartons:5,manualTotalWeightLb:212,
  created:'2026-11-20T14:00:00Z',shipStreet:'100 Electric Ave',shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
  lines:[
   {id:1,division:'reliance',part:'REL-306CRK',code:'',desc:'',qty:3,ordered:5,shipped:3,backordered:2,
    casesPulled:3,casePack:1,perCaseWeightLb:25,weightLb:75},
   {id:12,division:'reliance',part:'REL-L1430P',code:'R-1430P',desc:'Custom order',qty:8,ordered:8,shipped:8,backordered:0,
    casesPulled:4,casePack:2,perCaseWeightLb:18,weightLb:72}
  ]
 };
 const n=voltecPackingNormalize(saved);
 assert.equal(n.supplier,'Reliance');
 assert.equal(n.salesOrder,'REL-SO-101');
 assert.equal(n.lines[0].division,'Reliance');
 assert.equal(n.lines[0].backordered,2);
 const summary=voltecPackingSummary(n.lines);
 const totals=voltecPackingShippingTotals(n,summary);
 assert.equal(summary.knownCases,7);
 assert.equal(totals.shippingCartons,5);
 assert.equal(totals.palletWeightLb,70);
 assert.equal(totals.calculatedTotalLb,217);
 assert.equal(totals.grandTotalLb,212,"Manual final freight weight must override auto calculation");
 assert(voltecPackingHTML(saved).includes('RELIANCE SALES ORDER #'));
 assert(voltecPackingHTML(saved).includes('REL-SO-101'));
 assert(voltecPackingHTML(saved).includes('Actual boxes: 5'));
 assert(voltecPackingHTML(saved).includes('Manual FINAL shipping weight: 212.00 lb'));
 const pdf=await PDFLib.PDFDocument.load(await voltecPackingBuildPDF(saved,{pdfLib:PDFLib}));
 assert.equal(pdf.getPageCount(),1);
 assert.equal(pdf.getPages()[0].getWidth(),612);
 assert.equal(pdf.getPages()[0].getHeight(),792);
 assert.equal(pdf.getTitle(),'Cahaba Sales Group - Reliance Packing Slip - CSG-2026-0801');
 const edit=packingEditInitial(saved);
 assert.equal(edit.supplierDivision,'reliance');
 assert.equal(edit.isVoltec,true,"Reliance has the advanced shipping editor");
 assert.equal(edit.voltecSalesOrder,'REL-SO-101');
 const edited=packingEditPayload(edit);
 assert.equal(edited.relianceSalesOrder,'REL-SO-101');
 assert.equal(edited.voltecSalesOrder,'');
 assert.equal(edited.shippingCartons,5);
 assert.equal(edited.manualTotalWeightLb,212);
 assert.equal(packingEditComputed(edit).totalWeightLb,212);
 const relianceData={
  reliance:[{id:1,part:'REL-306CRK',qty:25,code:'',min:0},{id:2,part:'REL-310CRK',qty:10,code:'',min:0}],
  items:[{id:1,part:'EIKO-ONLY',qty:999}],
  voltec:[{id:1,part:'VOLTEC-ONLY',qty:888}]
 };
 const report=csgSupplierReportData(relianceData,'reliance');
 assert.equal(report.supplier,'Reliance');
 assert.equal(report.totalParts,2);
 assert.equal(report.totalUnits,35);
 assert(!csgSupplierReportCSV(report).includes('EIKO-ONLY'));
 assert(!csgSupplierReportCSV(report).includes('VOLTEC-ONLY'));
 const reportPdf=await PDFLib.PDFDocument.load(await csgSupplierReportPDF(report,{pdfLib:PDFLib}));
 assert.equal(reportPdf.getPages()[0].getHeight(),792);
 assert.equal(reportPdf.getTitle(),'CSG - Reliance Inventory Report');
 const mock={manual:true,id:'manual-abc12345',part:'REL-SPECIAL-CUSTOM',code:'C-110',desc:'Custom',qty:4};
 packingShipmentGet('reliance:manual-abc12345',mock,4);
 const l=packingShipmentLine('reliance:manual-abc12345',mock,4);
 assert.equal(l.manual,true);assert.equal(l.part,'REL-SPECIAL-CUSTOM');
 assert.equal(l.code,'C-110');assert.equal(l.division,'reliance');
 console.log('Reliance inventory, ordering, SO/PO, PDF, editing, manual parts and isolated supplier reports passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
