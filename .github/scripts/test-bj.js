const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');
const index=fs.readFileSync('csg-inventory/index.html','utf8');
const source=fs.readFileSync('csg-inventory/bj.js','utf8');
assert(index.includes('H much did BJ weigh today?'));
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
const mock={
 po_number:'RNG-261020-ABCDE', order_date:'2026-10-20',ship_to_address:'113 45th Place North, Birmingham, AL 35222',
 vendor_address:'',ship_via:'',fob:'',terms:'',date_required:null,notes:'',buyer:'Brent',
 lines:[{qty:5,part:'SEN5A-SPPR-WH',code:'13861',location:'1-6-A2',description:'Ceiling Sensor',per:'EA',price:null}]
};
context.o=mock;
const paper=vm.runInContext('bjPOBody(o)',context);
assert(paper.includes('RNG-261020-ABCDE'));
assert(paper.includes('CAHABA SALES GROUP'));
assert(paper.includes('data:image/jpeg;base64,'));
assert(paper.includes('SEN5A-SPPR-WH'));
assert(paper.includes('1-6-A2'));
assert(paper.includes('13861'));
assert.equal((paper.match(/<tr><td class="bj-col-n">/g)||[]).length,22);
assert(paper.includes('BUYER: Brent'));
console.log('BJ Mode tests passed: form, catalog CSV+TSV, real logo and 22-row printable PO.');
