
const $ = (s, el=document) => el.querySelector(s);
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const state={page:'Inicio',cats:[],products:[],tables:[],orders:[],cart:[],cat:'Todos',type:'mesa',table:'',q:'',cash:null,settings:{business_name:'Taquería Los Amigos',subtitle:'Nuestro Menú'}};

function icon(name){const m={Inicio:'▦',Comandero:'🍽',Pedidos:'▤',Mesas:'▦',Caja:'▣',Productos:'▧','Menú':'☰',Ventas:'↻','Configuración':'⚙'};return m[name]||'•'}
function toast(msg){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2600)}
async function load(){
  try{
    const [a,b,c,d,e,f]=await Promise.all([
      db.from('categories').select('*').order('sort_order'),
      db.from('products').select('*').order('sort_order'),
      db.from('dining_tables').select('*').order('name'),
      db.from('orders').select('*,order_items(*),payments(*)').order('created_at',{ascending:false}).limit(500),
      db.from('cash_sessions').select('*').eq('status','abierta').maybeSingle(),
      db.from('menu_settings').select('*').eq('id',1).single()
    ]);
    state.cats=a.data||[]; state.products=b.data||[]; state.tables=c.data||[]; state.orders=d.data||[];
    state.cash=e.data||null; if(f.data) state.settings=f.data;
    render();
  }catch(e){console.error(e);$('#app').innerHTML=`<main><section><h2>No se pudo cargar el sistema</h2><p>${esc(e.message)}</p></section></main>`}
}
function shell(content){
 const nav=['Inicio','Comandero','Pedidos','Mesas','Caja','Productos','Menú','Ventas','Configuración'];
 return `<div class="app"><nav><div class="brand"><div>🌮</div><span><b>LOS AMIGOS</b><small>Taquería · POS</small></span></div>
 ${nav.map(n=>`<button data-nav="${n}" class="${state.page===n?'active':''}"><span>${icon(n)}</span>${n}</button>`).join('')}</nav>
 <main>${content}</main></div>`;
}
function card(t,v){return `<div class="card"><small>${t}</small><strong>${v}</strong></div>`}
function todays(){return state.orders.filter(o=>o.created_at?.slice(0,10)===today()&&o.status!=='cancelado')}
function paid(){return todays().filter(o=>o.status==='pagado')}
function sales(){return paid().reduce((s,o)=>s+Number(o.total),0)}
function ordersTable(data){
 return `<div class="tablewrap"><table><thead><tr><th>Folio</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody>
 ${data.map(o=>`<tr><td><b>#${o.folio}</b></td><td>${esc(o.order_type)}</td><td>${(o.order_items||[]).map(i=>`${i.quantity}× ${esc(i.product_name)}`).join(', ')}</td><td><span class="badge">${esc(o.status)}</span></td><td><b>${money(o.total)}</b></td><td class="actions">${o.status!=='pagado'?`<select data-status="${o.id}">${['pendiente','preparando','listo','en_camino','entregado','cancelado'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select><button class="primary" data-pay="${o.id}">Cobrar</button>`:''}</td></tr>`).join('')}
 </tbody></table></div>`;
}
function dashboard(){
 const p=paid(), s=sales();
 return `<h1>Resumen del día</h1><div class="cards">${card('Venta total',money(s))}${card('Pedidos',todays().length)}${card('Ticket promedio',money(p.length?s/p.length:0))}${card('Caja',state.cash?'Abierta':'Cerrada')}</div>
 <section><h2>Ventas por tipo</h2><div class="split">${['mesa','llevar','domicilio'].map(t=>`<div class="metric"><b>${t.toUpperCase()}</b><span>${money(p.filter(o=>o.order_type===t).reduce((a,o)=>a+Number(o.total),0))}</span></div>`).join('')}</div></section>
 <section><h2>Últimos pedidos</h2>${ordersTable(todays().slice(0,8))}</section>`;
}
function comandero(){
 const filtered=state.products.filter(p=>p.active&&(state.cat==='Todos'||state.cats.find(c=>c.id===p.category_id)?.name===state.cat)&&p.name.toLowerCase().includes(state.q.toLowerCase()));
 const total=state.cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
 return `<div class="pos"><div><h1>Nueva comanda</h1><div class="seg">${['mesa','llevar','domicilio'].map(x=>`<button data-type="${x}" class="${state.type===x?'on':''}">${x}</button>`).join('')}</div>
 ${state.type==='mesa'?`<select id="tableSelect"><option value="">Seleccionar mesa</option>${state.tables.map(t=>`<option value="${t.id}" ${state.table===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}
 <div class="search"><span>⌕</span><input id="searchProduct" placeholder="Buscar producto" value="${esc(state.q)}"></div>
 <div class="chips"><button data-cat="Todos" class="${state.cat==='Todos'?'active':''}">Todos</button>${state.cats.map(c=>`<button data-cat="${esc(c.name)}" class="${state.cat===c.name?'active':''}">${esc(c.name)}</button>`).join('')}</div>
 <div class="grid">${filtered.map(p=>`<button ${p.sold_out?'disabled':''} class="product" data-product="${p.id}"><b>${esc(p.name)}</b><small>${p.sold_out?'AGOTADO':esc(state.cats.find(c=>c.id===p.category_id)?.name||'')}</small><strong>${money(p.price)}</strong></button>`).join('')}</div></div>
 <aside class="cart"><h2>Comanda</h2>${!state.cart.length?'<p class="muted">Selecciona productos para comenzar.</p>':''}${state.cart.map(x=>`<div class="cartrow"><div><b>${esc(x.name)}</b><small>${money(x.price)} c/u</small></div><div class="qty"><button data-minus="${x.id}">−</button><b>${x.qty}</b><button data-plus="${x.id}">+</button><button data-remove="${x.id}">×</button></div></div>`).join('')}<div class="total"><span>Total</span><b>${money(total)}</b></div><button class="primary wide" id="saveOrder">Enviar comanda</button></aside></div>`;
}
function mesas(){
 return `<h1>Mesas</h1><div class="tables">${state.tables.map(t=>{const o=state.orders.find(o=>o.table_id===t.id&&!['pagado','cancelado','entregado'].includes(o.status));return `<div class="tablecard ${o?'busy':'free'}"><span>▦</span><b>${esc(t.name)}</b><span>${o?money(o.total):'Disponible'}</span>${o?`<small>#${o.folio} · ${esc(o.status)}</small>`:''}</div>`}).join('')}</div>`;
}
function products(){
 return `<div class="titlebar"><h1>Catálogo de productos</h1><button class="primary" id="newProduct">＋ Nuevo producto</button></div><section class="tablewrap"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>${state.products.map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.description||'')}</small></td><td>${esc(state.cats.find(c=>c.id===p.category_id)?.name||'—')}</td><td>${money(p.price)}</td><td><span class="badge ${p.sold_out?'red':'green'}">${p.sold_out?'Agotado':'Disponible'}</span></td><td><button data-sold="${p.id}">${p.sold_out?'Activar':'Marcar agotado'}</button></td></tr>`).join('')}</tbody></table></section>`;
}
function menu(){
 return `<div class="titlebar"><h1>Menú para compartir</h1><button class="primary" id="pdfMenu">▣ Generar PDF</button></div><section class="menu"><h2>${esc(state.settings.business_name)}</h2><p>${esc(state.settings.subtitle||'')}</p>${state.cats.map(c=>{const ps=state.products.filter(p=>p.category_id===c.id&&p.show_on_menu&&p.active);return ps.length?`<div><h3>${esc(c.name)}</h3>${ps.map(p=>`<div class="menurow"><div><b>${esc(p.name)}</b>${state.settings.show_descriptions?`<small>${esc(p.description||'')}</small>`:''}</div><strong>${money(p.price)}</strong></div>`).join('')}</div>`:''}).join('')}</section>`;
}
function cash(){
 const p=paid(), ef=p.flatMap(o=>o.payments||[]).filter(x=>x.method==='efectivo').reduce((s,x)=>s+Number(x.amount),0);
 return `<h1>Caja</h1><div class="cards">${card('Estado',state.cash?'Caja abierta':'Caja cerrada')}${card('Ventas efectivo',money(ef))}${card('Venta total hoy',money(sales()))}</div><section>${state.cash?`<h2>Sesión actual</h2><p>Fondo inicial: <b>${money(state.cash.opening_amount)}</b></p><button class="danger" id="closeCash">Cerrar caja</button>`:`<button class="primary" id="openCash">Abrir caja</button>`}</section>`;
}
function salesHistory(){
 return `<h1>Histórico de ventas</h1><section class="tablewrap"><table><thead><tr><th>Fecha</th><th>Folio</th><th>Tipo</th><th>Estado</th><th>Total</th></tr></thead><tbody>${state.orders.map(o=>`<tr><td>${new Date(o.created_at).toLocaleString('es-MX')}</td><td>#${o.folio}</td><td>${esc(o.order_type)}</td><td><span class="badge">${esc(o.status)}</span></td><td><b>${money(o.total)}</b></td></tr>`).join('')}</tbody></table></section>`;
}
function config(){
 return `<h1>Configuración</h1><section><label>Nombre del negocio<input id="businessName" value="${esc(state.settings.business_name)}"></label><label>Subtítulo del menú<input id="subtitle" value="${esc(state.settings.subtitle||'')}"></label><button class="primary" id="saveSettings">Guardar configuración</button></section>`;
}
function render(){
 let content=state.page==='Inicio'?dashboard():state.page==='Comandero'?comandero():state.page==='Pedidos'?`<h1>Pedidos</h1><section>${ordersTable(state.orders.filter(o=>!['pagado','cancelado'].includes(o.status)))}</section>`:state.page==='Mesas'?mesas():state.page==='Caja'?cash():state.page==='Productos'?products():state.page==='Menú'?menu():state.page==='Ventas'?salesHistory():config();
 $('#app').innerHTML=shell(content); bind();
}
function bind(){
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{state.page=b.dataset.nav;render()});
 document.querySelectorAll('[data-type]').forEach(b=>b.onclick=()=>{state.type=b.dataset.type;render()});
 document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{state.cat=b.dataset.cat;render()});
 const ts=$('#tableSelect'); if(ts)ts.onchange=e=>state.table=e.target.value;
 const sp=$('#searchProduct'); if(sp)sp.oninput=e=>{state.q=e.target.value;const pos=e.target.selectionStart;render();const n=$('#searchProduct');if(n){n.focus();n.setSelectionRange(pos,pos)}};
 document.querySelectorAll('[data-product]').forEach(b=>b.onclick=()=>addProduct(b.dataset.product));
 document.querySelectorAll('[data-plus]').forEach(b=>b.onclick=()=>addProduct(b.dataset.plus));
 document.querySelectorAll('[data-minus]').forEach(b=>b.onclick=()=>{const x=state.cart.find(i=>i.id===b.dataset.minus);if(x)x.qty=Math.max(1,x.qty-1);render()});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{state.cart=state.cart.filter(i=>i.id!==b.dataset.remove);render()});
 document.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>pay(b.dataset.pay));
 document.querySelectorAll('[data-status]').forEach(s=>s.onchange=()=>setStatus(s.dataset.status,s.value));
 document.querySelectorAll('[data-sold]').forEach(b=>b.onclick=()=>toggleSold(b.dataset.sold));
 if($('#saveOrder'))$('#saveOrder').onclick=saveOrder;
 if($('#newProduct'))$('#newProduct').onclick=newProduct;
 if($('#openCash'))$('#openCash').onclick=openCash;
 if($('#closeCash'))$('#closeCash').onclick=closeCash;
 if($('#pdfMenu'))$('#pdfMenu').onclick=pdfMenu;
 if($('#saveSettings'))$('#saveSettings').onclick=saveSettings;
}
function addProduct(id){const p=state.products.find(x=>x.id===id);if(!p)return;const x=state.cart.find(i=>i.id===id);if(x)x.qty++;else state.cart.push({...p,qty:1,notes:''});render()}
async function saveOrder(){
 if(!state.cart.length)return toast('Agrega productos');
 if(state.type==='mesa'&&!state.table)return toast('Selecciona una mesa');
 let customer_id=null;
 if(state.type==='domicilio'){
   const name=prompt('Nombre del cliente');if(!name)return;
   const phone=prompt('Teléfono')||'',address=prompt('Dirección')||'';
   const c=await db.from('customers').insert({name,phone,address}).select().single();
   if(c.error)return toast(c.error.message);customer_id=c.data.id;
 }
 const total=state.cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
 const o=await db.from('orders').insert({order_type:state.type,table_id:state.type==='mesa'?state.table:null,customer_id,status:'pendiente',subtotal:total,total}).select().single();
 if(o.error)return toast(o.error.message);
 const r=await db.from('order_items').insert(state.cart.map(x=>({order_id:o.data.id,product_id:x.id,product_name:x.name,quantity:x.qty,unit_price:x.price,line_total:Number(x.price)*x.qty,notes:x.notes||''})));
 if(r.error)return toast(r.error.message);
 state.cart=[];state.table='';toast('Comanda creada');await load();
}
async function pay(id){const o=state.orders.find(x=>x.id===id);if(!o)return;const method=prompt('Método: efectivo, tarjeta, transferencia u otro','efectivo');if(!method)return;let r=await db.from('payments').insert({order_id:o.id,method,amount:o.total});if(r.error)return toast(r.error.message);await db.from('orders').update({status:'pagado',updated_at:new Date().toISOString()}).eq('id',o.id);toast('Venta cobrada');load()}
async function setStatus(id,status){await db.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);load()}
async function newProduct(){const name=prompt('Nombre del producto');if(!name)return;const price=Number(prompt('Precio','0'));const r=await db.from('products').insert({name,price,category_id:state.cats[0]?.id||null});if(r.error)return toast(r.error.message);toast('Producto creado');load()}
async function toggleSold(id){const p=state.products.find(x=>x.id===id);if(!p)return;await db.from('products').update({sold_out:!p.sold_out}).eq('id',id);load()}
async function openCash(){const n=Number(prompt('Fondo inicial','0'));const r=await db.from('cash_sessions').insert({opening_amount:n}).select().single();if(r.error)return toast(r.error.message);state.cash=r.data;toast('Caja abierta');render()}
async function closeCash(){const n=Number(prompt('Efectivo contado','0'));const r=await db.from('cash_sessions').update({status:'cerrada',closed_at:new Date().toISOString(),closing_counted:n}).eq('id',state.cash.id);if(r.error)return toast(r.error.message);state.cash=null;toast('Caja cerrada');render()}
async function saveSettings(){const business_name=$('#businessName').value.trim(),subtitle=$('#subtitle').value.trim();const r=await db.from('menu_settings').update({business_name,subtitle,updated_at:new Date().toISOString()}).eq('id',1);if(r.error)return toast(r.error.message);state.settings={...state.settings,business_name,subtitle};toast('Configuración guardada');render()}
function pdfMenu(){const {jsPDF}=window.jspdf;const d=new jsPDF();d.setFontSize(22);d.text(state.settings.business_name,105,20,{align:'center'});d.setFontSize(12);d.text(state.settings.subtitle||'Nuestro Menú',105,28,{align:'center'});let y=40;state.cats.forEach(c=>{const ps=state.products.filter(p=>p.category_id===c.id&&p.show_on_menu&&p.active);if(!ps.length)return;if(y>260){d.addPage();y=20}d.setFontSize(16);d.text(c.name,15,y);y+=8;ps.forEach(p=>{d.setFontSize(11);d.text(p.name,18,y);d.text(money(p.price),190,y,{align:'right'});y+=8})});d.save('menu-taqueria-los-amigos.pdf')}

load();
