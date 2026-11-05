const state={movements:[],expenses:[],reservations:{products:[],combos:[],open_orders:0},marmitex:{weeks:[],items:[],orders:[]},month:'',busy:false,loaded:false};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>(Number(c||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const isoMonth=month=>/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?month:day().slice(0,7);
const nextMonth=month=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);return d.toISOString().slice(0,10);};
const stamp=s=>s?new Date(s).toLocaleString('pt-PT',{timeZone:'Europe/Lisbon',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const labels={entrada:'Entrada',saida:'Saída',conferencia:'Conferência',automatico:'Automático'};
function checkedMonth(){return state.month||day().slice(0,7);}
export async function load(api,month){
 const selected=isoMonth(month);
 const first=selected+'-01',end=nextMonth(selected);
 const [moves,expenses,reservations,marmitex]=await Promise.all([
  api.from('cafe_stock_movements').select('id,product_id,product_name,kind,delta_qty,qty_before,qty_after,unit_cost_cents,total_cost_cents,expense_id,movement_date,note,source,created_at').gte('movement_date',first).lt('movement_date',end).order('created_at',{ascending:false}).limit(1000),
  api.from('cafe_expenses').select('id,expense_date,description,category,amount_cents').gte('expense_date',first).lt('expense_date',end).order('expense_date',{ascending:false}).limit(1000),
  api.rpc('cafe_open_reservations_v1'),
  api.rpc('mx_staff_dashboard')
 ]);
 if(moves.error)throw Error('Histórico de estoque: '+moves.error.message);
 if(expenses.error)throw Error('Despesas do mês: '+expenses.error.message);
 if(reservations.error)throw Error('Reservas dos pedidos do café: '+reservations.error.message);
 if(marmitex.error)throw Error('Reservas das marmitex: '+marmitex.error.message);
 state.reservations=reservations.data||{products:[],combos:[],open_orders:0};
 state.marmitex=marmitex.data||{weeks:[],items:[],orders:[]};
 state.movements=moves.data||[];
 state.expenses=expenses.data||[];
 state.month=selected;
 state.loaded=true;
}
function reservedMap(list){return new Map((list||[]).map(x=>[String(x.id),Number(x.reserved_qty)||0]));}
function itemRows(products){
 const reserved=reservedMap(state.reservations.products);
 return products.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt')).map(p=>{
  const saldo=p.stock_qty, saved=reserved.get(String(p.id))||0;
  const qty=saldo===null?'Sem controlo':Number(saldo).toLocaleString('pt-PT')+' un.';
  const cls=saldo===null?'none':saldo<=5?'low':'ok';
  const physical=saldo===null?'—':(Number(saldo)+saved).toLocaleString('pt-PT')+' un.';
  return '<tr><td><b>'+esc(p.name)+'</b><small>'+(p.active?'Ativo':'Oculto')+'</small></td>'+
   '<td><span class="stock-status stock-'+cls+'">'+qty+'</span></td>'+
   '<td><span class="stock-reserved '+(saved?'has-reservations':'')+'">'+saved+' un.</span></td>'+
   '<td>'+physical+'</td></tr>';
 }).join('');
}
function comboReservations(combos){
 const reserved=reservedMap(state.reservations.combos);
 const rows=(combos||[]).filter(c=>c.active||reserved.has(String(c.id))).sort((a,b)=>a.name.localeCompare(b.name,'pt'));
 if(!rows.length)return '';
 return '<section class="stock-panel"><h3>Combos encomendados</h3><p class="stock-muted">Cada combo reserva também os alimentos e bebidas escolhidos. Esses componentes já estão incluídos nas reservas da tabela de produtos acima.</p>'+
 '<div class="stock-scroll"><table class="stock-table"><thead><tr><th>Combo</th><th>Disponível</th><th>Reservado</th></tr></thead><tbody>'+
 rows.map(c=>'<tr><td><b>'+esc(c.name)+'</b></td><td>'+(c.stock_qty===null?'Sem controlo':c.stock_qty+' un.')+'</td><td><span class="stock-reserved '+(reserved.get(String(c.id))?'has-reservations':'')+'">'+(reserved.get(String(c.id))||0)+' un.</span></td></tr>').join('')+'</tbody></table></div></section>';
}
function weeklyMarmitex(){
 const weeks=(state.marmitex.weeks||[]).filter(w=>w.pickup_date>=day()).sort((a,b)=>a.pickup_date.localeCompare(b.pickup_date)).slice(0,10);
 const items=state.marmitex.items||[];
 const orders=state.marmitex.orders||[];
 const pendingByItem=new Map(),deliveredByItem=new Map();
 for(const o of orders){
  if(o.status==='cancelled')continue;
  const map=o.status==='delivered'?deliveredByItem:pendingByItem;
  for(const line of o.items||[])map.set(String(line.item_id),(map.get(String(line.item_id))||0)+Number(line.quantity||0));
 }
 const rows=[];
 for(const week of weeks){
  const list=items.filter(i=>i.week_id===week.id);
  for(const item of list){
   const booked=Number(item.reserved_qty)||0;
   const toGive=pendingByItem.get(String(item.id))||0;
   const done=deliveredByItem.get(String(item.id))||0;
   const remaining=item.capacity===null?'Sem limite':Math.max(0,Number(item.capacity)-booked)+' un.';
   rows.push('<tr><td><b>'+esc(week.pickup_date)+'</b><small>Domingo de retirada</small></td><td><b>'+esc(item.name)+'</b></td><td><span class="stock-reserved '+(booked?'has-reservations':'')+'">'+booked+' un.</span></td><td><strong>'+toGive+' un.</strong></td><td>'+done+' un.</td><td>'+remaining+'</td></tr>');
  }
 }
 return '<section class="stock-panel stock-weekly"><div class="stock-panel-top"><div><h3>Reservas de Marmitex · Próximos domingos</h3><p class="stock-muted">Encomendas independentes do estoque do café. Os limites são definidos no cardápio semanal.</p></div><a class="stock-weekly-link" href="./marmitex.html#/marmitex-caixa">Ver encomendas</a></div>'+
 '<div class="stock-scroll"><table class="stock-table stock-weekly-table"><thead><tr><th>Retirada</th><th>Prato</th><th>Total reservado</th><th>Por entregar</th><th>Entregue</th><th>Vagas disponíveis</th></tr></thead><tbody>'+
 (rows.join('')||'<tr><td colspan="6">Não há semanas com pratos cadastrados para as próximas retiradas.</td></tr>')+
 '</tbody></table></div><p class="stock-muted">Total reservado inclui encomendas não canceladas, mesmo após a entrega. “Por entregar” mostra apenas as encomendas ainda não levantadas.</p></section>';
}
function historyRows(){
 return state.movements.slice(0,200).map(m=>{
  const delta=Number(m.delta_qty);
  const text=delta>0?'+'+delta:delta<0?String(delta):'0';
  const kind=labels[m.kind]||m.kind;
  const before=m.qty_before===null?'—':m.qty_before;
  const after=m.qty_after===null?'—':m.qty_after;
  return '<tr><td><b>'+esc(kind)+'</b><small>'+esc(m.movement_date)+'</small></td><td>'+esc(m.product_name)+'<small>'+esc(m.note||'')+'</small></td><td class="stock-number '+(delta<0?'negative':delta>0?'positive':'')+'">'+text+'</td><td>'+before+' → '+after+'</td><td>'+money(m.total_cost_cents)+'</td></tr>';
 }).join('');
}
export function render(products,month,combos){
 const selected=isoMonth(month);
 const tracked=products.filter(p=>p.stock_qty!==null);
 const low=tracked.filter(p=>p.stock_qty<=5).length;
 const cafeReserved=(state.reservations.products||[]).reduce((n,i)=>n+Number(i.reserved_qty||0),0);
 const marmitexUpcoming=(state.marmitex.items||[]).filter(i=>(state.marmitex.weeks||[]).some(w=>w.id===i.week_id&&w.pickup_date>=day())).reduce((n,i)=>n+Number(i.reserved_qty||0),0);
 const linked=new Set(state.movements.map(m=>m.expense_id).filter(Boolean));
 const stockSpend=state.movements.reduce((s,m)=>s+Number(m.total_cost_cents||0),0);
 const otherSpend=state.expenses.filter(e=>!linked.has(e.id)).reduce((s,e)=>s+Number(e.amount_cents||0),0);
 const totalSpend=stockSpend+otherSpend;
 const entries=state.movements.filter(m=>m.kind==='entrada').length;
 const exits=state.movements.filter(m=>m.kind==='saida'||(m.kind==='automatico'&&m.delta_qty<0)).length;
 const reservedProducts=reservedMap(state.reservations.products);
 const options=products.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt')).map(p=>'<option value="'+esc(p.id)+'" data-current="'+esc(p.stock_qty??'')+'" data-reserved="'+(reservedProducts.get(String(p.id))||0)+'">'+esc(p.name)+'</option>').join('');
 return '<section class="stock-dashboard" aria-label="Controlo do estoque">'+
 '<div class="stock-hero"><div><span class="section-eyebrow">ADMINISTRADOR · INVENTÁRIO</span><h2>Controle de estoque</h2><p>Registe compras, retiradas e conferências. As vendas do café atualizam o saldo dos produtos automaticamente.</p></div>'+
 '<label>Mês de referência<input id="stock-month" type="month" value="'+esc(selected)+'"></label></div>'+
 '<div class="stock-stats">'+
 '<div><span>Compras de estoque</span><strong>'+money(stockSpend)+'</strong><small>Entradas lançadas com custo</small></div>'+
 '<div><span>Outras despesas</span><strong>'+money(otherSpend)+'</strong><small>Registos do Financeiro</small></div>'+
 '<div><span>Gastos do mês</span><strong>'+money(totalSpend)+'</strong><small>Compras + outras despesas</small></div>'+
 '<div><span>Produtos com saldo baixo</span><strong>'+low+'</strong><small>Saldo entre 0 e 5 unidades</small></div>'+
 '</div>'+
 '<p class="stock-note">As compras com valor registadas aqui entram automaticamente no Financeiro. Não lance a mesma compra duas vezes. Os valores referem-se ao mês selecionado.</p>'+ 
 '<div class="stock-reservation-summary"><div><span>☕ Reservado nos pedidos abertos do Café</span><strong>'+cafeReserved+' unidades</strong><small>'+Number(state.reservations.open_orders||0)+' pedidos ainda não entregues</small></div><div><span>🍱 Marmitex já encomendadas (próximos domingos)</span><strong>'+marmitexUpcoming+' unidades</strong><small>Controladas no cardápio semanal, separadamente do Café</small></div></div>'+
 '<div class="stock-columns"><section class="stock-panel"><h3>Lançar movimento</h3>'+
 '<p class="stock-muted">A entrada aumenta o saldo. A saída diminui. A conferência define a quantidade que contou fisicamente.</p>'+
 '<form id="stock-movement-form" class="stock-form">'+
 '<label>Produto<select name="product_id" id="stock-product" required>'+options+'</select></label>'+
 '<label>Operação<select name="kind" id="stock-kind"><option value="entrada">Entrada / compra</option><option value="saida">Saída / consumo / perda</option><option value="conferencia">Conferência / acerto</option></select></label>'+
 '<div class="stock-form-pair"><label id="stock-qty-label">Quantidade<input type="number" min="1" step="1" max="100000" name="quantity" id="stock-quantity" required placeholder="Ex.: 10"></label>'+
 '<label id="stock-cost-wrap">Custo unitário (€)<input type="text" inputmode="decimal" name="unit_cost" id="stock-unit-cost" value="" placeholder="Ex.: 1,25"></label></div>'+
 '<label>Data do movimento<input type="date" name="movement_date" required value="'+day()+'"></label>'+
 '<label>Observação (opcional)<input name="note" maxlength="240" placeholder="Fornecedor, fatura, perda ou motivo"></label>'+
 '<p class="stock-current" id="stock-current">Saldo atual: —</p>'+
 '<button class="stock-submit" type="submit">Guardar movimento</button>'+
 '</form></section>'+
 '<section class="stock-panel"><div class="stock-panel-top"><div><h3>Saldos atuais</h3><p class="stock-muted">'+tracked.length+' produtos controlados</p></div><button class="small ghost" data-do="stock-refresh">Atualizar ↻</button></div>'+
 '<div class="stock-scroll"><table class="stock-table stock-reservation-table"><thead><tr><th>Produto</th><th>Disponível</th><th>Reservado</th><th>Total estimado antes das entregas</th></tr></thead><tbody>'+
 (itemRows(products)||'<tr><td colspan="4">Sem produtos cadastrados.</td></tr>')+
 '</tbody></table></div><p class="stock-muted">“Reservado” é a quantidade em pedidos do café ainda não entregues. O sistema já descontou essas unidades do disponível na criação do pedido: não desconte novamente. O total estimado soma disponível e reservado para auxiliar a conferência física. “Sem controlo” significa estoque ilimitado.</p></section></div>'+ 
 comboReservations(combos)+weeklyMarmitex()+
 '<section class="stock-panel"><div class="stock-panel-top"><div><h3>Histórico de entradas e saídas</h3>'+
 '<p class="stock-muted">'+state.movements.length+' movimentos no mês · '+entries+' entradas · '+exits+' saídas</p></div>'+
 '<button type="button" class="small ghost" data-do="stock-export">Exportar CSV</button></div>'+
 '<div class="stock-scroll"><table class="stock-table stock-history"><thead><tr><th>Tipo / data</th><th>Produto / motivo</th><th>Variação</th><th>Antes → depois</th><th>Gasto</th></tr></thead><tbody>'+
 (historyRows()||'<tr><td colspan="5">Nenhum movimento registado neste mês.</td></tr>')+
 '</tbody></table></div></section></section>';
}
export function updateForm(root){
 const kind=root.querySelector('#stock-kind');
 const product=root.querySelector('#stock-product');
 if(!kind||!product)return;
 const entry=kind.value==='entrada',count=kind.value==='conferencia';
 const cost=root.querySelector('#stock-cost-wrap');
 const quantity=root.querySelector('#stock-quantity');
 const label=root.querySelector('#stock-qty-label');
 if(cost){cost.hidden=!entry;cost.querySelector('input').disabled=!entry;}
 if(quantity){quantity.min=count?'0':'1';}
 if(label)label.childNodes[0].textContent=count?'Quantidade contada':'Quantidade';
 const option=product.selectedOptions[0];
 const current=option?.dataset.current;
 const note=root.querySelector('#stock-current');
 if(note){const reserved=Number(option?.dataset.reserved||0);note.textContent=current===''?'Sem controlo de saldo · '+reserved+' reservadas em pedidos do café':'Disponível: '+current+' unidades · Reservado em pedidos: '+reserved+' unidades (já descontadas do disponível)';}
}
export async function submit(api,form){
 const data=new FormData(form);
 const productId=String(data.get('product_id')||'');
 const kind=String(data.get('kind')||'');
 const quantity=Number(data.get('quantity'));
 if(!productId||!['entrada','saida','conferencia'].includes(kind)||!Number.isInteger(quantity)||quantity<0||quantity>100000||(kind!=='conferencia'&&quantity===0))throw Error('Verifique a quantidade e o produto.');
 const price=String(data.get('unit_cost')||'').trim().replace(',','.');
 const numeric=price?Number(price):0;
 if(!Number.isFinite(numeric)||numeric<0||numeric>100000||!Number.isInteger(Math.round(numeric*100)))throw Error('Custo inválido.');
 const cents=kind==='entrada'?Math.round(numeric*100):0;
 const resp=await api.rpc('cafe_stock_register',{
  p_product_id:productId,p_kind:kind,p_quantity:quantity,
  p_unit_cost_cents:cents,p_note:String(data.get('note')||'').trim(),
  p_movement_date:String(data.get('movement_date')||day())
 });
 if(resp.error)throw Error(resp.error.message||'Falha ao guardar o movimento.');
 return resp.data;
}
export function exportCsv(){
 const lines=[['Data','Produto','Tipo','Variacao','Antes','Depois','Custo unitario EUR','Gasto EUR','Observacao']];
 for(const m of state.movements){
  lines.push([m.movement_date,m.product_name,labels[m.kind]||m.kind,m.delta_qty,m.qty_before??'',m.qty_after??'',m.unit_cost_cents===null?'':(m.unit_cost_cents/100).toFixed(2),(m.total_cost_cents/100).toFixed(2),m.note||'']);
 }
 const csv='\uFEFF'+lines.map(a=>a.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='Lagoinha-Cafe-Estoque-'+checkedMonth()+'.csv';
 document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
