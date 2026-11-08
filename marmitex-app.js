import {CONFIG} from './config.js';
import * as MX from './marmitex.js?v=5.6';

const root=document.querySelector('#marmitex-root');
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>location.hash.split('/')[1]||'marmitex';
let api=null,role=null,user=null,notice='',busy=false,loginEmail='';
const staffRoute=r=>r==='marmitex-caixa'||r==='marmitex-admin';
const permitted=r=>r==='marmitex-caixa'?['admin','cashier'].includes(role):r==='marmitex-admin'?role==='admin':true;
const login=r=>'<div class="mx-login-panel"><span class="mx-eyebrow">ACESSO RESTRITO</span><h1>'+(r==='marmitex-admin'?'Administração':'Caixa')+'</h1><p>Entre com a conta autorizada da equipa para gerir as encomendas.</p>'+
 (user?'<p>A conta '+safe(user.email)+' não tem permissão para esta área.</p><button type="button" data-op="logout" class="mx-logout">Sair da conta</button>':
 '<form id="mx-login"><label class="mx-field">Email<input type="email" name="email" autocomplete="username" required value="'+safe(loginEmail)+'"></label><label class="mx-field">Palavra-passe<input type="password" name="password" autocomplete="current-password" required></label><button class="mx-primary" type="submit">Entrar</button></form>')+
 '</div>';
function paint(){
 const r=route();
 const main=staffRoute(r)&&!permitted(r)?login(r):MX.mxRender(r,role);
 const caixaNav=staffRoute(r)&&['admin','cashier'].includes(role)?'<a href="#/marmitex-caixa" '+(r==='marmitex-caixa'?'aria-current="page"':'')+'>Caixa</a>':'';
 const cashierSections=r==='marmitex-caixa'&&permitted(r)?'<nav class="cashier-area-switch" aria-label="Escolher caixa"><a class="cashier-area-link" href="./#/caixa"><span aria-hidden="true">☕</span><span><strong>Caixa do Café</strong><small>Pedidos e pagamentos do café</small></span></a><a class="cashier-area-link is-active" href="#/marmitex-caixa" aria-current="page"><span aria-hidden="true">🍱</span><span><strong>Encomendas de Marmitex</strong><small>Lista, pagamentos e retiradas</small></span></a></nav>':'';
 root.innerHTML='<header class="mxt-header"><div class="mxt-header-inner"><a class="mxt-brand" href="#/marmitex" aria-label="Marmitex Lagoinha Café"><img class="mxt-header-logo" src="./assets/logo-lagoinha-cafe-header.svg?v=4.7" width="112" height="112" decoding="async" alt="Lagoinha Café"><span class="mxt-brand-words mxt-subbrand"><em>MARMITEX</em></span></a>'+
 '<nav class="mxt-nav" aria-label="Acessos"><a href="#/marmitex" '+(r==='marmitex'||r==='marmitex-pedido'?'aria-current="page"':'')+'>Encomendar</a>'+caixaNav+'</nav></div></header>'+
 '<main class="mxt-main">'+cashierSections+(notice?'<p role="alert" class="mx-notice">'+safe(notice)+'</p>':'')+main+'</main>'+
 '<footer class="mxt-footer"><strong>Lagoinha Café · Marmitex</strong><span>Encomendas antecipadas · Retirada no domingo</span>'+
 (user?'<button type="button" data-op="logout">Sair da conta</button>':'')+'</footer>';
 document.title=(r==='marmitex-caixa'?'Caixa · ':r==='marmitex-admin'?'Administração · ':r==='marmitex-pedido'?'Comprovativo · ':'Encomendas · ')+'Marmitex Lagoinha Café';
}
async function fetchAuth(){
 const {data,error}=await api.auth.getUser();
 user=data?.user||null;role=null;
 if(user){
  const res=await api.from('staff_roles').select('role').eq('user_id',user.id).maybeSingle();
  if(res.error)throw res.error;role=res.data?.role||null;
 }else if(error&&route()!=='marmitex'){role=null;}
}
async function refresh(){
 if(!api)return;
 const r=route();
 if(r==='marmitex-cozinha'){
  location.replace('./marmitex.html#/marmitex-caixa');return;
 }
 if(!['marmitex','marmitex-pedido','marmitex-caixa','marmitex-admin'].includes(r)){
  location.hash='#/marmitex';return;
 }
 notice='';
 try{
  if(!staffRoute(r)||permitted(r))await MX.mxLoad(api,r);
 }catch(e){notice='Não foi possível carregar as encomendas: '+(e?.message||e);}
 paint();
}
root.addEventListener('click',async e=>{
 const op=e.target.closest('[data-op]');if(op?.dataset.op==='logout'){
  if(!api||busy)return;
  busy=true;try{await api.auth.signOut();user=null;role=null;location.hash='#/marmitex';await refresh();}
  finally{busy=false;}return;
 }
 const b=e.target.closest('[data-do="mx"]');if(!b||!api||MX.mxBusy()||busy)return;
 try{await MX.mxAction(api,b,route(),role);notice='';}catch(e){MX.mxSetError(e.message||e);}
 paint();
});
root.addEventListener('change',e=>{if(MX.mxChange(e.target))paint();});
root.addEventListener('submit',async e=>{
 const f=e.target;if(!f?.id)return;
 e.preventDefault();if(busy||!api||MX.mxBusy())return;
 if(f.id==='mx-login'){
  const d=new FormData(f);loginEmail=String(d.get('email')||'').trim();busy=true;
  try{
   const {error}=await api.auth.signInWithPassword({email:loginEmail,password:String(d.get('password')||'')});
   if(error)throw Error(error.message.includes('Invalid login credentials')?'Email ou palavra-passe incorretos.':error.message);
   await fetchAuth();if(!permitted(route()))throw Error('A conta não tem acesso ao Caixa das marmitex');
   loginEmail='';await refresh();
  }catch(err){notice=err.message||String(err);paint();}
  finally{busy=false;}
  return;
 }
 if(!['mx-order-form','mx-week-form','mx-item-form'].includes(f.id))return;
 try{await MX.mxSubmit(api,f,route(),role);notice='';}
 catch(err){MX.mxSetError(err.message||String(err));}
 paint();
});
window.addEventListener('hashchange',()=>refresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy&&['marmitex-pedido','marmitex-caixa'].includes(route()))refresh();});
setInterval(()=>{
 if(document.hidden||busy||MX.mxBusy()||root.querySelector('#mx-login')||root.querySelector('#mx-order-form')||root.querySelector('#mx-week-form')||root.querySelector('#mx-item-form'))return;
 if(['marmitex-pedido','marmitex-caixa'].includes(route()))refresh();
},12000);
(async()=>{
 try{
  const m=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  api=m.createClient(CONFIG.supabaseUrl,CONFIG.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
  await fetchAuth();await refresh();
 }catch(e){
  notice='Falha ao carregar o sistema de encomendas: '+(e.message||e);
  paint();
 }
})();
