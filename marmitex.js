const M={catalog:[],dashboard:null,ticket:null,cart:{},publicWeek:'',weekId:'',editId:null,notice:'',busy:false};
function mxEsc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function mxEUR(c){return (Number(c||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});}

function mxLocalDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

function mxNextSunday(){
 const date=new Date(mxLocalDate()+'T12:00:00Z');
 let diff=(7-date.getUTCDay())%7;if(!diff)diff=7;
 date.setUTCDate(date.getUTCDate()+diff);return date.toISOString().slice(0,10);
}

function mxCutoffDefault(sunday){
 const d=new Date(sunday+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)+'T18:00';
}

function mxFormatDate(iso){
 if(!iso)return 'Domingo';return new Intl.DateTimeFormat('pt-PT',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso.slice(0,10)+'T12:00:00Z'));
}

function mxFormatCutoff(iso){
 if(!iso)return '';
 const x=new Date(iso);
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(x);
 const v={};for(const a of p)v[a.type]=a.value;
 return v.year+'-'+v.month+'-'+v.day+'T'+v.hour+':'+v.minute;
}

function mxMsg(){
 return M.notice?'<p class="mx-notice" role="alert">'+mxEsc(M.notice)+'</p>':'';
}

function mxWeek(){
 const all=M.dashboard?.weeks||[];
 const best=all.find(w=>w.id===M.weekId)||all.filter(w=>w.pickup_date>=mxLocalDate()).sort((a,b)=>a.pickup_date.localeCompare(b.pickup_date))[0]||all[0]||null;
 return best;
}

function mxPublic(){
 const weeks=M.catalog||[];
 const selected=weeks.find(w=>w.id===M.publicWeek)||weeks[0]||null;
 const items=selected?.items||[];
 const choose=weeks.length>1?'<label class="mx-field mx-week-picker">Domingo da retirada<select id="mx-public-week-select">'+weeks.map(w=>'<option value="'+mxEsc(w.id)+'" '+(selected.id===w.id?'selected':'')+'>'+mxEsc(mxFormatDate(w.pickup_date))+'</option>').join('')+'</select></label>':'';
 const chosen=items.filter(i=>(Number(M.cart[i.id])||0)>0);
 const count=chosen.reduce((t,i)=>t+Number(M.cart[i.id]),0);
 const cost=chosen.reduce((t,i)=>t+i.price_cents*Number(M.cart[i.id]),0);
 const dishes=items.map(i=>{
  const qty=Number(M.cart[i.id]||0);
  return '<article class="mx-dish"><span class="mx-dish-photo">🍱</span><div class="mx-dish-info"><h3>'+mxEsc(i.name)+'</h3><p>'+mxEsc(i.description||'Refeição preparada para domingo')+'</p><strong>'+mxEUR(i.price_cents)+'</strong>'+(i.available!==null?'<small>Disponíveis: '+Number(i.available)+'</small>':'')+'</div><div class="mx-qty"><button type="button" data-do="mx" data-act="less" data-id="'+mxEsc(i.id)+'" aria-label="Diminuir '+mxEsc(i.name)+'">−</button><b>'+qty+'</b><button type="button" data-do="mx" data-act="more" data-id="'+mxEsc(i.id)+'" aria-label="Adicionar '+mxEsc(i.name)+'" '+(i.available!==null&&qty>=i.available?'disabled':'')+'>+</button></div></article>';
 }).join('');
 return '<section class="mx-hero"><div class="mx-kicker">LAGOINHA CAFÉ POMBAL · ENCOMENDAS</div><h1>Marmitex para <em>domingo.</em></h1><p>Encomende durante a semana e retire na igreja, no domingo. Escolha o seu prato e a quantidade, sem criar conta.</p><span class="mx-back mx-standalone-note">🍱 Encomenda exclusiva para retirada no domingo</span></section>'+
 mxMsg()+
 (!selected?'<section class="mx-panel mx-centered"><span class="mx-large-emoji">🍽️</span><h2>Encomendas ainda fechadas</h2><p>O cardápio da próxima semana será publicado aqui quando estiver pronto. Volte em breve!</p></section>':
 '<section class="mx-panel"><div class="mx-section-title"><div><span class="mx-eyebrow">RETIRADA NA IGREJA</span><h2>'+mxEsc(mxFormatDate(selected.pickup_date))+'</h2><p>'+mxEsc(selected.pickup_note||'Retirada no domingo')+'</p><small>Encomendas até '+mxEsc(new Intl.DateTimeFormat('pt-PT',{timeZone:'Europe/Lisbon',dateStyle:'short',timeStyle:'short'}).format(new Date(selected.order_cutoff)))+'</small></div></div>'+choose+
 (items.length?'<div class="mx-dishes">'+dishes+'</div>':'<p>Os pratos desta semana esgotaram.</p>')+'</section>'+
 (count?'<section class="mx-panel mx-checkout"><h2>A sua encomenda</h2><p>'+count+' marmitex · <strong>'+mxEUR(cost)+'</strong></p><form id="mx-order-form"><label class="mx-field">Nome para a retirada<input name="customer_name" maxlength="60" minlength="2" autocomplete="given-name" placeholder="O seu nome" required></label><label class="mx-field">Telefone de contacto (opcional)<input name="customer_phone" type="tel" maxlength="24" autocomplete="tel" placeholder="Número de contacto"></label><button class="mx-primary" type="submit" '+(M.busy?'disabled':'')+'>Confirmar encomenda · '+mxEUR(cost)+'</button><p class="mx-footnote">O pagamento é feito no balcão, no domingo. Guarde o comprovativo digital.</p></form></section>':'<section class="mx-hint">Escolha a quantidade de cada prato para continuar. ☝</section>'));
}

