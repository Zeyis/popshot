/* Human-readable audit trail for CSG Warehouse.
 * Only changes display: the original csg_activity records remain untouched.
 */
(function(global){
'use strict';
const clean=x=>String(x==null?'':x).trim();
const count=x=>Number.isFinite(Number(x))?Number(x):0;
const display=n=>count(n).toLocaleString('en-US');
const unit=(n)=>display(n)+' '+(Math.abs(count(n))===1?'unit':'units');
const actionText=x=>clean(x).replace(/[_-]/g,' ').replace(/\s+/g,' ');
const division=d=>String(d||'eiko').toLowerCase()==='voltec'?'Voltec':'EiKO';
const safeArr=v=>Array.isArray(v)?v:[];
const findLines=d=>safeArr(d.parts||d.lines||d.returned||d.removed||d.reversedUnitsList);
const titlePart=d=>clean(d.part||d.code||d.order||d.reference)||'a part';
function describe(entry){
 const d=(entry.details&&typeof entry.details==='object'&&!Array.isArray(entry.details))?entry.details:{};
 const a=clean(entry.actor)||'Staff';
 const op=clean(entry.action).toLowerCase().replace(/[_-]/g,' ').replace(/\s+/g,' ');
 const amount=count(d.to)-count(d.from);
 const lines=findLines(d),lineSummary=lines.map(l=>{
  const part=clean(l.part||l.code||l.ordering_code)||'Part';
  const qty=l.qty??l.units??l.receivedUnits??null;
  return part+(qty!=null?' · '+unit(qty):'');
 });
 const result=(category,headline,body='',items=[])=>({category,headline,body,items,actor:a,raw:entry});
 if(op==='part'||op==='adjust'){
  const part=titlePart(d),brand=division(d.division);
  if(d.created===true||d.from===null) return result('inventory','Added '+part+' to '+brand+' inventory',
    'Starting quantity: '+unit(d.to??d.qty)+ (d.code?' · Ordering code '+d.code:''));
  if(d.from!=null&&d.to!=null){
   if(amount!==0) return result('inventory','Updated '+part,
    brand+' · '+unit(d.from)+' → '+unit(d.to)+' ('+(amount>0?'+':'')+display(amount)+')'+(d.code?' · Code '+d.code:''));
   return result('inventory','Saved '+part,brand+' · Quantity unchanged at '+unit(d.to)+(d.code?' · Code '+d.code:''));
  }
  if(d.edited) return result('inventory','Updated '+part,brand+(d.qty!=null?' · Quantity '+unit(d.qty):''));
  return result('inventory','Saved '+part+' in '+brand+(d.to!=null?' · Current quantity '+unit(d.to):''));
 }
 if(op==='eiko list cleanup'){
  const removed=safeArr(d.removed);
  return result('inventory','Cleaned up EiKO inventory',
   display(d.removed_count??removed.length)+' parts removed · '+display(d.kept_count)+' parts kept · Old records backed up',
   removed.map(x=>clean(x.part||x.code)+' · '+unit(x.qty)));
 }
 if(op==='order'){
  const recipient=clean(d.recipient||d.customer);
  const quantities=lines.reduce((sum,l)=>sum+count(l.qty),0);
  const units=d.units??(lines.length?quantities:null);
  return result('orders','Created warehouse order '+(d.order||''),
   [recipient?'For '+recipient:'',d.job?'Job: '+d.job:'',units!=null?unit(units)+' picked from inventory':''].filter(Boolean).join(' · '),lineSummary);
 }
 if(op==='cancel'||op==='order cancelled'){
  return result('orders','Canceled warehouse order '+(d.order||''),
    (lines.length?'Returned '+unit(lines.reduce((sum,l)=>sum+count(l.qty),0))+' to inventory':'Order canceled'),
    lineSummary);
 }
 if(op==='signed in')return result('accounts','Signed in','Account accessed the warehouse app');
 if(op==='signed out')return result('accounts','Signed out','Ended the warehouse session');
 if(op==='pin created'||op==='pin activated')return result('accounts','Created a staff PIN','First-time account setup completed');
 if(op==='incorrect pin attempt')return result('accounts','Incorrect PIN entered','Unsuccessful sign-in attempt');
 if(op==='issued setup code')return result('accounts','Issued a staff setup code',
    d.employee?'For '+d.employee:'Older staff setup workflow');
 if(op==='bj order awaiting po')return result('bj','Submitted BJ request '+(d.po||''),
    'Awaiting an EiKO PO'+(d.lineCount!=null?' · '+display(d.lineCount)+' '+(count(d.lineCount)===1?'line':'lines'):''));
 if(op==='bj order dismissed')return result('bj','Dismissed BJ alert '+(d.po||''),
    'Alert cleared · The saved request remains available to print');
 if(op==='bj order edited')return result('bj','Edited BJ request '+(d.po||''),
    d.lineCount!=null?'Updated '+display(d.lineCount)+' item '+(count(d.lineCount)===1?'line':'lines'):'Request details updated');
 if(op==='eiko catalog imported')return result('inventory','Updated EiKO catalog',
    display(d.rows??0)+' searchable product records imported · No inventory quantities changed');
 if(op==='packing list received'||op==='receive')return result('receiving',
    'Received packing list '+(d.reference||d.supplier||''),
    [d.supplier&&d.reference?'Supplier: '+d.supplier:'',d.units!=null?unit(d.units)+' added to inventory':'',d.lines!=null?display(d.lines)+' lines':''].filter(Boolean).join(' · '),
    safeArr(d.parts).map(x=>division(x.division||x.brand)+' · '+clean(x.part||'')+' · '+unit(x.qty??x.units)));
 if(op==='receipt reversed'||op==='reverse')return result('receiving','Reversed packing-list receipt '+(d.reference||''),
    (d.supplier?'Supplier: '+d.supplier+' · ':'')+(d.units??d.reversedUnits??0)+' units removed from inventory');
 const label=actionText(entry.action);
 return result('other',label?label.charAt(0).toUpperCase()+label.slice(1):'Warehouse update',
   Object.entries(d).filter(([k,v])=>/^(part|order|reference|recipient|customer|job|supplier|qty|from|to|units|code)$/i.test(k)&&typeof v!=='object')
     .map(([k,v])=>k.charAt(0).toUpperCase()+k.slice(1)+': '+clean(v)).join(' · '));
}
const categoryLabel={all:'All activity',inventory:'Inventory',orders:'Orders',bj:'BJ requests',receiving:'Receiving',accounts:'Sign-ins & PINs',other:'Other'};
function escapeHTML(x){return clean(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function dateTime(ts){
 const d=new Date(ts);
 return isNaN(d.getTime())?clean(ts):d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
function dayLabel(ts){
 const d=new Date(ts);
 return isNaN(d.getTime())?'Other activity':d.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
}
function render(records,query='',category='all'){
 const q=clean(query).toLowerCase();
 const entries=safeArr(records).map(describe).filter(e=>{
  if(category!=='all'&&e.category!==category)return false;
  if(!q)return true;
  const d=e.raw.details||{};
  return [e.actor,e.category,e.headline,e.body,...e.items,JSON.stringify(d)].join(' ').toLowerCase().includes(q);
 });
 if(!entries.length)return {html:'<div class="card activity-empty">No activity matches those filters.</div>',total:0};
 let previousDay=null,html='';
 for(const entry of entries){
  const day=dayLabel(entry.raw.at);
  if(day!==previousDay){previousDay=day;html+='<h2 class="activity-day">'+escapeHTML(day)+'</h2>';}
  html+='<article class="activity-entry">'
   +'<div class="activity-symbol activity-'+escapeHTML(entry.category)+'" aria-hidden="true">'+({
    inventory:'↕',orders:'□',bj:'BJ',receiving:'+',accounts:'●',other:'•'}[entry.category]||'•')+'</div>'
   +'<div class="activity-content">'
   +'<div class="activity-heading"><strong>'+escapeHTML(entry.headline)+'</strong><span class="activity-category">'+escapeHTML(categoryLabel[entry.category]||'Update')+'</span></div>'
   +'<div class="activity-byline">'+escapeHTML(entry.actor)+' · '+escapeHTML(dateTime(entry.raw.at))+'</div>'
   +(entry.body?'<p class="activity-summary">'+escapeHTML(entry.body)+'</p>':'');
  if(entry.items.length){
   const preview=entry.items.slice(0,40);
   html+='<details class="activity-detail"><summary>View '+entry.items.length+' '+(entry.items.length===1?'item':'items')+'</summary><ul>'
      +preview.map(x=>'<li>'+escapeHTML(x)+'</li>').join('')
      +(entry.items.length>40?'<li>Plus '+(entry.items.length-40)+' more items…</li>':'')
      +'</ul></details>';
  }
  html+='</div></article>';
 }
 return {html,total:entries.length};
}
function renderOnPage(){
 const records=typeof activities==='undefined'?[]:activities;
 const category=document.getElementById('activityCategory')?.value||'all';
 const query=document.getElementById('activityFilter')?.value||'';
 const data=render(records,query,category);
 const target=document.getElementById('activityRows');
 if(target)target.innerHTML=data.html;
 const countNode=document.getElementById('activityCount');
 if(countNode)countNode.textContent=data.total+' '+(data.total===1?'entry':'entries')+' shown · Original audit history preserved';
}
global.CSGActivity={describe,render,renderOnPage};
global.renderReadableActivity=renderOnPage;
})(typeof window!=='undefined'?window:globalThis);
