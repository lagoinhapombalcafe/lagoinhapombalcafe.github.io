// Lagoinha Café — fechamento geral (Café + Marmitex), v5.4.
// A fonte dos números é a RPC protegida cafe_general_closeout_v1 no Supabase.
const state={selectedDate:'',report:null,loading:false,error:''};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>(Number(v||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
const niceDate=d=>d?new Intl.DateTimeFormat('pt-PT',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z')):'—';
const items=a=>Array.isArray(a)?a:[];
export function getDate(){return state.selectedDate||today();}
export function getReport(){return state.report;}
export function setDate(date){
 if(!validDate(date)||date>today())throw Error('Escolha um dia válido, até hoje.');
 if(date!==state.selectedDate){state.selectedDate=date;state.report=null;state.error='';}
}
export async function load(api,date){
 if(date!==undefined)setDate(date);
 const selected=getDate();
 state.loading=true;state.error='';
 try{
  const result=await api.rpc('cafe_general_closeout_v1',{p_day:selected});
  if(result.error)throw new Error(result.error.message||'Não foi possível gerar o relatório.');
  if(!result.data||result.data.day!==selected)throw new Error('O relatório não corresponde à data escolhida.');
  state.report=result.data;
  return state.report;
 }catch(err){
  state.report=null;state.error=err.message||String(err);
  throw err;
 }finally{state.loading=false;}
}
function breakdown(section){
 const rows=items(section?.items);
 if(!rows.length)return '<p class="closeout-empty">Nenhuma venda paga nesta categoria.</p>';
 return '<div class="closeout-lines">'+rows.map(row=>
 '<div class="closeout-line"><span><b>'+esc(row.quantity)+'×</b> '+esc(row.name)+'</span><strong>'+money(row.total_cents)+'</strong></div>'
 ).join('')+'</div>';
}
function block(title,subtitle,section){
 return '<section class="closeout-group"><div class="closeout-group-head"><div><h4>'+title+'</h4><p>'+subtitle+'</p></div><strong>'+money(section?.total_cents)+'</strong></div>'+
 '<div class="closeout-counts"><span>'+Number(section?.orders||0)+' pedidos pagos</span><span>'+Number(section?.units||0)+' unidades</span></div>'+breakdown(section)+'</section>';
}
export function render(){
 const date=getDate(),r=state.report;
 const top='<section class="closeout-panel" aria-label="Fechamento de caixa geral">'+
 '<div class="closeout-head"><div><span class="section-eyebrow">LAGOINHA CAFÉ · RELATÓRIO CONSOLIDADO</span><h3>Fechamento geral de caixa</h3><p>Vendas do Café e Marmitex separadas, com as despesas registadas durante a semana.</p></div>'+
 '<label>Dia de atendimento<input id="closeout-date" type="date" max="'+today()+'" value="'+esc(date)+'"></label></div>'+
 '<div class="closeout-actions"><button type="button" class="small" data-do="closeout-refresh"'+(state.loading?' disabled':'')+'>'+(state.loading?'A calcular…':'↻ Gerar / atualizar relatório')+'</button>'+
 (r?'<button type="button" class="small closeout-whatsapp" data-do="closeout-whatsapp">Compartilhar no WhatsApp</button>'+
 '<button type="button" class="small ghost" data-do="closeout-copy">Copiar texto</button>':'')+'</div>';
 if(!r)return top+(state.error?'<p class="alert">'+esc(state.error)+'</p>':'<p class="muted">Escolha a data e clique em “Gerar / atualizar relatório”. Também aparece automaticamente ao fechar o atendimento do Café.</p>')+'</section>';
 const c=r.cafe||{},m=r.marmitex||{},e=r.expenses||{};
 const pendingCount=Number(c.pending_orders||0)+Number(m.pending_orders||0);
 const pendingAmount=Number(c.pending_cents||0)+Number(m.pending_cents||0);
 return top+
 '<div class="closeout-meta">Domingo / atendimento: <strong>'+niceDate(r.day)+'</strong> · Despesas: <strong>'+niceDate(r.week_start)+' a '+niceDate(r.week_end)+'</strong></div>'+
 '<div class="closeout-totals"><div><span>Receita Café</span><strong>'+money(c.total_cents)+'</strong></div><div><span>Receita Marmitex</span><strong>'+money(m.total_cents)+'</strong></div><div><span>Receita total confirmada</span><strong>'+money(r.total_received_cents)+'</strong></div></div>'+
 block('☕ Café','Pagamentos confirmados dos pedidos deste dia',c)+
 block('🍱 Marmitex','Encomendas pagas para retirada nesta data',m)+
 '<section class="closeout-group"><div class="closeout-group-head"><div><h4>🧾 Despesas da semana</h4><p>'+niceDate(r.week_start)+' a '+niceDate(r.week_end)+'</p></div><strong>− '+money(e.total_cents)+'</strong></div>'+
 (items(e.items).length?'<div class="closeout-lines">'+items(e.items).map(row=>
 '<div class="closeout-line"><span><b>'+niceDate(row.date)+'</b> · '+esc(row.description)+' <small>('+esc(row.category)+')</small></span><strong>− '+money(row.amount_cents)+'</strong></div>'
 ).join('')+'</div>':'<p class="closeout-empty">Nenhuma despesa registada nesta semana.</p>')+'</section>'+
 '<div class="closeout-result"><span>RESULTADO APÓS DESPESAS DA SEMANA</span><strong>'+money(r.net_after_week_expenses_cents)+'</strong></div>'+
 (pendingCount?'<p class="closeout-pending">⚠️ <b>Não incluídos na receita:</b> '+pendingCount+' pedidos ainda por receber ('+Number(c.pending_orders||0)+' Café + '+Number(m.pending_orders||0)+' Marmitex), no valor de '+money(pendingAmount)+'.</p>':'<p class="closeout-no-pending">✓ Sem pedidos pendentes de pagamento para este dia.</p>')+
 (Number(m.paid_outside_day_cents||0)?'<p class="closeout-note">Do total pago das Marmitex, '+money(m.paid_outside_day_cents)+' foi registado como recebido fora da data de retirada; está incluído na receita deste domingo.</p>':'')+
 '<p class="closeout-note">O relatório considera pedidos pagos associados ao dia do Café e à data de retirada das Marmitex. Despesas da segunda-feira até ao dia escolhido. Compras já registadas como despesa entram uma única vez. O resultado não substitui uma conferência do dinheiro físico.</p>'+
 '<details class="closeout-preview"><summary>Ver texto preparado para o WhatsApp</summary><pre>'+esc(formatText(r))+'</pre></details></section>';
}
export function formatText(report){
 const r=report||state.report;
 if(!r)throw new Error('Gere primeiro o relatório.');
 const c=r.cafe||{},m=r.marmitex||{},e=r.expenses||{};
 const rows=['☕ *LAGOINHA CAFÉ*','*FECHAMENTO GERAL DE CAIXA*',
  '📅 '+niceDate(r.day),'',
  '☕ *CAFÉ*',
  'Pedidos pagos: '+Number(c.orders||0),
  'Unidades: '+Number(c.units||0),
  ...items(c.items).map(x=>'• '+x.quantity+'× '+x.name+' — '+money(x.total_cents)),
  '*Total Café: '+money(c.total_cents)+'*','',
  '🍱 *MARMITEX*',
  'Pedidos pagos: '+Number(m.orders||0),
  'Unidades: '+Number(m.units||0),
  ...items(m.items).map(x=>'• '+x.quantity+'× '+x.name+' — '+money(x.total_cents)),
  '*Total Marmitex: '+money(m.total_cents)+'*','',
  '🧾 *DESPESAS DA SEMANA*',
  niceDate(r.week_start)+' a '+niceDate(r.week_end),
  ...(items(e.items).length?items(e.items).map(x=>'• '+niceDate(x.date)+' · '+x.description+' ('+x.category+') — '+money(x.amount_cents)):['• Nenhuma despesa registada']),
  '*Total despesas: '+money(e.total_cents)+'*','',
  '💰 *RESUMO GERAL*',
  'Recebido no Café: '+money(c.total_cents),
  'Recebido em Marmitex: '+money(m.total_cents),
  '*Total confirmado: '+money(r.total_received_cents)+'*',
  'Despesas da semana: − '+money(e.total_cents),
  '*Resultado após despesas: '+money(r.net_after_week_expenses_cents)+'*'
 ];
 const pendC=Number(c.pending_orders||0),pendM=Number(m.pending_orders||0);
 if(pendC+pendM)rows.push('','⚠️ *PAGAMENTOS PENDENTES (não incluídos)*',
   'Café: '+pendC+' pedido(s) · '+money(c.pending_cents),
   'Marmitex: '+pendM+' encomenda(s) · '+money(m.pending_cents));
 if(Number(m.paid_outside_day_cents||0))rows.push('','ℹ️ Marmitex recebidas noutra data: '+money(m.paid_outside_day_cents)+' (incluídas no total).');
 rows.push('','_Relatório de pedidos pagos por dia do Café / domingo de retirada; despesas da semana até esta data._');
 return rows.join('\n');
}
export async function copy(){
 const content=formatText();
 if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(content);return;}
 const area=document.createElement('textarea');area.value=content;area.style.position='fixed';area.style.opacity='0';
 document.body.appendChild(area);area.select();
 const copied=document.execCommand('copy');area.remove();
 if(!copied)throw new Error('Não foi possível copiar. Utilize o texto de pré-visualização.');
}
export function shareWhatsApp(){
 // Ação direta do utilizador, sem guardar número de telefone ou partilhar com o servidor.
 const url='https://wa.me/?text='+encodeURIComponent(formatText());
 const tab=window.open(url,'_blank');
 if(tab)tab.opener=null;
 else window.location.assign(url);
}
