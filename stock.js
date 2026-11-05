const state={movements:[],expenses:[],month:'',busy:false,loaded:false};
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
 const [moves,expenses]=await Promise.all([
  api.from('cafe_stock_movements').select('id,product_id,product_name,kind,delta_qty,qty_before,qty_after,unit_cost_cents,total_cost_cents,expense_id,movement_date,note,source,created_at').gte('movement_date',first).lt('movement_date',end).order('created_at',{ascending:false}).limit(1000),
  api.from('cafe_expenses').select('id,expense_date,description,category,amount_cents').gte('expense_date',first).lt('expense_date',end).order('expense_date',{ascending:false}).limit(1000)
 ]);
 if(moves.error)throw Error('Histórico de estoque: '+moves.error.message);
 if(expenses.error)throw Error('Despesas do mês: '+expenses.error.message);
 state.movements=moves.data||[];
 state.expenses=expenses.data||[];
 state.month=selected;
 state.loaded=true;
}
function itemRows(products){
 return products.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt')).map(p=>{
   const saldo=p.stock_qty;
   const qty=saldo===null?'Sem controlo':Number(saldo).toLocaleString('pt-PT')+' un.';
   const cls=saldo===null?'none':saldo<=5?'low':'ok';
   return '<tr><td><b>'+esc(p.name)+'</b><small>'+(p.active?'Ativo':'Oculto')+'</small></td><td><span class="stock-status stock-'+cls+'">'+qty+'</span></td></tr>';
 }).join('');
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
export function render(products,month){
 const selected=isoMonth(month);
 const tracked=products.filter(p=>p.stock_qty!==null);
 const low=tracked.filter(p=>p.stock_qty<=5).length;
 const linked=new Set(state.movements.map(m=>m.expense_id).filter(Boolean));
 const stockSpend=state.movements.reduce((s,m)=>s+Number(m.total_cost_cents||0),0);
 const otherSpend=state.expenses.filter(e=>!linked.has(e.id)).reduce((s,e)=>s+Number(e.amount_cents||0),0);
 const totalSpend=stockSpend+otherSpend;
 const entries=state.movements.filter(m=>m.kind==='entrada').length;
 const exits=state.movements.filter(m=>m.kind==='saida'||(m.kind==='automatico'&&m.delta_qty<0)).length;
 const options=products.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt')).map(p=>'<option value="'+esc(p.id)+'" data-current="'+esc(p.stock_qty??'')+'">'+esc(p.name)+'</option>').join('');
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
 '<div class="stock-scroll"><table class="stock-table"><thead><tr><th>Produto</th><th>Em estoque</th></tr></thead><tbody>'+
 (itemRows(products)||'<tr><td colspan="2">Sem produtos cadastrados.</td></tr>')+
 '</tbody></table></div><p class="stock-muted">“Sem controlo” significa que o produto não possui limite de estoque. Faça uma conferência para definir um saldo inicial.</p></section></div>'+
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
 if(note)note.textContent=current===''?'Saldo atual: sem controlo (começa a partir de zero na entrada ou define-se na conferência)':'Saldo atual: '+current+' unidades';
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