function mxTicket(){
 const o=M.ticket;
 if(!o)return '<section class="mx-panel"><h2>Encomenda não encontrada</h2><p>Verifique o endereço do seu comprovativo.</p></section>';
 const labels={reserved:'Encomenda confirmada para domingo',preparing:'Encomenda confirmada',ready:'Disponível para retirada',delivered:'Retirada concluída',cancelled:'Encomenda cancelada'};
 return '<section class="mx-hero"><div class="mx-kicker">COMPROVATIVO DIGITAL</div><h1>Encomenda de <em>'+mxEsc(o.customer_name)+'</em></h1><p>Retirada '+mxEsc(mxFormatDate(o.pickup_date))+'</p></section>'+mxMsg()+
 '<section class="mx-panel mx-ticket"><strong class="mx-status mx-'+mxEsc(o.status)+'">'+mxEsc(labels[o.status]||o.status)+'</strong>'+
 (o.status==='delivered'?'<div class="mx-alert-ready">✓ Retirada concluída. Obrigado!</div>':'')+
 '<h2>Resumo do pedido</h2><div class="mx-ticket-list">'+(o.items||[]).map(i=>'<div><span>'+i.quantity+'× '+mxEsc(i.name)+'</span><b>'+mxEUR(i.quantity*i.unit_price_cents)+'</b></div>').join('')+'</div><div class="mx-total"><span>Total</span><strong>'+mxEUR(o.total_cents)+'</strong></div>'+
 '<p><strong>Pagamento:</strong> '+(o.payment_status==='paid'?'Confirmado':'No Caixa, durante a retirada')+'</p><p>'+mxEsc(o.pickup_note||'Retirada na igreja')+'</p><button data-do="mx" data-act="refresh" class="mx-primary">Atualizar estado ↻</button><p class="mx-footnote">Guarde este link. O estado é atualizado enquanto esta página estiver aberta ou quando voltar a ela.</p></section>';
}

