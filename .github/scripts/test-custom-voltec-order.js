const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const PDFLib=require('pdf-lib');
const html=fs.readFileSync('csg-inventory/index.html','utf8');
const customCode=fs.readFileSync('csg-inventory/custom-order.js','utf8');
const shipmentCode=fs.readFileSync('csg-inventory/packing-shipment.js','utf8');
const editorCode=fs.readFileSync('csg-inventory/packing-edit.js','utf8');
const pdfCode=fs.readFileSync('csg-inventory/voltec-packing.js','utf8');
assert(html.includes('id="manualOrderOpenButton"'));
assert(html.includes('id="manualOrderPanel"'));
assert(html.includes("activeOrderDivision==='voltec'"),'Voltec must have its own selected order type');
assert(html.includes("targetOrderDivision==='eiko'"),'EiKO must hide custom entry UI');
assert(html.includes('No Voltec match for')||html.includes('No matching'),'No-match catalog fallback must be visible');
assert(html.includes('manualOrderGet(key)||inventoryOf(division)'),'Manual items must render without inventory lookup');
assert(html.includes('src="custom-order.js"'));
assert(shipmentCode.includes("manual:true,part:item.part,code:item.code"),'Manual code must be sent to server');
assert(shipmentCode.includes('(!item.manual&&shipped>Number(item.qty))'),'No inventory caps for manual lines');
assert(editorCode.includes('manual:l.manual===true'),'Saved line remains custom');
assert(editorCode.includes('Manual Ordering Code'),'Manual order code can be edited later');
assert(pdfCode.includes("put(line.code||'-'"),'PDF includes ordering code');
const fields={
 manualPart:{value:'',focus(){}},manualCode:{value:''},manualDescription:{value:''},manualQuantity:{value:'1'},
 orderSearch:{value:'LHS-PS320-8FCCT-HD1M-EB40H'},
 manualOrderPanel:{classList:{add(){},remove(){}}}
};
let renderCount=0,lastAlert='';
const ctx={
 activeOrderDivision:'voltec',cart:{},document:{getElementById:id=>fields[id]||null},
 packingShipmentGet(){},packingShipmentOrderedChanged(){},renderCart(){renderCount++},
 alertMsg(x){lastAlert=x},brandLabel:x=>x==='voltec'?'Voltec':'EiKO',
 crypto:require('node:crypto').webcrypto,Math,Date,Number,Object,String,Error,JSON
};
vm.createContext(ctx);
vm.runInContext(customCode,ctx);
vm.runInContext('manualOrderOpen()',ctx);
assert.equal(fields.manualPart.value,'LHS-PS320-8FCCT-HD1M-EB40H');
fields.manualCode.value='15969';
fields.manualDescription.value='Backlit Panel 320 W';
fields.manualQuantity.value='2';
vm.runInContext('manualOrderAdd()',ctx);
assert.equal(renderCount,1);
assert.match(lastAlert,/does not change inventory/);
const key=Object.keys(ctx.cart)[0];
assert.match(key,/^voltec:manual-[a-z0-9-]+$/);
const stored=vm.runInContext('manualOrderGet('+JSON.stringify(key)+')',ctx);
assert.equal(stored.part,'LHS-PS320-8FCCT-HD1M-EB40H');
assert.equal(stored.code,'15969');
assert.equal(stored.desc,'Backlit Panel 320 W');
assert.equal(ctx.cart[key],2);
assert.equal(stored.manual,true);
// Allow a searched SKU absent from stock; do not touch inventory.
ctx.activeOrderDivision='eiko';
fields.manualPart.value='EIKO-NOT-LISTED';
fields.manualCode.value='EG999';
vm.runInContext('manualOrderAdd()',ctx);
assert.equal(Object.keys(ctx.cart).length,1,'EiKO cannot create custom part lines');
const {packingShipmentGet,packingShipmentLine}=require('../../csg-inventory/packing-shipment.js');
packingShipmentGet(key,stored,2);
const line=packingShipmentLine(key,stored,2);
assert.equal(line.manual,true);
assert.equal(line.id,stored.id);
assert.equal(line.part,stored.part);
assert.equal(line.code,stored.code);
assert.equal(line.ordered,undefined);
assert.equal(line.qty,2);
assert.equal(line.shipped,2);
const {packingEditInitial,packingEditPayload}=require('../../csg-inventory/packing-edit.js');
const saved={
 id:'order1',number:'CSG-2026-0100',status:'confirmed',recipient:'Customer',
 shippingMethod:'cartons',lines:[{...line,ordered:2}]
};
const edit=packingEditInitial(saved);
assert.equal(edit.lines[0].manual,true);
edit.lines[0].code='15969-ALT';
edit.lines[0].part='LHS-PS320-8FCCT-HD1M-EB40H-R';
const payload=packingEditPayload(edit);
assert.equal(payload.lines[0].manual,true);
assert.equal(payload.lines[0].code,'15969-ALT');
assert.equal(payload.lines[0].part,'LHS-PS320-8FCCT-HD1M-EB40H-R');
const {voltecPackingNormalize,voltecPackingBuildPDF}=require('../../csg-inventory/voltec-packing.js');
const normalized=voltecPackingNormalize({...saved,lines:[line]});
assert.equal(normalized.lines[0].part,stored.part);
assert.equal(normalized.lines[0].code,'15969');
(async()=>{
 const bytes=await voltecPackingBuildPDF({...saved,lines:[line]},{pdfLib:PDFLib});
 const pdf=await PDFLib.PDFDocument.load(bytes);
 assert.equal(pdf.getPages()[0].getWidth(),612);
 assert.equal(pdf.getPages()[0].getHeight(),792);
 assert.equal(pdf.getPageCount(),1);
 console.log('Custom Voltec manual catalog fallback, photo SKU sample, ordered codes, edit and printable PDF passed; EiKO untouched.');
})().catch(e=>{console.error(e);process.exitCode=1});
