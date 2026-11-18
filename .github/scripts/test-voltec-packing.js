const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {packingShipmentDefault,packingShipmentSpec,packingShipmentLine,packingShipmentWeightTotal,
 packingShipmentGet,packingShipmentIsVoltecOrder,PACKING_PALLET_TARE_LB,packingShippingCalculation,packingAddPalletWeight,packingShippingCartonCount,packingManualTotalWeight}=require('../../csg-inventory/packing-shipment.js');
const {voltecPackingNormalize,voltecPackingSummary,voltecPackingBuildPDF,
 voltecPackingHTML,voltecPackingShippingTotals}=require('../../csg-inventory/voltec-packing.js');
(async()=>{
 const html=fs.readFileSync('csg-inventory/index.html','utf8');
 const packingCode=fs.readFileSync('csg-inventory/packing-pdf.js','utf8');
 const edgeUI=html;
 assert(edgeUI.includes('id="voltecOrderReferences" class="hidden"'));
 assert(edgeUI.includes('id="orderVoltecSales"'));
 assert(edgeUI.includes('id="orderCustomerPO"'));
 assert(edgeUI.includes('id="orderShippingMethod"'));
 assert(edgeUI.includes('id="orderPalletCount"'));
 assert(edgeUI.includes('id="orderShippingCartons"'));
 assert(edgeUI.includes('id="orderManualTotalWeight"'));
 assert.equal(packingManualTotalWeight('175'),175);
 assert.equal(packingManualTotalWeight(''),null);
 assert.equal(packingManualTotalWeight('0'),0);
 assert.throws(()=>packingManualTotalWeight('-1'),/manual total/);
 assert.throws(()=>packingManualTotalWeight('garbage'),/manual total/);
 assert.equal(packingShippingCartonCount([3,4],'').cartons,7);
 assert.equal(packingShippingCartonCount([3,4],'5').cartons,5);
 assert.equal(packingShippingCartonCount([3,4],'5').manual,true);
 assert.equal(packingShippingCartonCount([3,null],'').cartons,null);
 assert.throws(()=>packingShippingCartonCount([3,4],'5.2'),/whole number/);
 assert.throws(()=>packingShippingCartonCount([3,4],'-2'),/whole number/);
 assert(edgeUI.includes('id="addPalletWeightButton"'));
 assert(edgeUI.includes('onclick="packingAddPalletWeight()"'));
 const modeField={value:'cartons'},countField={value:''};
 const oldDocument=global.document;
 global.document={getElementById(id){return ({
  orderShippingMethod:modeField,orderPalletCount:countField,
  orderPalletFields:{classList:{toggle(){}}},
  cartTotal:{textContent:''}
 })[id]||null;}};
 packingAddPalletWeight();assert.equal(modeField.value,'pallets');assert.equal(countField.value,'1');
 packingAddPalletWeight();assert.equal(countField.value,'2');
 assert.equal(packingShippingCalculation(modeField.value,Number(countField.value),147).grandWeightLb,217);
 global.document=oldDocument;
 assert(edgeUI.includes('packingShippingDetails()'));
 assert.equal(PACKING_PALLET_TARE_LB,35);
 assert.equal(packingShippingCalculation('pallets',2,147).grandWeightLb,217);
 assert.equal(packingShippingCalculation('cartons',0,147).grandWeightLb,147);
 assert.equal(packingShippingCalculation('pallets',2,null).grandWeightLb,null);
 assert.throws(()=>packingShippingCalculation('pallets',1.5,147),/valid whole number/);
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
 assert.equal(packingShipmentWeightTotal({casesPulled:3,weightLb:25}),75);
 assert.equal(packingShipmentWeightTotal({casesPulled:4,weightLb:18}),72);
 assert.equal(packingShipmentWeightTotal({casesPulled:'',weightLb:25}),null);
 const d=packingShipmentDefault({part:'04-00102',qty:48},'voltec',12);
 assert.equal(d.shipped,12);
 assert.equal(d.casePack,6);
 assert.equal(d.casesPulled,2);
 assert.equal(d.weightLb,11,'Published 11 lb weight is per case, not combined total');
 assert.equal(d.weightEstimated,true,'Calculated gross case weights must be marked estimates');
 const partial=packingShipmentDefault({part:'04-00105',qty:3},'voltec',3);
 assert.equal(partial.casePack,6);
 assert.equal(partial.casesPulled,'','Partial cases are not full-package equivalents');
 assert.equal(partial.weightLb,9,'Verified pounds per case can be shown, but no shipment total without a case count');
 assert.equal(packingShipmentWeightTotal(partial),null,'No line total is inferred for incomplete cases');
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
 // Entering 25 lb per case for 3 cases, and 18 lb per case for 4 cases,
 // must produce 75 + 72 = 147 lb across two saved packing-slip lines.
 const twoCases=[
  {ordered:6,shipped:6,backordered:0,casesPulled:3,casePack:2,perCaseWeightLb:25,weightLb:75,weightEstimated:false},
  {ordered:8,shipped:8,backordered:0,casesPulled:4,casePack:2,perCaseWeightLb:18,weightLb:72,weightEstimated:false}
 ];
 const caseSum=voltecPackingSummary(twoCases);
 const palletOrder=voltecPackingNormalize({...raw,shippingMethod:'pallets',palletCount:2,lines:twoCases});
 const palletTotals=voltecPackingShippingTotals(palletOrder,voltecPackingSummary(palletOrder.lines));
 assert.equal(palletTotals.palletWeightLb,70);
 assert.equal(palletTotals.itemsWeightLb,147);
 assert.equal(palletTotals.grandTotalLb,217);
 const manualOrder=voltecPackingNormalize({...raw,shippingMethod:'pallets',palletCount:2,
  manualTotalWeightLb:200,lines:twoCases});
 const manualTotals=voltecPackingShippingTotals(manualOrder,voltecPackingSummary(manualOrder.lines));
 assert.equal(manualTotals.calculatedTotalLb,217);
 assert.equal(manualTotals.grandTotalLb,200,'Manual final weight must not add 70 lb pallet tare twice');
 assert.equal(manualTotals.manualTotalWeightLb,200);
 const manualHtml=voltecPackingHTML({...raw,shippingMethod:'pallets',palletCount:2,
  manualTotalWeightLb:200,lines:twoCases});
 assert(manualHtml.includes('Manual FINAL shipping weight: 200.00 lb (includes pallets)'));
 const clearManual=voltecPackingNormalize({...raw,shippingMethod:'pallets',palletCount:2,
  manualTotalWeightLb:null,lines:twoCases});
 assert.equal(voltecPackingShippingTotals(clearManual,voltecPackingSummary(clearManual.lines)).grandTotalLb,217);
 const repacked=voltecPackingNormalize({...raw,shippingMethod:'cartons',shippingCartons:5,lines:twoCases});
 const repackedSummary=voltecPackingSummary(repacked.lines);
 const repackedTotals=voltecPackingShippingTotals(repacked,repackedSummary);
 assert.equal(repackedSummary.knownCases,7);
 assert.equal(repackedTotals.shippingCartons,5);
 assert.equal(repackedTotals.grandTotalLb,147);
 assert.equal(repackedTotals.cartonsManuallySet,true);
 const repackedPreview=voltecPackingHTML({...raw,shippingMethod:'cartons',shippingCartons:5,lines:twoCases});
 assert(repackedPreview.includes('Actual boxes: 5'));
 assert.equal(voltecPackingShippingTotals({...palletOrder,shippingMethod:'cartons',palletCount:0},
  voltecPackingSummary(palletOrder.lines)).grandTotalLb,147);
 assert.equal(voltecPackingShippingTotals(voltecPackingNormalize({...raw,shippingMethod:'pallets',palletCount:2}),
  voltecPackingSummary(voltecPackingNormalize({...raw,shippingMethod:'pallets',palletCount:2}).lines)).grandTotalLb,null);
 const palletHtml=voltecPackingHTML({...raw,shippingMethod:'pallets',palletCount:2,lines:twoCases});
 assert(palletHtml.includes('2 pallet(s)'));
 assert(palletHtml.includes('Pallet weight: 70.00 lb'));
 assert(palletHtml.includes('Total shipping weight: 217.00 lb'));
 assert.equal(caseSum.knownCases,7);
 assert.equal(caseSum.knownLb,147);
 const fromForm=packingShipmentDefault({part:'08-00513',qty:60},'voltec',8);
 assert.equal(fromForm.weightLb,'','Unsourced per-case weight stays blank');
 const computed=voltecPackingNormalize({...raw,lines:twoCases.map((x,i)=>({...x,division:'voltec',part:'08-00'+i,qty:x.shipped,weightLb:999}))});
 assert.equal(computed.lines[0].weightLb,75,'Per-case weight overrides stale line total');
 assert.equal(computed.lines[1].weightLb,72);
 const visible=voltecPackingHTML({...raw,lines:twoCases.map((x,i)=>({...x,division:'voltec',part:'08-00'+i,qty:x.shipped}))});
 assert(visible.includes('147')||visible.includes('75.00'),'Print view includes calculated weights');
 const fallback=voltecPackingHTML(raw);
 assert(fallback.includes('VOLTEC SALES ORDER #'));
 assert(fallback.includes('CUSTOMER PO #'));
 assert(fallback.includes('SO-12345'));
 assert(fallback.includes('PO-6789'));
 assert(!fallback.includes('PREPARED BY'));
 assert(!fallback.includes('undefined'));
 const logo=Buffer.from(fs.readFileSync('csg-inventory/csg-logo.base64','utf8').trim(),'base64');
 const pdfData=await voltecPackingBuildPDF(raw,{pdfLib:PDFLib,logoBytes:logo});
 const palletPdf=await PDFLib.PDFDocument.load(await voltecPackingBuildPDF(
  {...raw,shippingMethod:'pallets',palletCount:2,lines:twoCases},
  {pdfLib:PDFLib,logoBytes:logo}));
 assert.equal(palletPdf.getPageCount(),1,'Pallet weight summary fits on one letter page');
 assert.equal(palletPdf.getPages()[0].getHeight(),792);
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