function mxStaffNav(){
 return '<nav class="mx-staff-nav" aria-label="Marmitex"><a href="#/marmitex">Encomendar</a><a href="#/marmitex-caixa">Caixa</a>'+(M.dashboard?.role==='admin'?'<a class="mx-admin-link" href="#/marmitex-admin">Gestão do cardápio</a>':'')+'</nav>';
}
function mxStaffOrders(){
 const dash=M.dashboard||{weeks:[],items:[],orders:[]};
 const wk=mxWeek();
 const all=(dash.orders||[]).filter(o=>wk&&o.week_id===wk.id);
 const orders=all.filter(o=>o.status!=='cancelled');
 const pending=orders.filter(o=>o.payment_status==='pending'&&o.status!=='delivered');
 const paid=orders.filter(o=>o.payment_status==='paid'&&o.status!=='delivered');
 const delivered=orders.filter(o=>o.status==='delivered');
 const received=orders.filter(o=>o.payment_status==='paid').reduce((n,o)=>n+o.total_cents,0);
 const qty=new Map();
 for(const o of orders)for(const l of o.items||[])qty.set(l.name,(qty.get(l.name)||0)+Number(l.quantity));
 const weeks=dash.weeks||[];
 const picker='<label class="mx-field mx-week-picker">Domingo de retirada<select id="mx-week-select">'+weeks.map(w=>'<option value="'+mxEsc(w.id)+'" '+(wk&&w.id===wk.id?'selected':'')+'>'+mxEsc(mxFormatDate(w.pickup_date))+'</option>').join('')+'</select></label>';
 const list=orders.sort((a,b)=>{
   const state=x=>x.status==='delivered'?2:x.payment_status==='paid'?1:0;
   return state(a)-state(b)||a.customer_name.localeCompare(b.customer_name,'pt');
 }).map(o=>{
   const done=o.status==='delivered';
   const buttons=[];
   if(!done&&o.payment_status==='pending'){
     buttons.push(['paid_delivered','✓ Receber e entregar']);
     buttons.push(['paid','Só confirmar pagamento']);
     if(o.status==='reserved')buttons.push(['cancel','Cancelar']);
   }
   if(!done&&o.payment_status==='paid')buttons.push(['delivered','✓ Marcar como entregue']);
   const status=done?'ENTREGUE':o.payment_status==='paid'?'PAGO · POR RETIRAR':'AGUARDA PAGAMENTO';
   return '<article class="mx-order-card '+(done?'mx-delivered':'')+'"><div class="mx-order-top"><strong>'+mxEsc(o.customer_name)+'</strong><span>'+status+'</span></div>'+
     '<p class="mx-order-ref">#'+mxEsc(String(o.id).slice(-6).toUpperCase())+(o.customer_phone?' · '+mxEsc(o.customer_phone):'')+'</p>'+
     '<div class="mx-order-lines">'+(o.items||[]).map(l=>'<div><b>'+l.quantity+'×</b><span>'+mxEsc(l.name)+'</span></div>').join('')+'</div>'+
     '<div class="mx-order-bottom"><strong>'+mxEUR(o.total_cents)+'</strong><div>'+buttons.map(([act,label])=>'<button type="button" data-do="mx" data-act="'+act+'" data-id="'+mxEsc(o.id)+'" '+(M.busy?'disabled':'')+'>'+label+'</button>').join('')+'</div></div></article>';
 }).join('');
 return '<section class="mx-hero"><div class="mx-kicker">MARMITEX · ATENDIMENTO</div><h1>Caixa e <em>retirada.</em></h1><p>Localize o nome, receba o pagamento e entregue a marmitex. Não existe etapa de cozinha neste sistema.</p></section>'+mxStaffNav()+mxMsg()+
 (wk?'<section class="mx-panel">'+picker+'<div class="mx-stats"><div><small>Encomendas</small><b>'+orders.length+'</b></div><div><small>Por pagar</small><b>'+pending.length+'</b></div><div><small>Entregues</small><b>'+delivered.length+'</b></div><div><small>Recebido</small><b>'+mxEUR(received)+'</b></div></div>'+
 '<h2>Quantidades encomendadas</h2><div class="mx-production">'+([...qty.entries()].map(([name,num])=>'<div><span>'+mxEsc(name)+'</span><b>'+num+' un.</b></div>').join('')||'<p>Sem encomendas para este domingo.</p>')+'</div>'+
 '<h2>Encomendas e retiradas</h2><div class="mx-order-grid">'+(list||'<p class="mx-empty">Nenhuma encomenda registada.</p>')+'</div></section>':
 '<section class="mx-panel mx-centered"><h2>Aguardando cardápio semanal</h2><p>O Administrador pode configurar as semanas no painel de gestão.</p></section>');
}
function mxAdmin(){
 const dash=M.dashboard||{weeks:[],items:[],orders:[]};
 const wk=mxWeek(),date=wk?.pickup_date||mxNextSunday();
 const deadline=wk?mxFormatCutoff(wk.order_cutoff):mxCutoffDefault(date);
 const items=(dash.items||[]).filter(i=>wk&&i.week_id===wk.id);
 const orders=(dash.orders||[]).filter(o=>wk&&o.week_id===wk.id&&o.status!=='cancelled');
 const editing=items.find(i=>i.id===M.editId)||null;
 const total=orders.reduce((s,o)=>s+o.total_cents,0);
 const paid=orders.filter(o=>o.payment_status==='paid').reduce((s,o)=>s+o.total_cents,0);
 const dates=(dash.weeks||[]).map(w=>'<option value="'+mxEsc(w.id)+'" '+(wk&&w.id===wk.id?'selected':'')+'>'+mxEsc(mxFormatDate(w.pickup_date))+'</option>').join('');
 return '<section class="mx-hero"><div class="mx-kicker">ADMINISTRADOR · ENCOMENDAS SEMANAIS</div><h1>Gestão de <em>Marmitex.</em></h1><p>Defina o domingo, o prazo para encomendar e os pratos. Só abra quando os preços e as quantidades estiverem corretos.</p></section>'+mxStaffNav()+mxMsg()+
 '<div class="mx-qr-admin"><a href="./marmitex-qr.html" target="_blank" rel="noopener">◼ Ver e imprimir QR Code exclusivo das marmitex ↗</a></div>'+ 
 '<section class="mx-admin-grid"><div class="mx-panel"><h2>1 · Configurar domingo</h2><p class="mx-footnote">Confira o prazo de encerramento configurado para esta semana. Abra as encomendas somente quando o cardápio estiver pronto.</p>'+
 '<form id="mx-week-form"><label class="mx-field">Domingo de retirada<input name="pickup_date" type="date" required value="'+mxEsc(date)+'"></label>'+
 '<label class="mx-field">Prazo final para encomendar<input name="cutoff_local" type="datetime-local" required value="'+mxEsc(deadline)+'"></label>'+
 '<label class="mx-field">Informações de retirada<input name="pickup_note" maxlength="180" value="'+mxEsc(wk?.pickup_note||'Retirada no domingo na igreja')+'"></label>'+
 '<label class="mx-check"><input type="checkbox" name="orders_open" '+(wk?.orders_open?'checked':'')+'> Abrir encomendas desta semana</label>'+
 '<button type="submit" class="mx-primary" '+(M.busy?'disabled':'')+'>Guardar configuração</button></form>'+
 (dates?'<label class="mx-field">Semanas já cadastradas<select id="mx-week-select">'+dates+'</select></label>':'')+
 '<p class="mx-footnote">Alterar o domingo no formulário cria uma semana diferente. O café permanece independente.</p></div>'+
 '<div class="mx-panel"><h2>2 · Cardápio da semana</h2>'+
 (!wk?'<p>Guarde primeiro a data de domingo para cadastrar pratos.</p>':
 '<form id="mx-item-form"><label class="mx-field">Nome do prato<input name="name" maxlength="100" required placeholder="Ex.: Marmitex de frango" value="'+mxEsc(editing?.name||'')+'"></label>'+
 '<label class="mx-field">Descrição<input name="description" maxlength="500" placeholder="Acompanhamentos incluídos" value="'+mxEsc(editing?.description||'')+'"></label>'+
 '<div class="mx-form-pair"><label class="mx-field">Preço (€)<input name="price" type="number" min="0.01" max="10000" step="0.01" required value="'+(editing?(editing.price_cents/100).toFixed(2):'')+'"></label>'+
 '<label class="mx-field">Limite de unidades (vazio = ilimitado)<input name="capacity" type="number" min="1" step="1" value="'+mxEsc(editing?.capacity??'')+'"></label></div>'+
 '<label class="mx-check"><input name="active" type="checkbox" '+(!editing||editing.active?'checked':'')+'> Prato ativo</label>'+
 '<button type="submit" class="mx-primary" '+(M.busy?'disabled':'')+'>'+(editing?'Guardar alterações':'Adicionar prato')+'</button>'+
 (editing?'<button type="button" class="mx-quiet" data-do="mx" data-act="new-item">Cancelar edição</button>':'')+'</form>')+
 '<div class="mx-admin-items">'+items.map(i=>'<article><div><strong>'+mxEsc(i.name)+'</strong><small>'+mxEUR(i.price_cents)+' · '+(i.capacity===null?'Sem limite':i.reserved_qty+'/'+i.capacity+' reservadas')+' · '+(i.active?'Ativo':'Inativo')+'</small></div><button type="button" data-do="mx" data-act="edit-item" data-id="'+mxEsc(i.id)+'">Editar</button></article>').join('')+'</div></div></section>'+
 (wk?'<section class="mx-panel"><h2>Resumo · '+mxEsc(mxFormatDate(wk.pickup_date))+'</h2>'+
 '<div class="mx-stats"><div><small>Encomendas</small><b>'+orders.length+'</b></div><div><small>Unidades</small><b>'+orders.reduce((n,o)=>n+(o.items||[]).reduce((k,l)=>k+Number(l.quantity),0),0)+'</b></div><div><small>Previsto</small><b>'+mxEUR(total)+'</b></div><div><small>Recebido</small><b>'+mxEUR(paid)+'</b></div></div>'+
 '<p class="mx-footnote">Para consultar os nomes, os pagamentos e as retiradas, abra o Caixa. Não há painel de cozinha.</p></section>':'');
}

