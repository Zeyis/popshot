const assert=require('node:assert/strict');
const fs=require('node:fs');
const {packingEditInitial,packingEditPayload,packingEditComputed,packingEditAddPallet}=
 require('../../csg-inventory/packing-edit.js');
const {packingAddPalletWeight,packingShippingCalculation}=
 require('../../csg-inventory/packing-shipment.js');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
const editor=fs.readFileSync('csg-inventory/packing-edit.js','utf8');
const pdf=fs.readFileSync('csg-inventory/voltec-packing.js','utf8');
assert(html.includes('id="packingEditButton"'));
assert(html.includes('id="packingEditPanel"'));
assert(html.includes('onclick="packingEditOpen()"'));
assert(html.includes('src="packing-edit.js"'));
assert(editor.includes('Actual weight of each shipping box'));
assert(!editor.includes("packingEditNumberField('Weight / case (lb)'"));
assert(pdf.includes("put('FINAL SHIPPING WEIGHT: '"));
assert(!pdf.includes('Estimated from published full-case weights'));
const order={
 id:'a1',number:'CSG-2026-0011',status:'confirmed',recipient:'Customer',
 shipStreet:'100 Street',shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
 voltecSalesOrder:'V-SO-45',customerPo:'PO-A',
 shippingMethod:'pallets',palletCount:2,job:'Project',notes:'Deliver to site',
 lines:[
  {id:1,division:'voltec',part:'05-00366',code:'',ordered:6,shipped:6,qty:6,
   casesPulled:3,casePack:2,perCaseWeightLb:25,weightLb:75},
  {id:2,division:'voltec',part:'08-00513',code:'',ordered:8,shipped:8,qty:8,
   casesPulled:4,casePack:2,perCaseWeightLb:18,weightLb:72}
 ]};
// Regression: original 09-0T676 order, 4 cases at a manually entered 38 lb each.
const oldScreenshotOrder={
 id:'screenshot-4-boxes',number:'CSG-2026-0015',status:'confirmed',recipient:'Customer',
 shippingMethod:'cartons',shippingCartons:4,
 lines:[{id:19,division:'voltec',part:'09-0T676',qty:4,ordered:4,shipped:4,
  casesPulled:4,casePack:1,perCaseWeightLb:38,weightEstimated:false}]
};
const screenshotDraft=packingEditInitial(oldScreenshotOrder);
assert.deepEqual(screenshotDraft.boxWeightsLb,['38','38','38','38']);
assert.equal(packingEditComputed(screenshotDraft).totalWeightLb,152);
const screenshotPayload=packingEditPayload(screenshotDraft);
assert.deepEqual(screenshotPayload.boxWeightsLb,[38,38,38,38]);
assert.equal(screenshotPayload.shippingCartons,4);
const {voltecPackingHTML,voltecPackingNormalize,voltecPackingShippingTotals,voltecPackingSummary}=
 require('../../csg-inventory/voltec-packing.js');
const screenshotSaved={...oldScreenshotOrder,...screenshotPayload};
const screenshotTotals=voltecPackingShippingTotals(voltecPackingNormalize(screenshotSaved),
 voltecPackingSummary(voltecPackingNormalize(screenshotSaved).lines));
assert.equal(screenshotTotals.grandTotalLb,152);
assert(voltecPackingHTML(screenshotSaved).includes('Box 1: 38.00 lb'));
assert(voltecPackingHTML(screenshotSaved).includes('Box 4: 38.00 lb'));
assert(voltecPackingHTML(screenshotSaved).includes('Final shipping weight: 152.00 lb'));
const d=packingEditInitial(order);
assert.equal(d.number,order.number);
assert.equal(d.isVoltec,true);
assert.equal(d.customerPo,'PO-A');
let sum=packingEditComputed(d);
assert.equal(sum.ordered,14);
assert.equal(sum.shipped,14);
assert.equal(sum.cases,7);
assert.equal(sum.shippingCartons,7);
assert.equal(sum.pallets,2);
assert.equal(sum.palletWeightLb,70);
assert.equal(sum.totalWeightLb,217,'Previously manually entered case weights are preserved as 7 box weights');
assert.equal(d.convertedLegacyWeights,true);
assert.equal(d.boxWeightsLb.length,7);
d.shippingCartons='5';
d.boxWeightsLb=['25','25','18','18','18'];
sum=packingEditComputed(d);
assert.equal(sum.shippingCartons,5);
assert.equal(sum.cases,7);
assert.equal(sum.boxTotalWeightLb,104);
assert.equal(sum.totalWeightLb,174);
d.manualTotalWeightLb='200';
sum=packingEditComputed(d);
assert.equal(sum.totalWeightLb,200);
assert.equal(sum.palletWeightLb,70);
let p=packingEditPayload(d);
assert.equal(p.manualTotalWeightLb,200);
assert.deepEqual(p.boxWeightsLb,[25,25,18,18,18]);
assert.equal(p.palletCount,2);
assert.equal(p.shippingCartons,5);
assert.equal(p.lines.length,2);
d.manualTotalWeightLb='';
assert.equal(packingEditComputed(d).totalWeightLb,174,'Cleared override returns to actual entered box weights and pallet tare');
assert.equal(packingEditPayload(d).manualTotalWeightLb,null);
d.manualTotalWeightLb='xyz';
assert.throws(()=>packingEditPayload(d),/manual total/);
d.manualTotalWeightLb='';
d.lines[0].shipped='4';
d.lines[0].ordered='6';
assert.equal(packingEditPayload(d).lines[0].shipped,4);
assert.equal(packingEditComputed(d).backordered,2);
d.lines[0].shipped='7';
assert.throws(()=>packingEditPayload(d),/Check ordered and shipped/);
d.lines[0].shipped='6';
d.shippingMethod='cartons';
d.palletCount='10';
p=packingEditPayload(d);
assert.equal(p.palletCount,0);
assert.equal(p.shippingMethod,'cartons');
assert.equal(packingEditComputed(d).palletWeightLb,0);
d.shippingMethod='pallets';d.palletCount='';
assert.throws(()=>packingEditPayload(d),/pallets/);
assert.throws(()=>packingEditInitial({...order,status:'cancelled'}),/confirmed/);
const eiko=packingEditInitial({...order,lines:[
 {id:10,part:'EIKO-ITEM',division:'eiko',qty:8}
]});
assert.equal(eiko.isVoltec,false);
eiko.lines[0].ordered='6';
const eikoP=packingEditPayload(eiko);
assert.equal(eikoP.lines[0].shipped,6);
assert.equal(eikoP.shippingMethod,'cartons');
assert.equal(eikoP.shippingCartons,null);
assert.equal(eikoP.manualTotalWeightLb,null);
// Pallet shortcut still increments count, but never changes the manual final weight.
const mode={value:'cartons'},count={value:''};
const savedDoc=global.document;
global.document={getElementById:id=>({
 orderShippingMethod:mode,orderPalletCount:count,
 orderPalletFields:{classList:{toggle(){}}},cartTotal:{textContent:''}
})[id]||null};
packingAddPalletWeight();
packingAddPalletWeight();
assert.equal(count.value,'2');
assert.equal(mode.value,'pallets');
global.document=savedDoc;
assert(editor.includes('onclick="packingEditAddPallet()"'));
console.log('Packing-list editor: only manual final weight; no automatic fallback; cartons, pallets and stock edits preserved.');
