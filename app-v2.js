import {CONFIG} from './config.js';
const $=s=>document.querySelector(s), root=$('#app');
const S={products:[],combos:[],settings:{orders_open:false},cart:[],qty:1,food:'',drink:'',combo:'',role:null,user:null,orders:[],expenses:[],ready:[],ticket:null,tab:'visao',editProduct:null,editCombo:null,month:'',busy:false,notice:''};
let api;
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EUR=n=>(Number(n||0)/100).toLocaleString('pt-PT',{style:'currency',currency:'EUR'});
const DAY=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const route=()=>{let p=(location.hash||'#/cliente').split('/')[1];return ({menu:'cliente',staff:'caixa'})[p]||p||'cliente'};
const allowed=r=>S.role==='admin'||(r==='caixa'&&S.role==='cashier')||(r==='cozinha'&&S.role==='kitchen');
const product=id=>S.products.find(x=>x.id===id),combo=id=>S.combos.find(x=>x.id===id);
const valid=x=>x&&x.active&&(x.stock_qty===null||x.stock_qty>0);
const getDate=x=>new Date(x).toLocaleTimeString('pt-PT',{timeZone:'Europe/Lisbon',hour:'2-digit',minute:'2-digit'});
const states={awaiting_payment:'Aguarda pagamento',queued:'Na fila',preparing:'Em preparação',ready:'Pronto',delivered:'Entregue',cancelled:'Cancelado'};
const alert=()=>S.notice?`<p class="alert">${E(S.notice)} <button class="small" data-do="dismiss">×</button></p>`:'';
const header=(title,sub)=>`<section class="hero"><div><span class="eyebrow">LAGOINHA POMBAL · DOMINGOS 9H–10H</span><h1>${title}</h1><p>${sub}</p></div><span class="cup">☕</span></section>`;
const shell=(content,fullscreen=false)=>fullscreen?content:`<header class="main-header"><a class="brand" href="#/cliente">☕ <strong>LAGOINHA <em>CAFÉ</em></strong></a><nav><a href="#/cliente">Cliente</a>${S.role==="admin"?`<a href="#/caixa">Caixa</a><a href="#/cozinha">Cozinha</a><a href="#/admin">Administrador</a>`:S.role==="cashier"?`<a href="#/caixa">Caixa</a>`:S.role==="kitchen"?`<a href="#/cozinha">Cozinha</a>`:`<a href="#/caixa">Equipa</a>`}</nav></header><main class="wrap">${alert()}${content}</main><footer>Lagoinha Pombal · Rua Prof. Veiga Simão, nº 4 · Pedidos presenciais</footer>`;
function paint(){let r=route(),body;
if(r==='cliente')body=menu();
else if(r==='pedido')body=ticket();
else if(r==='retirada')return root.innerHTML=pickup();
else if(r==='qr')body=qr();
else if(!allowed(r))body=login(r);
else if(r==='caixa')body=queue('caixa');
else if(r==='cozinha')body=queue('cozinha');
else if(r==='admin')body=admin();
else body=menu();
root.innerHTML=shell(body);}
async function loadCatalog(){let [p,c,x]=await Promise.all([api.from('products').select('*').order('sort_order'),api.from('cafe_combos').select('*').order('sort_order'),api.from('cafe_settings').select('*').eq('id',1).single()]);for(let v of [p,c,x])if(v.error)throw v.error;
S.products=p.data;S.combos=c.data;S.settings=x.data;
if(!valid(product(S.food)))S.food=S.products.find(p=>p.category==='food'&&valid(p))?.id||'';
if(!valid(product(S.drink)))S.drink=S.products.find(p=>p.category==='drink'&&valid(p))?.id||'';
if(!valid(combo(S.combo)))S.combo=S.combos.find(valid)?.id||'';}
async function auth(){const {data:{user}}=await api.auth.getUser();S.user=user;S.role=null;if(user){let {data,error}=await api.from('staff_roles').select('role').eq('user_id',user.id).maybeSingle();if(error)throw error;S.role=data?.role||null;}}
async function loadOrders(){if(!S.role)return;const r=await api.from('orders').select('id,number,order_day,created_at,paid_at,total_cents,status,payment_status,cafe_order_lines(item_name,detail,quantity)').order('created_at',{ascending:false}).limit(500);if(r.error)throw r.error;S.orders=r.data||[];if(S.role==='admin'){let ex=await api.from('cafe_expenses').select('*').order('expense_date',{ascending:false}).limit(500);if(ex.error)throw ex.error;S.expenses=ex.data||[];}}
async function loadTicket(){let token=location.hash.split('/')[2];if(!/^[\da-f-]{36}$/i.test(token||'')){S.ticket=null;return;}let r=await api.rpc('get_cafe_ticket_v2',{p_token:token});if(r.error)throw r.error;S.ticket=r.data;}
async function loadReady(){let r=await api.rpc('get_ready_tickets');if(r.error)throw r.error;S.ready=(r.data||[]).map(x=>x.number);}
async function work(job){if(S.busy)return;S.busy=true;try{await job();S.notice='';}catch(e){S.notice='Erro: '+(e.message||e);}finally{S.busy=false;paint();}}
function cartAvailable(){
  const tally=new Map();
  for(const row of S.cart){
    if(row.kind==='unit'){
      const p=product(row.id);
      if(!valid(p)||p.price_cents===null)return false;
      tally.set('p:'+row.id,(tally.get('p:'+row.id)||0)+row.qty);
    }else{
      const c=combo(row.id),f=product(row.food_id),d=product(row.drink_id);
      if(!valid(c)||!valid(f)||!valid(d))return false;
      tally.set('c:'+row.id,(tally.get('c:'+row.id)||0)+row.qty);
      tally.set('p:'+row.food_id,(tally.get('p:'+row.food_id)||0)+row.qty);
      tally.set('p:'+row.drink_id,(tally.get('p:'+row.drink_id)||0)+row.qty);
    }
  }
  for(const [key,num] of tally){
    const p=key.slice(0,2)==='c:'?combo(key.slice(2)):product(key.slice(2));
    if(!p||p.stock_qty!==null&&num>p.stock_qty)return false;
  }
  return true;
}
function menu(){
  const foods=S.products.filter(p=>p.category==='food'&&valid(p));
  const drinks=S.products.filter(p=>p.category==='drink'&&valid(p));
  const combos=S.combos.filter(valid);
  const singles=S.products.filter(p=>valid(p)&&p.price_cents!==null);
  const chosen=combo(S.combo)&&valid(combo(S.combo))?combo(S.combo):combos[0];
  const count=S.cart.reduce((total,row)=>total+row.qty,0);
  const total=S.cart.reduce((sum,row)=>sum+row.qty*row.price,0);
  const canCheckout=cartAvailable();
  const choiceButtons=(array,selected,what)=>array.map(p=>`<button type="button" class="choice-tile ${selected===p.id?'selected':''}" data-do="choose-${what}" data-id="${E(p.id)}" aria-pressed="${selected===p.id}"><span class="choice-icon">${E(p.icon||'🍽️')}</span><span class="choice-name">${E(p.name)}</span><span class="choice-check">${selected===p.id?'✓':'+'}</span></button>`).join('');
  const comboCards=combos.map(c=>`<button type="button" class="combo-option ${chosen?.id===c.id?'current':''}" data-do="combo" data-id="${E(c.id)}" aria-pressed="${chosen?.id===c.id}"><span class="combo-symbol">✦</span><span class="combo-text"><strong>${E(c.name)}</strong><small>${E(c.description||'Um alimento e uma bebida')}</small></span><span class="combo-price">${EUR(c.price_cents)}</span></button>`).join('');
  const unitCards=singles.map(p=>`<article class="unit-card"><span class="unit-art">${E(p.icon||'🍽️')}</span><span class="unit-info"><strong>${E(p.name)}</strong><small>${p.category==='drink'?'Bebida':'Alimento'} · ${EUR(p.price_cents)}</small></span><button type="button" class="unit-add" data-do="add-unit" data-id="${E(p.id)}" aria-label="Adicionar ${E(p.name)} ao pedido">＋</button></article>`).join('');
  return `<section class="client-hero">
    <div class="client-hero-text"><span class="hero-kicker"><span class="hero-dot"></span> LAGOINHA POMBAL · DOMINGOS 9H–10H</span>
      <h1>Seu café.<br><em>Seu momento.</em></h1>
      <p>Escolha o que mais gosta, monte seu pedido e aproveite a comunhão. Simples assim.</p>
      <div class="hero-pills"><span>✓ Sem cadastro</span><span>✓ Pague no balcão</span></div>
    </div><div class="hero-graphic" aria-hidden="true"><span class="graphic-sun"></span><span class="graphic-cup">☕</span><span class="graphic-ring"></span></div>
  </section>
  ${!S.settings.orders_open?'<div class="closed"><strong>Atendimento temporariamente fechado</strong><span>Você pode conhecer o cardápio. Os pedidos serão liberados pela equipa do café.</span></div>':''}
  <div class="menu-intro"><span class="section-eyebrow">FEITO PARA O SEU DOMINGO</span><h2>O que vai pedir hoje?</h2><p>Combine um combo com outros produtos. Tudo fica no mesmo pedido.</p></div>
  <section class="menu-split">
    <div class="panel combo-panel"><div class="panel-head"><div><span class="section-eyebrow">01 · MAIS PEDIDOS</span><h2>Combos</h2></div><span class="section-icon">🥐</span></div>
      ${combos.length&&foods.length&&drinks.length?`${comboCards}
        <div class="choice-section"><div class="choice-title"><b>Escolha o alimento</b><span>1 por combo</span></div><div class="choice-grid">${choiceButtons(foods,S.food,'food')}</div></div>
        <div class="choice-section"><div class="choice-title"><b>Escolha a bebida</b><span>1 por combo</span></div><div class="choice-grid">${choiceButtons(drinks,S.drink,'drink')}</div></div>
        <div class="combo-add-row"><div class="qty-group"><span>Quantidade</span><div class="qty-stepper"><button type="button" data-do="combo-less" aria-label="Diminuir quantidade">−</button><strong>${S.qty}</strong><button type="button" data-do="combo-more" aria-label="Aumentar quantidade">+</button></div></div>
          <button type="button" class="combo-add-btn" data-do="add-combo">Adicionar combo <span>↗</span></button></div>`
      :'<p class="empty-menu">Os combos não estão disponíveis neste momento.</p>'}
    </div>
    <div class="panel singles-panel"><div class="panel-head"><div><span class="section-eyebrow">02 · ESCOLHA LIVRE</span><h2>Itens individuais</h2></div><span class="section-icon">✦</span></div>
      <p class="muted singles-caption">Acrescente um salgado ou bebida ao combo, ou peça apenas o que desejar.</p>
      ${singles.length?unitCards:'<p class="empty-menu">Os produtos individuais serão disponibilizados em breve.</p>'}
      <div class="menu-note"><span>☕</span><p>Um bom café fica ainda melhor quando compartilhado.</p></div>
    </div>
  </section>
  <section class="panel cart" id="cart"><div class="panel-head"><div><span class="section-eyebrow">03 · RESUMO</span><h2>Seu pedido</h2></div><span class="cart-count">${count} ${count===1?'item':'itens'}</span></div>
    ${S.cart.length?S.cart.map((row,i)=>`<div class="cart-line"><div class="cart-details"><b>${E(row.name)}</b>${row.detail?`<small>${E(row.detail)}</small>`:''}<small>${EUR(row.price)} cada</small></div>
      <div class="cart-end"><b>${EUR(row.qty*row.price)}</b><div class="cart-stepper"><button type="button" data-do="minus" data-i="${i}" aria-label="Retirar um">−</button><span>${row.qty}</span><button type="button" data-do="plus" data-i="${i}" aria-label="Adicionar um">+</button></div></div></div>`).join('')
      :'<div class="empty-cart"><span>🛍️</span><h3>O carrinho está vazio</h3><p>Escolha um combo ou um produto individual acima.</p></div>'}
    ${!canCheckout&&S.cart.length?'<p class="stock-alert">Um dos itens do carrinho já não está disponível. Ajuste a quantidade ou retire-o.</p>':''}
    <div class="checkout"><div class="checkout-total"><span>Total do pedido</span><strong>${EUR(total)}</strong></div><button class="checkout-btn" type="button" data-do="send" ${!S.settings.orders_open||!S.cart.length||!canCheckout||S.busy?'disabled':''}>Confirmar pedido <span>→</span></button><small>Sem cadastro. Pague no balcão e acompanhe sua senha de retirada.</small></div>
  </section>
  ${S.cart.length?`<div class="floating-cart"><div><small>${count} ${count===1?'item':'itens'} no pedido</small><strong>${EUR(total)}</strong></div><button type="button" data-do="go-cart">Ver pedido <span>↑</span></button></div>`:''}`;
}
function ticket(){const t=S.ticket;if(!t)return '<div class="panel">Pedido não encontrado. <button data-do="refresh">Atualizar</button></div>';return `<div class="panel ticket"><span class="eyebrow">LAGOINHA CAFÉ · SENHA</span><h1>${String(t.number).padStart(3,'0')}</h1><strong class="status">${E(states[t.status]||t.status)}</strong><p>${(t.lines||[]).map(x=>`${x.quantity}× ${E(x.item_name)} ${E(x.detail||'')}`).join('<br>')}</p><h3>${EUR(t.total_cents)}</h3>${t.number>=9000?'<p class="test-note">🧪 PEDIDO DE TESTE — sem pagamento real.</p>':'<p class="muted">Apresenta esta senha no caixa para pagar. Só depois a cozinha recebe o pedido.</p>'}<button data-do="refresh">Atualizar estado</button></div>`;}
function pickup(){return `<div class="pickup"><header>☕ LAGOINHA CAFÉ</header><h1>PEDIDOS PRONTOS</h1><section>${S.ready.length?S.ready.map(n=>`<b>${String(n).padStart(3,'0')}</b>`).join(''):'<p>Aguardando os próximos pedidos.</p>'}</section><p>Dirija-se ao balcão quando a sua senha aparecer.</p><a href="#/cliente">Voltar ao cardápio</a></div>`;}
function login(r){return header('Área da equipa','Acesso protegido para caixa, cozinha e administração.')+`<section class="panel login"><h2>${E({caixa:'Caixa',cozinha:'Cozinha',admin:'Administrador'}[r]||'Equipa')}</h2>${S.user?`<p>A conta ${E(S.user.email)} ainda não está autorizada nesta área.</p><button data-do="logout">Sair da conta</button>`:`<form id="login" class="form-grid"><label>Email<input type="email" name="email" required autocomplete="username"></label><label>Palavra-passe<input type="password" name="password" required autocomplete="current-password"></label><button>Entrar</button></form>`}<p class="muted">Apenas contas criadas e autorizadas no Supabase têm acesso à equipa.</p></section>`;}
function orderCard(o,actions){return `<article class="order ${o.number>=9000?'test-order':''}"><div class="order-head"><strong>#${String(o.number).padStart(3,'0')} ${o.number>=9000?'<span class="test-tag">TESTE</span>':''}</strong><span>${E(states[o.status])} · ${getDate(o.created_at)}</span></div><p>${(o.cafe_order_lines||[]).map(l=>`<span>${l.quantity}× ${E(l.item_name)} ${E(l.detail||'')}</span>`).join('<br>')}</p><div class="align-row"><b>${EUR(o.total_cents)}</b><div>${actions.map(([a,label])=>`<button class="small" data-do="order" data-act="${a}" data-id="${o.id}">${label}</button>`).join(' ')}</div></div></article>`;}
function queue(who){let day=S.orders.filter(o=>o.order_day===DAY()),pending=day.filter(o=>o.payment_status==='pending'&&o.status==='awaiting_payment'),paid=day.filter(o=>o.payment_status==='paid');let cards=who==='caixa'?pending.map(o=>orderCard(o,o.number>=9000?[['paid','Simular pagamento']]:[['paid','Confirmar pagamento'],['cancel','Cancelar']])):day.filter(o=>o.payment_status==='paid'&&['queued','preparing'].includes(o.status)).map(o=>orderCard(o,o.status==='queued'?[['preparing','Iniciar preparo'],['ready','Pronto']]:[['ready','Marcar pronto']]));let ready=day.filter(o=>o.status==='ready');return header(who==='caixa'?'Caixa':'Cozinha',who==='caixa'?'Recebe pagamentos e liberta pedidos para a cozinha.':'Prepara apenas pedidos com pagamento confirmado.')+`<div class="metrics"><div>Aguardam pagamento<b>${pending.length}</b></div><div>Pedidos pagos<b>${paid.length}</b></div><div>Total recebido<b>${EUR(paid.filter(o=>o.number<9000).reduce((x,o)=>x+o.total_cents,0))}</b></div></div><div class="panel"><div class="panel-head"><h2>${who==='caixa'?'Aguardam pagamento':'A preparar'}</h2><button class="small ghost" data-do="refresh">Atualizar ↻</button></div><div class="orders">${cards.join('')||'<p class="muted">Nenhum pedido nesta fila.</p>'}</div></div>${who==='caixa'?`<div class="panel"><h2>Prontos para levantar</h2><div class="orders">${ready.map(o=>orderCard(o,[['delivered','Entregue']])).join('')||'<p class="muted">Nenhum pedido pronto.</p>'}</div></div>`:''}<p><a href="#/retirada">Abrir ecrã das senhas prontas ↗</a></p>`;}
function admin(){let opts=[['visao','Resumo'],['produtos','Produtos'],['combos','Combos'],['financas','Financeiro'],['qr','QR Code']];return header('Administrador','Controle geral, cardápio, estoque e finanças.')+`<nav class="tabs">${opts.map(([id,label])=>`<button data-do="tab" data-tab="${id}" class="${S.tab===id?'active':''}">${label}</button>`).join('')}</nav>${S.tab==='visao'?overview():S.tab==='produtos'?productsPanel():S.tab==='combos'?combosPanel():S.tab==='financas'?financePanel():qr()}`;}
function overview(){let paid=S.orders.filter(o=>o.order_day===DAY()&&o.payment_status==='paid'&&o.number<9000),ex=S.expenses.filter(x=>x.expense_date===DAY()),a=paid.reduce((s,o)=>s+o.total_cents,0),b=ex.reduce((s,e)=>s+e.amount_cents,0);return `<div class="panel"><div class="panel-head"><h2>Receber encomendas pelo QR Code</h2><span class="status">${S.settings.orders_open?'ABERTO':'FECHADO'}</span></div><button data-do="toggle">${S.settings.orders_open?'Fechar atendimento':'Abrir atendimento'}</button><p class="muted">Pagamentos apenas no balcão. Abra somente quando a equipa estiver preparada.</p></div><div class="metrics"><div>Recebido hoje<b>${EUR(a)}</b></div><div>Despesas hoje<b>${EUR(b)}</b></div><div>Saldo hoje<b>${EUR(a-b)}</b></div><div>Pedidos pagos<b>${paid.length}</b></div></div>`;}
function productsPanel(){let p=product(S.editProduct);return `<div class="main-grid"><section class="panel"><div class="panel-head"><h2>Produtos e estoque</h2><button class="small" data-do="edit-product" data-id="">+ Novo</button></div>${S.products.map(x=>`<div class="item"><span class="emoji">${E(x.icon)}</span><div><b>${E(x.name)}</b><small>${x.category==='food'?'Alimento':'Bebida'} · ${x.price_cents===null?'Preço não definido':EUR(x.price_cents)} · Estoque: ${x.stock_qty??'ilimitado'}</small></div><button class="small ghost" data-do="edit-product" data-id="${x.id}">Editar</button></div>`).join('')}</section><section class="panel"><h2>${p?'Editar produto':'Novo produto'}</h2><form id="productForm" class="form-grid"><input type="hidden" name="id" value="${E(p?.id||'')}"><label>Nome<input name="name" required maxlength="60" value="${E(p?.name||'')}"></label><label>Tipo<select name="category"><option value="food" ${p?.category==='food'?'selected':''}>Alimento</option><option value="drink" ${p?.category==='drink'?'selected':''}>Bebida</option></select></label><label>Ícone<input name="icon" maxlength="6" value="${E(p?.icon||'🍽️')}"></label><label>Preço avulso em € (vazio = não vender avulso)<input type="number" step="0.01" min="0.01" name="price" value="${p?.price_cents==null?'':(p.price_cents/100).toFixed(2)}"></label><label>Estoque (vazio = ilimitado)<input type="number" min="0" step="1" name="stock" value="${p?.stock_qty??''}"></label><label>Ordem<input type="number" name="sort" value="${p?.sort_order??10}"></label><label>Estado<select name="active"><option value="true" ${p?.active!==false?'selected':''}>Ativo</option><option value="false" ${p?.active===false?'selected':''}>Oculto</option></select></label><button>Guardar produto</button></form></section></div>`;}
function combosPanel(){let c=combo(S.editCombo);return `<div class="main-grid"><section class="panel"><div class="panel-head"><h2>Combos cadastrados</h2><button class="small" data-do="edit-combo" data-id="">+ Novo</button></div>${S.combos.map(x=>`<div class="item"><span class="emoji">🥐</span><div><b>${E(x.name)}</b><small>${EUR(x.price_cents)} · ${x.active?'Ativo':'Oculto'} · Estoque: ${x.stock_qty??'ilimitado'}</small></div><button class="small ghost" data-do="edit-combo" data-id="${x.id}">Editar</button></div>`).join('')}</section><section class="panel"><h2>${c?'Editar combo':'Novo combo'}</h2><p class="muted">O combo permite escolher um alimento e uma bebida disponíveis.</p><form id="comboForm" class="form-grid"><input type="hidden" name="id" value="${E(c?.id||'')}"><label>Nome<input name="name" required maxlength="90" value="${E(c?.name||'')}"></label><label>Descrição<input name="description" maxlength="160" value="${E(c?.description||'Escolha 1 alimento e 1 bebida')}"></label><label>Preço em €<input type="number" step="0.01" min="0.01" name="price" required value="${c?(c.price_cents/100).toFixed(2):''}"></label><label>Estoque (vazio = ilimitado)<input type="number" min="0" name="stock" value="${c?.stock_qty??''}"></label><label>Ordem<input type="number" name="sort" value="${c?.sort_order??10}"></label><label>Estado<select name="active"><option value="true" ${c?.active!==false?'selected':''}>Ativo</option><option value="false" ${c?.active===false?'selected':''}>Oculto</option></select></label><button>Guardar combo</button></form></section></div>`;}
function financePanel(){const month=S.month||DAY().slice(0,7),paid=S.orders.filter(x=>x.order_day.startsWith(month)&&x.payment_status==='paid'&&x.number<9000),ex=S.expenses.filter(x=>x.expense_date.startsWith(month)),a=paid.reduce((n,x)=>n+x.total_cents,0),b=ex.reduce((n,x)=>n+x.amount_cents,0);return `<div class="panel"><div class="panel-head"><h2>Financeiro</h2><label>Mês <input id="month" type="month" value="${month}"></label></div><div class="metrics"><div>Receita confirmada<b>${EUR(a)}</b></div><div>Despesas<b>${EUR(b)}</b></div><div>Saldo<b>${EUR(a-b)}</b></div><div>Pedidos pagos<b>${paid.length}</b></div></div><p><button class="small ghost" data-do="csv">Exportar CSV</button></p><h3>Registar despesa</h3><form id="expenseForm" class="expense-row"><label>Data<input type="date" name="date" required value="${DAY()}"></label><label>Descrição<input name="description" required maxlength="180"></label><label>Categoria<select name="category"><option>Ingredientes</option><option>Embalagens</option><option>Equipamentos</option><option>Outros</option></select></label><label>Valor (€)<input type="number" name="amount" required min="0.01" step="0.01"></label><button>Adicionar</button></form>${ex.map(x=>`<div class="item"><div><b>${E(x.description)}</b><small>${E(x.expense_date)} · ${E(x.category)}</small></div><strong>${EUR(x.amount_cents)}</strong><button class="small ghost" data-do="delete-expense" data-id="${x.id}">Excluir</button></div>`).join('')||'<p class="muted">Sem despesas neste mês.</p>'}<p class="muted">Saldo é receita recebida menos despesas registadas. Não inclui impostos nem custos não lançados.</p></div>`;}
function qr(){let url=location.origin+location.pathname+'#/cliente',img='https://api.qrserver.com/v1/create-qr-code/?size=450x450&data='+encodeURIComponent(url);return `<div class="panel qr"><img src="${img}" alt="QR Code do Lagoinha Café"><div><h2>Faça o pedido pelo telemóvel</h2><p>Sem cadastro. Selecione, receba uma senha e pague no caixa.</p><small>${E(url)}</small><p><button data-do="print">Imprimir QR Code</button></p></div></div>`;}
function add(x){
  if(S.cart.reduce((total,row)=>total+row.qty,0)+x.qty>20)throw Error('O limite é de 20 artigos por pedido');
  const old=S.cart.find(row=>row.kind===x.kind&&row.id===x.id&&row.food_id===x.food_id&&row.drink_id===x.drink_id);
  if(old)old.qty+=x.qty;else S.cart.push(x);
  if(!cartAvailable()){
    if(old)old.qty-=x.qty;else S.cart.pop();
    throw Error('Este artigo já não está disponível nesta quantidade.');
  }
  paint();
}
function csv(){let month=S.month||DAY().slice(0,7);let lines=[['Tipo','Data','Descrição','Valor (€)'],...S.orders.filter(x=>x.order_day.startsWith(month)&&x.payment_status==='paid'&&x.number<9000).map(x=>['Receita',x.order_day,'Senha '+x.number,(x.total_cents/100).toFixed(2)]),...S.expenses.filter(x=>x.expense_date.startsWith(month)).map(x=>['Despesa',x.expense_date,x.description,(-x.amount_cents/100).toFixed(2)])];let data='\ufeff'+lines.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');let u=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='lagoinha-cafe-'+month+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),500);}
root.addEventListener('click',async e=>{let b=e.target.closest('[data-do]');if(!b||S.busy)return;const k=b.dataset.do,id=b.dataset.id;try{
if(k==='dismiss'){S.notice='';paint();return;}
if(k==='go-cart'){document.getElementById('cart')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
if(k==='choose-food'){S.food=id;paint();return;}
if(k==='choose-drink'){S.drink=id;paint();return;}
if(k==='combo-less'||k==='combo-more'){S.qty=Math.max(1,Math.min(20,S.qty+(k==='combo-more'?1:-1)));paint();return;}

if(k==='combo'){S.combo=id;paint();return;}
if(k==='add-unit'){let p=product(id);if(!valid(p)||p.price_cents==null)throw Error('Produto indisponível');add({kind:'unit',id:p.id,name:p.name,price:p.price_cents,qty:1});return;}
if(k==='add-combo'){let c=combo(S.combo),f=product(S.food),d=product(S.drink),n=Number(S.qty);if(!valid(c)||!valid(f)||!valid(d)||!Number.isInteger(n)||n<1||n>20)throw Error('Seleção inválida');add({kind:'combo',id:c.id,food_id:f.id,drink_id:d.id,name:c.name,detail:f.name+' + '+d.name,qty:n,price:c.price_cents});return;}
if(k==='plus'||k==='minus'){let i=Number(b.dataset.i),x=S.cart[i];if(!x)return;let count=S.cart.reduce((n,x)=>n+x.qty,0);if(k==='plus'&&count>=20)throw Error('Limite de 20 artigos');x.qty+=k==='plus'?1:-1;if(x.qty<1)S.cart.splice(i,1);if(!cartAvailable()){x.qty-=k==='plus'?1:-1;throw Error('Quantidade indisponível deste artigo.');}paint();return;}
if(k==='send'){if(!S.settings.orders_open)throw Error('Encomendas fechadas');if(!cartAvailable())throw Error('Um artigo já não está disponível. Atualize o pedido.');S.busy=true;let lines=S.cart.map(x=>x.kind==='unit'?{kind:'unit',product_id:x.id,quantity:x.qty}:{kind:'combo',combo_id:x.id,food_id:x.food_id,drink_id:x.drink_id,quantity:x.qty});let r=await api.rpc('create_cafe_order_v2',{p_lines:lines});if(r.error)throw r.error;S.cart=[];location.hash='#/pedido/'+r.data.token;await loadTicket();S.busy=false;paint();return;}
if(k==='refresh'){await sync();return;}
if(k==='logout'){await api.auth.signOut();S.user=null;S.role=null;location.hash='#/cliente';paint();return;}
if(k==='order'){let a=b.dataset.act;if(a==='paid'&&!confirm(S.orders.find(o=>o.id===id)?.number>=9000?'Simular a confirmação de pagamento deste pedido de TESTE? Não receba dinheiro.':'Confirmar que recebeu o pagamento presencial?'))return;if(a==='cancel'&&!confirm('Cancelar pedido não pago e devolver os itens ao estoque?'))return;let r=await api.rpc('staff_order_action',{p_order_id:id,p_action:a});if(r.error)throw r.error;await Promise.all([loadOrders(),loadCatalog()]);paint();return;}
if(k==='tab'){S.tab=b.dataset.tab;paint();return;}
if(k==='edit-product'){S.editProduct=id||null;paint();return;}
if(k==='edit-combo'){S.editCombo=id||null;paint();return;}
if(k==='toggle'){if(!S.settings.orders_open&&!confirm('Abrir pedidos reais para os clientes?'))return;let r=await api.from('cafe_settings').update({orders_open:!S.settings.orders_open}).eq('id',1);if(r.error)throw r.error;await loadCatalog();paint();return;}
if(k==='delete-expense'){if(!confirm('Excluir despesa?'))return;let r=await api.from('cafe_expenses').delete().eq('id',id);if(r.error)throw r.error;await loadOrders();paint();return;}
if(k==='csv'){csv();return;}if(k==='print'){window.print();return;}
}catch(ex){S.busy=false;S.notice='Erro: '+ex.message;paint();}});
root.addEventListener('change',e=>{let t=e.target;if(t.id==='food')S.food=t.value;if(t.id==='drink')S.drink=t.value;if(t.id==='qty')S.qty=Math.max(1,Math.min(20,Number(t.value)||1));if(t.id==='month'){S.month=t.value;paint();}});
root.addEventListener('submit',e=>{e.preventDefault();let f=e.target,d=new FormData(f);(async()=>{S.busy=true;
if(f.id==='login'){let r=await api.auth.signInWithPassword({email:String(d.get('email')),password:String(d.get('password'))});if(r.error)throw r.error;await auth();if(!S.role)throw Error('Conta sem autorização de equipa');await loadOrders();}
if(f.id==='productForm'){let price=String(d.get('price')).trim(),stock=String(d.get('stock')).trim(),data={name:String(d.get('name')).trim(),category:String(d.get('category')),icon:String(d.get('icon')).trim()||'🍽️',price_cents:price===''?null:Math.round(Number(price)*100),stock_qty:stock===''?null:Number(stock),sort_order:Number(d.get('sort'))||0,active:d.get('active')==='true'};if((data.price_cents!==null&&data.price_cents<1)||(data.stock_qty!==null&&(!Number.isInteger(data.stock_qty)||data.stock_qty<0)))throw Error('Preço ou estoque inválido');let id=String(d.get('id')),r=await (id?api.from('products').update(data).eq('id',id):api.from('products').insert(data));if(r.error)throw r.error;S.editProduct=null;await loadCatalog();}
if(f.id==='comboForm'){let stock=String(d.get('stock')).trim(),data={name:String(d.get('name')).trim(),description:String(d.get('description')).trim(),price_cents:Math.round(Number(d.get('price'))*100),stock_qty:stock===''?null:Number(stock),sort_order:Number(d.get('sort'))||0,active:d.get('active')==='true'};if(data.price_cents<1||(data.stock_qty!==null&&(!Number.isInteger(data.stock_qty)||data.stock_qty<0)))throw Error('Preço ou estoque inválido');let id=String(d.get('id')),r=await(id?api.from('cafe_combos').update(data).eq('id',id):api.from('cafe_combos').insert(data));if(r.error)throw r.error;S.editCombo=null;await loadCatalog();}
if(f.id==='expenseForm'){let cents=Math.round(Number(d.get('amount'))*100);if(cents<1)throw Error('Valor inválido');let r=await api.from('cafe_expenses').insert({expense_date:d.get('date'),description:String(d.get('description')).trim(),category:String(d.get('category')),amount_cents:cents,created_by:S.user.id});if(r.error)throw r.error;await loadOrders();}
})().then(()=>{S.notice='Registo guardado com sucesso.';S.busy=false;paint();}).catch(ex=>{S.notice='Erro: '+ex.message;S.busy=false;paint();});});
async function sync(){try{let r=route();if(r==='cliente')await loadCatalog();else if(r==='pedido')await loadTicket();else if(r==='retirada')await loadReady();else if(['caixa','cozinha','admin'].includes(r)&&S.role)await loadOrders();paint();}catch(e){S.notice=e.message;paint();}}
window.addEventListener('hashchange',sync);
setInterval(()=>{if(!document.hidden&&!S.busy&&['caixa','cozinha','retirada','pedido','cliente'].includes(route()))sync();},12500);
(async()=>{try{let m=await import('https://esm.sh/@supabase/supabase-js@2.95.0');api=m.createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});await Promise.all([loadCatalog(),auth()]);if(['caixa','cozinha','admin'].includes(route())&&S.role)await loadOrders();if(route()==='pedido')await loadTicket();if(route()==='retirada')await loadReady();paint();if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}catch(e){root.innerHTML='<main class="wrap"><h1>Falha ao carregar o sistema</h1><p>'+E(e.message)+'</p></main>';}})();