function mxRender(view,role){
 if(view==='marmitex')return mxPublic();
 if(view==='marmitex-pedido')return mxTicket();
 if(view==='marmitex-admin')return mxAdmin();
 if(view==='marmitex-caixa')return mxStaffOrders();
 return '';
}

async function mxRPC(api,name,payload){
 const r=await api.rpc(name,payload||{});if(r.error)throw Error(r.error.message||name);return r.data;
}

async function mxLoad(api,view){
 if(view==='marmitex'){
  M.catalog=await mxRPC(api,'mx_catalog');
  if(!M.catalog.some(w=>w.id===M.publicWeek))M.publicWeek=M.catalog[0]?.id||'';
 }else if(view==='marmitex-pedido'){
  const token=location.hash.split('/')[2]||'';
  M.ticket=/^[\da-f-]{36}$/i.test(token)?await mxRPC(api,'mx_ticket',{p_token:token}):null;
 }else if(['marmitex-admin','marmitex-caixa'].includes(view)){
  M.dashboard=await mxRPC(api,'mx_staff_dashboard');
  if(M.weekId&&!M.dashboard.weeks.some(w=>w.id===M.weekId))M.weekId='';
 }
}

function mxChange(t){
 if(t.id==='mx-week-select'){M.weekId=t.value;M.editId=null;return true;}
 if(t.id==='mx-public-week-select'){M.publicWeek=t.value;M.cart={};return true;}
 return false;
}

