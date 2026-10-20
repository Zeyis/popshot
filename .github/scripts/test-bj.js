const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const index=fs.readFileSync('csg-inventory/index.html','utf8');
const source=fs.readFileSync('csg-inventory/bj.js','utf8');
assert(index.includes('How much did BJ weigh today?'));
assert(index.includes('class="bj-weight-display"'));
assert(index.includes('aria-readonly="true"'));
assert(index.includes('155</div>'));
assert(index.includes('Awh hell.'));
assert(index.includes('id="bjNavBadge"'));
assert(index.includes('id="bjPrintSection"'));
assert(index.includes('id="bjCatalogSearch"'));
assert(index.includes('id="bjItemRows"'));
assert(index.includes('bj.js'));
const context=vm.createContext({
 document:{addEventListener:()=>{},hidden:false},
 setInterval:()=>{},
 setTimeout:()=>{},
 dateText:s=>s,
 dateTime:s=>s,
 $:()=>({}),
});
vm.runInContext(source,context);
const csv='EiKO Ordering Code,SKU,Description\n13861,SEN5A-SPPR-WH,Ceiling Sensor\n12596,CD6-PS33-FCCT-UD,Downlight';
const parsed=vm.runInContext('bjParseCSV('+JSON.stringify(csv)+')',context);
assert.equal(parsed.length,2);
assert.equal(parsed[0].code,'13861');
assert.equal(parsed[1].part,'CD6-PS33-FCCT-UD');
const tsv='EiKO Ordering Code\tSKU\tDescription\n13861\tSEN5A-SPPR-WH\tSensor';
const parsedTSV=vm.runInContext('bjParseCSV('+JSON.stringify(tsv)+')',context);
assert.equal(parsedTSV[0].code,'13861');
assert(index.includes('id="bjBuyer" placeholder='));
assert(index.includes('src="bj-pdf.js"'));
assert(index.includes('bjExportOriginalPDF'));
assert(source.includes('bjPreviewOriginalPDF(o)'));
assert(!source.includes('bjPOBody('),'BJ must not print a separate HTML purchase order');
assert(!source.includes('record.buyer||\'Brent\''),'Buyer must not default to Brent');
console.log('BJ form tests passed: PDF preview, blank buyer, CSV/TSV import.');
