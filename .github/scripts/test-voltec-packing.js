const assert=require('node:assert/strict');
const fs=require('node:fs');
const PDFLib=require('pdf-lib');
globalThis.PDFLib=PDFLib;
const {packingShipmentDefault,packingShipmentGet,packingShipmentLine,
 packingShipmentSpec,packingShippingCartonCount,packingManualTotalWeight,
 packingAddPalletWeight,packingShippingCalculation}=require('../../csg-inventory/packing-shipment.js');
const {voltecPackingNormalize,voltecPackingSummary,voltecPackingShippingTotals,
 voltecPackingBuildPDF,voltecPackingHTML}=require('../../csg-inventory/voltec-packing.js');
(async()=>{
 const html=fs.readFileSync('csg-inventory/index.html','utf8');
 const shippingCode=fs.readFileSync('csg-inventory/packing-shipment.js','utf8');
 const pdfCode=fs.readFileSync('csg-inventory/voltec-packing.js','utf8');
 const editorCode=fs.readFileSync('csg-inventory/packing-edit.js','utf8');
 const packingCode=fs.readFileSync('csg-inventory/packing-pdf.js','utf8');
 assert(html.includes('id="orderManualTotalWeight"'));
 assert(html.includes('Override Final Shipping Weight (lb)'));
 assert(html.includes('id="orderShippingMethod"'));
 assert(html.includes('id="orderPalletCount"'));
 assert(html.includes('id="orderShippingCartons"'));
 assert(html.includes('id="addPalletWeightButton"'));
 assert(html.includes('onclick="packingAddPalletWeight()"'));
 assert(html.includes('voltecPackingHTML(o)'));
 assert(html.includes('src="voltec-packing.js"'));
 assert(!shippingCode.includes("'<label>Weight / case (lb) '"),'Per-case weight entry must be gone');
 assert(!editorCode.includes("packingEditNumberField('Weight / case (lb)'"),'Saved editor cannot show per-case weight');
 assert(!pdfCode.includes("put('ITEM WEIGHT:"),'PDF must not display inferred item weight');
 assert(!pdfCode.includes('Estimated from published full-case weights'),'PDF must not claim sourced weight estimates');
 assert(packingCode.includes("await voltecPackingBuildPDF(order"),'Advanced shipping PDF still used');
 assert(packingCode.includes("'PREPARED BY'"),'Legacy EiKO packing PDF must remain untouched');
 assert.equal(packingManualTotalWeight(''),null);
 assert.equal(packingManualTotalWeight('212.50'),212.5);
 assert.equal(packingManualTotalWeight('0'),0);
 assert.throws(()=>packingManualTotalWeight('-1'),/manual total/);
 assert.throws(()=>packingManualTotalWeight('abc'),/manual total/);
 assert.equal(packingShippingCartonCount([3,4],'5').cartons,5);
 assert.equal(packingShippingCartonCount([3,4],'').cartons,7);
 const spec=packingShipmentSpec({part:'04-00102'},'voltec');
 assert.equal(spec.casePack,6,'Automatic case packs remain independent of weight');
 const initial=packingShipmentDefault({part:'04-00102',qty:48},'voltec',12);
 assert.equal(initial.shipped,12);
 assert.equal(initial.casesPulled,2);
 assert.equal(initial.weightLb,'','NO automatic weight even for manufacturer-listed SKUs');
 assert.equal(initial.weightEstimated,false);
 const item={id:1,part:'04-00102',qty:48,code:'',desc:'Test Voltec'};
 packingShipmentGet('voltec:1',item,12);
 const newLine=packingShipmentLine('voltec:1',item,12);
 assert.equal(newLine.perCaseWeightLb,null);
 assert.equal(newLine.weightLb,null);
 assert.equal(newLine.weightEstimated,false);
 const methodField={value:'cartons'},countField={value:''};
 const oldDocument=global.document;
 global.document={getElementById:id=>({
  orderShippingMethod:methodField,orderPalletCount:countField,
  orderPalletFields:{classList:{toggle(){}}},cartTotal:{textContent:''}
 })[id]||null};
 packingAddPalletWeight();
 packingAddPalletWeight();
 assert.equal(methodField.value,'pallets');
 assert.equal(countField.value,'2');
 global.document=oldDocument;
 const original={
  number:'CSG-2026-0134',voltecSalesOrder:'SO-12345',customerPo:'PO-6789',
  created:'2026-11-23T14:00:00Z',recipient:'Example Electric',
  shipStreet:'100 Main Street',shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
  shippingMethod:'pallets',palletCount:2,shippingCartons:5,manualTotalWeightLb:null,
  job:'Warehouse Project',notes:'Handle carefully',lines:[
   {division:'voltec',part:'05-00366',code:'',desc:'Light fixture',ordered:6,shipped:6,qty:6,
    casesPulled:3,casePack:2,perCaseWeightLb:25,weightLb:75,weightEstimated:true},
   {division:'voltec',part:'08-00513',code:'',desc:'Light fixture',ordered:8,shipped:8,qty:8,
    casesPulled:4,casePack:2,perCaseWeightLb:18,weightLb:72,weightEstimated:true}
  ]};
 const normalized=voltecPackingNormalize(original);
 const summary=voltecPackingSummary(normalized.lines);
 assert.equal(summary.knownCases,7);
 const blank=voltecPackingShippingTotals(normalized,summary);
 assert.equal(blank.palletCount,2);
 assert.equal(blank.shippingCartons,5);
 assert.equal(blank.palletWeightLb,70,'35 lb pallet allowance is still a reference');
 assert.equal(blank.grandTotalLb,null,'NO weight fallback, even with legacy per-case weights');
 assert.equal(blank.calculatedTotalLb,null);
 const emptyHtml=voltecPackingHTML(original);
 assert(emptyHtml.includes('Final shipping weight: Not entered'));
 assert(!emptyHtml.includes('147.00'));
 assert(!emptyHtml.includes('217.00'));
 assert(!emptyHtml.includes('Known weight so far'));
 assert(!emptyHtml.includes('lb/case'));
 const manualOrder={...original,manualTotalWeightLb:200};
 const manual=voltecPackingShippingTotals(voltecPackingNormalize(manualOrder),summary);
 assert.equal(manual.grandTotalLb,200,'Manual final weight is authoritative');
 assert.equal(manual.palletWeightLb,70,'Pallets shown but not added to manual total');
 const manualHtml=voltecPackingHTML(manualOrder);
 assert(manualHtml.includes('Final shipping weight: 200.00 lb (override)'));
 assert(!manualHtml.includes('270.00'));
 assert(!manualHtml.includes('217.00'));
 assert(!manualHtml.includes('Estimated from'));
 assert.equal(voltecPackingShippingTotals(voltecPackingNormalize({...original,manualTotalWeightLb:0}),summary).grandTotalLb,0);
 const measuredOrder={...original,manualTotalWeightLb:null,boxWeightsLb:[20,21,22,23,24]};
 const measuredTotals=voltecPackingShippingTotals(voltecPackingNormalize(measuredOrder),summary);
 assert.equal(measuredTotals.boxTotalWeightLb,110);
 assert.equal(measuredTotals.calculatedTotalLb,180,'5 manually weighed boxes + 2 pallets × 35 lb');
 assert.equal(measuredTotals.grandTotalLb,180);
 const measuredHTML=voltecPackingHTML(measuredOrder);
 assert(measuredHTML.includes('Box 1: 20.00 lb'));
 assert(measuredHTML.includes('Box 5: 24.00 lb'));
 assert(measuredHTML.includes('Final shipping weight: 180.00 lb'));
 assert(measuredHTML.includes('Pallet tare: 2 × 35 lb = 70.00 lb'));
 const measuredPDF=await PDFLib.PDFDocument.load(await voltecPackingBuildPDF(measuredOrder,{pdfLib:PDFLib}));
 assert.equal(measuredPDF.getPages()[0].getWidth(),612);

 const bytes=await voltecPackingBuildPDF(manualOrder,{pdfLib:PDFLib});
 const pdf=await PDFLib.PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);
 assert.equal(pdf.getPages()[0].getWidth(),612);
 assert.equal(pdf.getPages()[0].getHeight(),792);
 assert.equal(pdf.getTitle(),'Cahaba Sales Group - Voltec Packing Slip - CSG-2026-0134');
 const legacy=voltecPackingNormalize({...original,lines:[{division:'voltec',part:'X',qty:6}]});
 assert.equal(legacy.lines[0].ordered,6);
 assert.equal(legacy.lines[0].shipped,6);
 const many={...original,lines:Array.from({length:61},(_,i)=>({...original.lines[0],part:'VOL-'+i,
  desc:'Detailed description of an electrical part, packaging and handling instructions '+i}))};
 const long=await PDFLib.PDFDocument.load(await voltecPackingBuildPDF(many,{pdfLib:PDFLib}));
 assert(long.getPageCount()>=3);
 assert(long.getPages().every(page=>page.getWidth()===612&&page.getHeight()===792));
 console.log('Voltec PDF/manual weight: no automatic estimates; blank remains blank; pallet tare never added; EiKO unchanged.');
})().catch(e=>{console.error(e);process.exitCode=1;});