async function mxAction(api,b,view,role){
 const act=b.dataset.act,id=b.dataset.id;
 if(act==='more'||act==='less'){
  const item=M.catalog.flatMap(w=>w.items||[]).find(i=>i.id===id);
  if(!item)return;
  const current=Number(M.cart[id]||0);
  const qty=Math.max(0,Math.min(20,current+(act==='more'?1:-1)));
  const total=Object.values(M.cart).reduce((n,v)=>n+Number(v),0)-current+qty;
  if(total>20)throw Error('Limite de 20 marmitex por encomenda.');
  if(item.available!==null&&qty>item.available)throw Error('Limite de unidades deste prato atingido.');
  M.cart[id]=qty;M.notice='';return;
 }
 if(act==='edit-item'){M.editId=id;M.notice='';return;}
 if(act==='new-item'){M.editId=null;M.notice='';return;}
 if(act==='refresh'){await mxLoad(api,view);return;}
 if(['paid','paid_delivered','delivered','cancel'].includes(act)){
  if(act==='paid'&&!confirm('Confirmar que recebeu o pagamento desta encomenda?'))return;
  if(act==='paid_delivered'&&!confirm('Confirmar pagamento recebido e marmitex entregue ao cliente?'))return;
  if(act==='delivered'&&!confirm('Confirmar que entregou a marmitex ao cliente?'))return;
  if(act==='cancel'&&!confirm('Cancelar esta encomenda não paga e devolver as quantidades ao cardápio?'))return;
  M.busy=true;
  try{
   await mxRPC(api,'mx_staff_action',{p_order_id:id,p_action:act});
   M.notice='Estado da encomenda atualizado.';
   await mxLoad(api,view);
  }finally{M.busy=false;}
 }
}

