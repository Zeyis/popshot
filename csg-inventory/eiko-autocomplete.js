/* EiKO catalog autocomplete for the shared Add / Edit Part screen.
   Reuses the authenticated supplier lookup already used by BJ Mode.
   Suggestions never save inventory or change quantities automatically. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const fields={part:{input:'editPart',panel:'eikoPartSuggestions'},code:{input:'editCode',panel:'eikoCodeSuggestions'}};
 const state={timer:null,serial:0,kind:null,items:[],active:-1};
 const inScope=()=>typeof editingDivision!=='undefined'&&editingDivision==='eiko'&&typeof activeTab!=='undefined'&&activeTab==='part';
 function panel(kind){return el(fields[kind].panel)}
 function input(kind){return el(fields[kind].input)}
 function status(message='',error=false){
  const box=el('eikoLookupInfo');if(!box)return;
  box.textContent=message;
  box.classList.toggle('hidden',!message||!inScope());
  box.classList.toggle('error',!!error);
 }
 function clearPanels(){
  for(const k of Object.keys(fields)){
   const list=panel(k),field=input(k);
   if(list){list.classList.add('hidden');list.replaceChildren()}
   if(field)field.setAttribute('aria-expanded','false');
  }
  state.items=[];state.active=-1;state.kind=null;
 }
 function cancel(){
  if(state.timer!==null)clearTimeout(state.timer);
  state.timer=null;
  state.serial++;
  clearPanels();
 }
 function reset(){
  cancel();
  const note=el('eikoLookupInfo');
  if(note){note.textContent='';note.classList.add('hidden')}
  const section=el('eikoCatalogLookupHint');if(section)section.classList.toggle('hidden',!inScope());
 }
 function message(kind,msg){
  const list=panel(kind),field=input(kind);
  if(!list||!field)return;
  list.replaceChildren();
  const row=document.createElement('div');
  row.className='eiko-result-status';row.textContent=msg;list.appendChild(row);
  list.classList.remove('hidden');field.setAttribute('aria-expanded','true');
 }
 function existingSKU(p){
  if(typeof inventoryOf!=='function')return null;
  const normalize=s=>String(s||'').trim().toUpperCase();
  return inventoryOf('eiko').find(x=>
   normalize(x.part)===normalize(p.part_number) ||
   (p.ordering_code&&normalize(x.code)===normalize(p.ordering_code))
  )||null;
 }
 function highlight(){
  const list=panel(state.kind);
  if(!list)return;
  const options=list.querySelectorAll('button.eiko-result');
  options.forEach((button,i)=>{
   const active=i===state.active;
   button.classList.toggle('highlighted',active);
   button.setAttribute('aria-selected',active?'true':'false');
  });
  const target=options[state.active];
  if(target&&typeof target.scrollIntoView==='function')target.scrollIntoView({block:'nearest'});
 }
 function choose(index){
  const selected=state.items[index];
  if(!selected||!inScope())return;
  const match=existingSKU(selected);
  const editing=Number(el('editId')?.value||0);
  cancel();
  if(match&&match.id!==editing){
   // Do not create a second inventory row for an already-stocked SKU.
   if(typeof openPart==='function')openPart(match.id);
   status('This EiKO part is already in your inventory. Opened its existing record. Quantity has not changed.',false);
   el('editQty')?.focus();
   return;
  }
  el('editPart').value=selected.part_number||'';
  el('editCode').value=selected.ordering_code||'';
  if(selected.description)el('editDesc').value=selected.description;
  status('EiKO part, ordering code and description filled in. Enter the physical quantity, then select Save.',false);
  el('editQty')?.focus();
 }
 function draw(kind,products,source){
  clearPanels();
  state.kind=kind;
  state.items=products.filter(p=>p&&p.part_number&&p.ordering_code).slice(0,12);
  const list=panel(kind),field=input(kind);
  if(!list||!field)return;
  if(!state.items.length){message(kind,'No catalog matches. You can still enter the part number manually.');return}
  const header=document.createElement('div');
  header.className='eiko-result-status';
  header.textContent=(source==='live_public_eiko_catalog'?'EiKO catalog':'Saved EiKO catalog')+' · Select a result to fill the form';
  list.appendChild(header);
  state.items.forEach((p,i)=>{
   const button=document.createElement('button');
   button.type='button';button.className='eiko-result';button.setAttribute('role','option');
   button.setAttribute('aria-selected','false');button.id='eiko-suggestion-'+kind+'-'+i;
   const part=document.createElement('strong');part.textContent=p.part_number;
   const code=document.createElement('span');code.className='eiko-code';code.textContent='EiKO code: '+p.ordering_code;
   const description=document.createElement('div');description.className='eiko-description';description.textContent=p.description||'';
   button.append(part,code,description);
   const existing=existingSKU(p);
   if(existing){
    const label=document.createElement('div');label.className='eiko-stock';
    label.textContent='Already in inventory · Select to edit existing item';
    button.appendChild(label);
   }
   button.addEventListener('click',()=>choose(i));
   list.appendChild(button);
  });
  list.classList.remove('hidden');
  field.setAttribute('aria-expanded','true');
 }
 async function searchNow(kind,query,ticket){
  if(!inScope()||state.serial!==ticket)return;
  try{
   if(typeof bjApi!=='function')throw Error('EiKO search is temporarily unavailable');
   const res=await bjApi('catalog',{q:query});
   if(state.serial!==ticket||!inScope()||input(kind)?.value.trim()!==query)return;
   const products=Array.isArray(res.products)?res.products:[];
   draw(kind,products,res.scope);
   if(res.warning&&!products.length)status(res.warning+' Manual entry is still available.',true);
  }catch(err){
   if(state.serial!==ticket||!inScope()||input(kind)?.value.trim()!==query)return;
   clearPanels();
   message(kind,'Catalog search unavailable. You can still enter this part manually.');
   status(err.message||'EiKO catalog search failed.',true);
  }
 }
 function changed(kind){
  if(!fields[kind])return;
  cancel();
  if(!inScope())return;
  const query=input(kind).value.trim();
  if(query.length<2){status('Type at least 2 characters to find EiKO products.');return}
  status('');
  message(kind,'Searching EiKO catalog…');
  const ticket=state.serial;
  state.timer=setTimeout(()=>{state.timer=null;searchNow(kind,query,ticket)},280);
 }
 function keydown(event,kind){
  const list=panel(kind);
  if(!inScope()||!list||list.classList.contains('hidden'))return;
  if(!state.items.length){if(event.key==='Escape'){event.preventDefault();cancel()}return}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();
   if(state.kind!==kind)return;
   const move=event.key==='ArrowDown'?1:-1;
   state.active=(state.active+move+state.items.length)%state.items.length;
   highlight();
  }else if(event.key==='Enter'&&state.kind===kind&&state.active>=0){
   event.preventDefault();choose(state.active);
  }else if(event.key==='Escape'){
   event.preventDefault();cancel();status('');
  }
 }
 document.addEventListener('pointerdown',event=>{
  const target=event.target;
  if(!target||!inScope())return;
  if(target.closest?.('.eiko-lookup'))return;
  cancel();
 });
 window.eikoSuggestInput=changed;
 window.eikoSuggestKey=keydown;
 window.eikoLookupReset=reset;
 window.eikoSuggestPick=choose;
 window.eikoSuggestSearchNow=searchNow;
})();
