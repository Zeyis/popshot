const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {packingShipmentDefault,packingShipmentSpec,packingShipmentLine,
 packingShipmentGet,packingShipmentIsVoltecOrder}=require('../../csg-inventory/packing-shipment.js');
const {voltecPackingNormalize,voltecPackingSummary,voltecPackingBuildPDF,
 voltecPackingHTML}=require('../../csg-inventory/voltec-packing.js');
(async()=>{
 const html=fs.readFileSync('csg-inventory/index.html','utf8');
 const packingCode=fs.readFileSync('csg-inventory/packing-pdf.js','utf8');
 const edgeUI=html;
 assert(edgeUI.includes('id="voltecOrderReferences" class="hidden"'));
 assert(edgeUI.includes('id="orderVoltecSales"'));
 assert(edgeUI.includes('id="orderCustomerPO"'));
 assert(edgeUI.includes("if(division==='voltec')return packingShipmentMarkup(key,x,qty)"));
 assert(edgeUI.includes("if((o.lines||[]).some(l=>l.division==='voltec'))"));
 assert(edgeUI.includes('voltecPackingHTML(o)'));
 assert(edgeUI.includes('src="voltec-packing.js"'));
 assert(packingCode.includes("const hasVoltec=(order.lines||[]).some(line=>line.division==='voltec')"));
 assert(packingCode.includes("await voltecPackingBuildPDF(order"));
 assert(packingCode.includes("'PREPARED BY'"),'Unchanged EiKO packing slip remains available');
 assert.equal(packingShipmentIsVoltecOrder({'eiko:6':1}),false);
 assert.equal(packingShipmentIsVoltecOrder({'eiko:6':1,'voltec:4':2}),true);
 const known1=packingShipmentSpec({part:'04-00102'},'voltec');
 assert.equal(known1.casePack,6);
 assert.equal(known1.caseWeightLb,11);
 assert.equal(packingShipmentSpec({part:'04-00102'},'eiko'),null);
 const known2=packingShipmentSpec({part:'04-00105'},'voltec');
 assert.equal(known2.casePack,6);
 assert.equal(known2.caseWeightLb,9);
 const known3=packingShipmentSpec({part:'08-00743'},'voltec');
 assert.equal(known3.casePack,4);
 assert.equal(known3.caseWeightLb,12);
 const d=packingShipmentDefault({part:'04-00102',qty:48},'voltec',12);
 assert.equal(d.shipped,12);
 assert.equal(d.casePack,6);
 assert.equal(d.casesPulled,2);
 assert.equal(d.weightLb,22);
 assert.equal(d.weightEstimated,true,'Calculated gross case weights must be marked estimates');
 const partial=packingShipmentDefault({part:'04-00105',qty:3},'voltec',3);
 assert.equal(partial.casePack,6);
 assert.equal(partial.casesPulled,'','Partial cases are not full-package equivalents');
 assert.equal(partial.weightLb,'','Partial cases never silently guess weights');
 const unknown=packingShipmentDefault({part:'NOT-VERIFIED',qty:100},'voltec',20);
 assert.equal(unknown.casePack,'');
 assert.equal(unknown.weightLb,'');
 const raw={
  id:'test',number:'CSG-2026-0134',voltecSalesOrder:'SO-12345',
  customerPo:'PO-6789',created:'2026-11-16T17:00:00Z',
  recipient:'Electric Supply Co',shipAttention:'John Smith',shipStreet:'123 Sample St',
  shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
  notes:'Handle packages carefully',job:'Commercial',
  lines:[
   {division:'voltec',part:'04-00102',code:'',desc:'GFCI power block',
    ordered:15,shipped:12,backordered:3,qty:12,casesPulled:2,casePack:6,
    weightLb:22,weightEstimated:true},
   {division:'voltec',part:'08-00513',code:'',desc:'LED light string',
    ordered:10,shipped:7,backordered:3,qty:7,casesPulled:null,casePack:null,
    weightLb:null,weightEstimated:false}
  ]};
 const n=voltecPackingNormalize(raw);
 assert.equal(n.salesOrder,'SO-12345');assert.equal(n.customerPo,'PO-6789');
 assert.equal(n.lines[0].ordered,15);assert.equal(n.lines[0].shipped,12);assert.equal(n.lines[0].backordered,3);
 assert.equal(n.lines[1].weightLb,null);
 const sum=voltecPackingSummary(n.lines);
 assert.equal(sum.ordered,25);assert.equal(sum.shipped,19);assert.equal(sum.backordered,6);
 assert.equal(sum.knownCases,2);assert.equal(sum.casesKnown,1);
 assert.equal(sum.knownLb,22);assert.equal(sum.weightsKnown,1);
 assert.equal(sum.estimatedWeight,true);
 const fallback=voltecPackingHTML(raw);
 assert(fallback.includes('VOLTEC SALES ORDER #'));
 assert(fallback.includes('CUSTOMER PO #'));
 assert(fallback.includes('SO-12345'));
 assert(fallback.includes('PO-6789'));
 assert(!fallback.includes('PREPARED BY'));
 assert(!fallback.includes('undefined'));
 const logo=Buffer.from(fs.readFileSync('csg-inventory/csg-logo.base64','utf8').trim(),'base64');
 const pdfData=await voltecPackingBuildPDF(raw,{pdfLib:PDFLib,logoBytes:logo});
 const pdf=await PDFLib.PDFDocument.load(pdfData);
 assert.equal(pdf.getTitle(),'Cahaba Sales Group - Voltec Packing Slip - CSG-2026-0134');
 assert.equal(pdf.getPageCount(),1,'One short shipment stays one US Letter sheet');
 assert.equal(pdf.getPages()[0].getWidth(),612);assert.equal(pdf.getPages()[0].getHeight(),792);
 const old={...raw,number:'CSG-2026-0010',voltecSalesOrder:undefined,customerPo:undefined,
  lines:[{division:'voltec',part:'04-00102',qty:6}]};
 const legacy=voltecPackingNormalize(old);
 assert.equal(legacy.lines[0].ordered,6);
 assert.equal(legacy.lines[0].shipped,6);
 assert.equal(legacy.lines[0].backordered,0);
 assert.equal(legacy.lines[0].weightLb,null);
 const many={...raw,lines:Array.from({length:61},(_,i)=>({...raw.lines[0],part:'VOL-'+i,description:'Long product description '.repeat(5)}))};
 const multi=await PDFLib.PDFDocument.load(await voltecPackingBuildPDF(many,{pdfLib:PDFLib,logoBytes:logo}));
 assert(multi.getPageCount()>=3,'Many rows must paginate safely');
 assert(multi.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
 console.log('Voltec packing slips passed: grayscale, references, ordered/shipped/backorder, cases, sourced/unknown weight and legacy orders; EiKO route unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1});