async function mxSubmit(api,f,view,role){
 if(M.busy)return;
 const d=new FormData(f),kind=f.id;
 M.busy=true;
 try{
  if(kind==='mx-order-form'){
   const week=M.catalog.find(w=>w.id===M.publicWeek)||M.catalog[0];
   if(!week)throw Error('Nenhum domingo disponível');
   const lines=(week.items||[]).filter(i=>Number(M.cart[i.id])>0).map(i=>({item_id:i.id,quantity:Number(M.cart[i.id])}));
   if(!lines.length)throw Error('Selecione uma marmitex');
   const result=await mxRPC(api,'mx_create_order',{p_week_id:week.id,p_customer_name:d.get('customer_name'),p_customer_phone:d.get('customer_phone'),p_lines:lines});
   M.cart={};M.notice='';
   location.hash='#/marmitex-pedido/'+result.token;
   await mxLoad(api,'marmitex-pedido');
  }else if(kind==='mx-week-form'){
   if(role!=='admin')throw Error('Apenas Administrador');
   const sunday=String(d.get('pickup_date')||'');
   const open=d.has('orders_open');
   if(open&&!confirm('Abrir encomendas reais para '+mxFormatDate(sunday)+'?'))return;
   const id=await mxRPC(api,'mx_admin_week',{p_pickup_date:sunday,p_cutoff_local:String(d.get('cutoff_local')||''),p_note:String(d.get('pickup_note')||''),p_open:open});
   M.weekId=id;M.editId=null;M.notice=open?'Semana guardada e encomendas abertas.':'Semana guardada. Encomendas públicas continuam fechadas.';
   await mxLoad(api,'marmitex-admin');
  }else if(kind==='mx-item-form'){
   if(role!=='admin')throw Error('Apenas Administrador');
   const wk=mxWeek();if(!wk)throw Error('Configure primeiro a semana');
   const raw=String(d.get('capacity')||'').trim();
   const price=Math.round(Number(d.get('price'))*100);
   const cap=raw===''?null:Number(raw);
   if(!Number.isInteger(price)||price<1||price>1000000)throw Error('Preço inválido');
   if(cap!==null&&(!Number.isInteger(cap)||cap<1))throw Error('Quantidade inválida');
   await mxRPC(api,'mx_admin_item',{p_week_id:wk.id,p_id:M.editId||null,p_name:String(d.get('name')||''),p_description:String(d.get('description')||''),p_price_cents:price,p_capacity:cap,p_active:d.has('active'),p_sort_order:0});
   M.editId=null;M.notice='Prato guardado com sucesso.';
   await mxLoad(api,'marmitex-admin');
  }
 }finally{M.busy=false;}
}

function mxSetError(s){M.notice=String(s||'Erro na encomenda');}

function mxBusy(){return M.busy;}
export {mxRender,mxLoad,mxChange,mxAction,mxSubmit,mxSetError,mxBusy};
