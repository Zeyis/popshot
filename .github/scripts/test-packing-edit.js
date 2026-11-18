const assert=require('node:assert/strict');
const fs=require('node:fs');
const {
 packingEditInitial,packingEditComputed,packingEditPayload
}=require('../../csg-inventory/packing-edit.js');
const {packingAddPalletWeight,packingShippingCalculation}=require('../../csg-inventory/packing-shipment.js');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
const pdf=fs.readFileSync('csg-inventory/voltec-packing.js','utf8');
assert(html.includes('id="packingEditButton"'));
assert(html.includes('id="packingEditPanel"'));
assert(html.includes('onclick="packingEditOpen()"'));
assert(html.includes("onclick=\"packingEditOpen(\\'"),'History must offer editing');
assert(html.includes('src="packing-edit.js"'));
assert(html.includes('packingEditClose();selectedOrder=id;renderPacking(id);'), 'Switching orders closes stale editors');
assert(pdf.includes('shipping.palletWeightLb.toFixed(2)'),'Printed PDF must account for pallet tare');
const sample={
 id:'a1',number:'CSG-2026-0011',status:'confirmed',recipient:'Customer',
 shipStreet:'100 Street',shipCity:'Birmingham',shipState:'AL',shipZip:'35222',
 voltecSalesOrder:'V-SO-45',customerPo:'PO-A',shippingMethod:'pallets',palletCount:2,
 job:'Project',notes:'Deliver to site',lines:[
  {id:1,division:'voltec',part:'05-00366',code:'',ordered:6,shipped:6,qty:6,
   casesPulled:3,casePack:2,perCaseWeightLb:25,weightLb:75},
  {id:2,division:'voltec',part:'08-00513',code:'',ordered:8,shipped:8,qty:8,
   casesPulled:4,casePack:2,perCaseWeightLb:18,weightLb:72}
 ]};
const d=packingEditInitial(sample);
assert.equal(d.number,'CSG-2026-0011');
assert.equal(d.isVoltec,true);
assert.equal(d.customerPo,'PO-A');
assert.equal(d.palletCount,'2');
let summary=packingEditComputed(d);
assert.equal(summary.ordered,14);
assert.equal(summary.shipped,14);
assert.equal(summary.cases,7);
assert.equal(summary.goodsWeightLb,147);
assert.equal(summary.palletWeightLb,70);
assert.equal(summary.totalWeightLb,217);
let p=packingEditPayload(d);
assert.equal(p.lines[0].casesPulled,3);
assert.equal(p.lines[1].perCaseWeightLb,18);
assert.equal(p.shippingMethod,'pallets');
assert.equal(p.palletCount,2);
d.lines[0].shipped='4';d.lines[0].ordered='6';
assert.equal(packingEditPayload(d).lines[0].shipped,4);
assert.equal(packingEditComputed(d).backordered,2);
d.lines[0].shipped='7';
assert.throws(()=>packingEditPayload(d),/Check ordered and shipped/);
d.lines[0].shipped='6';d.lines[0].perCaseWeightLb='';
assert.equal(packingEditComputed(d).allKnown,false,'Do not show complete total when a case weight is missing');
d.shippingMethod='cartons';d.palletCount='10';
p=packingEditPayload(d);
assert.equal(p.palletCount,0);
assert.equal(p.shippingMethod,'cartons');
assert.equal(packingEditComputed(d).palletWeightLb,0);
d.shippingMethod='pallets';d.palletCount='';
assert.throws(()=>packingEditPayload(d),/pallets/);
assert.throws(()=>packingEditInitial({...sample,status:'cancelled'}),/confirmed/);
const eiko=packingEditInitial({...sample,lines:[
 {id:10,part:'EIKO-ITEM',division:'eiko',qty:8}
]});
assert.equal(eiko.isVoltec,false);
eiko.lines[0].ordered='6';
const eikoPayload=packingEditPayload(eiko);
assert.equal(eikoPayload.lines[0].shipped,6,'EiKO shipped equals edited ordered quantity');
assert.equal(eikoPayload.lines[0].casePack,null);
assert.equal(eikoPayload.shippingMethod,'cartons');
// The button increments pallet count and method, without changing shipment goods weight.
const method={value:'cartons'},count={value:''};
const realDoc=global.document;
global.document={getElementById(id){
 return {orderShippingMethod:method,orderPalletCount:count,
  orderPalletFields:{classList:{toggle() {}}}}[id]||null;
}};
packingAddPalletWeight();
assert.equal(method.value,'pallets');
assert.equal(count.value,'1');
packingAddPalletWeight();
assert.equal(count.value,'2');
assert.equal(packingShippingCalculation('pallets',2,147).grandWeightLb,217);
global.document=realDoc;
console.log('Saved packing-list editing passed: line quantities, stock-sensitive payloads, references, pallets, and 35 lb one-tap button.');
