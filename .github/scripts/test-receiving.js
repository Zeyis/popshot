const fs=require('fs');const vm=require('vm');const assert=require('assert/strict');
const context=vm.createContext({});vm.runInContext(fs.readFileSync('csg-inventory/receiving-ocr.js','utf8'),context);
const input=[
'FLEXWELT LLC DBA VOLTEC DBA TMC DBA TASCO',
'PACKING LIST',
'Shipper Number: 0249781',
'Qty Ord Pack Cases this Ord Shipped',
'08-00743 44W LED Work Light 100 4 25.00 25',
'08-00745 72W LED Work Light 40 2 20.00 20',
'08-00747 128W Twin head LED work light 60 2 30.00 30'
].join('\n');
const parsed=context.parseReceivingText(input);
assert.equal(parsed.reference,'0249781');
assert.equal(parsed.division,'voltec');
assert.equal(parsed.lines.length,3);
assert.deepEqual(Array.from(parsed.lines, r=>r.part),['08-00743','08-00745','08-00747']);
assert.deepEqual(Array.from(parsed.lines,r=>r.shipped),[25,20,30]);
assert.deepEqual(Array.from(parsed.lines,r=>r.pack),[4,2,2]);
assert.deepEqual(Array.from(parsed.lines,r=>r.mode),['cases','cases','cases']);
assert.equal(parsed.lines.reduce((sum,r)=>sum+r.shipped*r.pack,0),200);
const noShipped=context.parseReceivingText('Item Qty Ord Pack Cases this Ord Shipped\n08-00743 44W LED Work Light 100 4 25.00');
assert.equal(noShipped.lines[0].shipped,'','Cannot mistake ordered quantity for shipped quantity');
console.log('Packing-list parser checks passed: correct 200 units, blank shipped quantity stays blank.');
