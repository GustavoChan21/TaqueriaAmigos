
const $ = (s, el=document) => el.querySelector(s);
const money=n=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(Number(n||0));
const today=()=>new Date().toISOString().slice(0,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const state={page:'Inicio',cats:[],products:[],tables:[],orders:[],credits:[],cart:[],cat:'Todos',type:'mesa',table:'',q:'',cash:null,settings:{business_name:'Taquería Los Amigos',subtitle:'Nuestro Menú',phone:'',address:'',tax_id:'',email:'',footer_text:'Gracias por tu preferencia',logo_url:'',watermark_url:'',social_text:''}};

function icon(name){const m={Inicio:'▦',Comandero:'🍽',Pedidos:'▤',Mesas:'▦',Caja:'▣',Fiado:'◷',Productos:'▧','Menú':'☰',Ventas:'↻','Configuración':'⚙'};return m[name]||'•'}
function toast(msg){let t=$('.toast');if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.style.display='block';setTimeout(()=>t.style.display='none',2600)}
async function load(){
  try{
    const [a,b,c,d,e,f,g]=await Promise.all([
      db.from('categories').select('*').order('sort_order'),
      db.from('products').select('*').order('sort_order'),
      db.from('dining_tables').select('*').order('name'),
      db.from('orders').select('*,order_items(*),payments(*)').order('created_at',{ascending:false}).limit(500),
      db.from('cash_sessions').select('*').eq('status','abierta').maybeSingle(),
      db.from('menu_settings').select('*').eq('id',1).single(), db.from('credit_accounts').select('*,customers(*),orders(folio,total),credit_payments(*)').order('created_at',{ascending:false})
    ]);
    state.cats=a.data||[]; state.products=b.data||[]; state.tables=c.data||[]; state.orders=d.data||[];
    state.cash=e.data||null; if(f.data) state.settings={...state.settings,...f.data}; state.credits=g.data||[];
    render();
  }catch(e){console.error(e);$('#app').innerHTML=`<main><section><h2>No se pudo cargar el sistema</h2><p>${esc(e.message)}</p></section></main>`}
}
function shell(content){
 const nav=['Inicio','Comandero','Pedidos','Mesas','Caja','Fiado','Productos','Menú','Ventas','Configuración'];
 return `<div class="app contracted">
 <aside class="sidebar" id="sidebar"><div class="sidebrand"><div class="brandmark">🌮</div><div class="brandcopy"><b>LOS AMIGOS</b><small>Taquería · POS</small></div><button class="collapsebtn" id="collapseSide" title="Contraer menú">‹</button></div>
 <div class="sidenav">${nav.map(n=>`<button data-nav="${n}" class="${state.page===n?'active':''}" title="${n}"><span class="navicon">${icon(n)}</span><span class="navlabel">${n}</span></button>`).join('')}</div>
 <div class="sidefoot"><span class="statusdot"></span><span class="navlabel">Sistema conectado</span></div></aside>
 <div class="mobiletop"><button id="mobileMenu">☰</button><b>LOS AMIGOS</b><span>${icon(state.page)}</span></div><div class="sideoverlay" id="sideoverlay"></div>
 <main>${content}</main></div>`;
}
function card(t,v){return `<div class="card"><small>${t}</small><strong>${v}</strong></div>`}
function todays(){return state.orders.filter(o=>o.created_at?.slice(0,10)===today()&&o.status!=='cancelado')}
function paid(){return todays().filter(o=>o.status==='pagado')}
function sales(){return paid().reduce((s,o)=>s+Number(o.total),0)}
function ordersTable(data){
 return `<div class="tablewrap"><table><thead><tr><th>Folio</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody>
 ${data.map(o=>`<tr><td><b>#${o.folio}</b></td><td>${esc(o.order_type)}</td><td>${(o.order_items||[]).map(i=>`${i.quantity}× ${esc(i.product_name)}`).join(', ')}</td><td><span class="badge">${esc(o.status)}</span></td><td><b>${money(o.total)}</b></td><td><div class="orderactions"><button data-editorder="${o.id}">Editar</button>${o.status!=='pagado'?`<button class="primary" data-pay="${o.id}">Cobrar</button>`:''}<button class="dangerghost" data-deleteorder="${o.id}">Eliminar</button></div></td></tr>`).join('')}
 </tbody></table></div>`;
}
function openEditOrder(id){
 const o=state.orders.find(x=>x.id===id);if(!o)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><form class="modal editordermodal" id="editOrderForm"><div class="modalhead"><div><small>PEDIDO #${o.folio}</small><h2>Editar comanda</h2><p>Corrige los datos capturados por error.</p></div><button type="button" class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><div class="fieldgrid"><label>Tipo de servicio<select id="editOrderType"><option value="mesa" ${o.order_type==='mesa'?'selected':''}>Mesa</option><option value="llevar" ${o.order_type==='llevar'?'selected':''}>Para llevar</option><option value="domicilio" ${o.order_type==='domicilio'?'selected':''}>Domicilio</option></select></label><label>Estado<select id="editOrderStatus">${['pendiente','preparando','listo','en_camino','entregado','pagado','cancelado'].map(x=>`<option value="${x}" ${o.status===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Mesa<select id="editOrderTable"><option value="">Sin mesa</option>${state.tables.filter(t=>t.active!==false).map(t=>`<option value="${t.id}" ${o.table_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>${field('Notas','editOrderNotes',o.notes||'')}</div><h3>Productos</h3><div class="edititems">${(o.order_items||[]).map(i=>`<div class="edititem" data-itemrow="${i.id}"><div><b>${esc(i.product_name)}</b><small>${money(i.unit_price)} c/u</small></div><input type="number" min="1" value="${i.quantity}" data-itemqty="${i.id}"><button type="button" class="dangerghost" data-removeitem="${i.id}">Quitar</button></div>`).join('')}</div><p class="hint">El total se recalculará con las cantidades actuales.</p></div><div class="modalfoot"><button type="button" id="cancelEditOrder">Cancelar</button><button class="primary" type="submit">Guardar cambios</button></div></form></div>`);
 $('#modalClose').onclick=$('#cancelEditOrder').onclick=closeModal;
 document.querySelectorAll('[data-removeitem]').forEach(b=>b.onclick=()=>{const row=document.querySelector(`[data-itemrow="${b.dataset.removeitem}"]`);row.dataset.removed='1';row.style.display='none'});
 $('#editOrderForm').onsubmit=e=>{e.preventDefault();saveOrderEdit(o)};
}
async function saveOrderEdit(o){
 try{
  let total=0;
  for(const i of (o.order_items||[])){
   const row=document.querySelector(`[data-itemrow="${i.id}"]`);
   if(row?.dataset.removed==='1'){const r=await db.from('order_items').delete().eq('id',i.id);if(r.error)throw r.error;continue}
   const qty=Math.max(1,Number(document.querySelector(`[data-itemqty="${i.id}"]`)?.value||i.quantity));
   total+=qty*Number(i.unit_price);
   if(qty!==Number(i.quantity)){const r=await db.from('order_items').update({quantity:qty,line_total:qty*Number(i.unit_price)}).eq('id',i.id);if(r.error)throw r.error}
  }
  if(total<=0)throw new Error('La comanda debe conservar al menos un producto.');
  const payload={order_type:$('#editOrderType').value,status:$('#editOrderStatus').value,table_id:$('#editOrderTable').value||null,notes:$('#editOrderNotes').value.trim(),subtotal:total,total,updated_at:new Date().toISOString()};
  const r=await db.from('orders').update(payload).eq('id',o.id);if(r.error)throw r.error;
  closeModal();toast('Comanda actualizada');load();
 }catch(e){toast(e.message)}
}
function confirmDeleteOrder(id){
 const o=state.orders.find(x=>x.id===id);if(!o)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><div class="modal confirmmodal"><div class="modalhead"><div><small>ELIMINAR PEDIDO</small><h2>Pedido #${o.folio}</h2></div><button class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><p>Esta acción elimina la comanda creada por error y sus registros relacionados.</p><div class="warningbox"><b>${money(o.total)}</b><span>${esc(o.order_type)} · ${esc(o.status)}</span></div></div><div class="modalfoot"><button id="cancelDeleteOrder">Cancelar</button><button class="danger" id="doDeleteOrder">Eliminar pedido</button></div></div></div>`);
 $('#modalClose').onclick=$('#cancelDeleteOrder').onclick=closeModal;$('#doDeleteOrder').onclick=()=>deleteOrder(o);
}
async function deleteOrder(o){
 try{
   const cr=state.credits.find(c=>c.order_id===o.id);
   if(cr){let r=await db.from('credit_payments').delete().eq('credit_account_id',cr.id);if(r.error)throw r.error;r=await db.from('credit_accounts').delete().eq('id',cr.id);if(r.error)throw r.error}
   let r=await db.from('payments').delete().eq('order_id',o.id);if(r.error)throw r.error;
   r=await db.from('order_items').delete().eq('order_id',o.id);if(r.error)throw r.error;
   r=await db.from('orders').delete().eq('id',o.id);if(r.error)throw r.error;
   closeModal();toast('Pedido eliminado');load();
 }catch(e){toast(e.message)}
}
function dashboard(){
 const p=paid(), s=sales();
 return `<h1>Resumen del día</h1><div class="cards">${card('Venta total',money(s))}${card('Pedidos',todays().length)}${card('Ticket promedio',money(p.length?s/p.length:0))}${card('Fiado pendiente',money(state.credits.reduce((a,c)=>a+Number(c.balance||0),0)))}</div>
 <section><h2>Ventas por tipo</h2><div class="split">${['mesa','llevar','domicilio'].map(t=>`<div class="metric"><b>${t.toUpperCase()}</b><span>${money(p.filter(o=>o.order_type===t).reduce((a,o)=>a+Number(o.total),0))}</span></div>`).join('')}</div></section>
 <section><h2>Últimos pedidos</h2>${ordersTable(todays().slice(0,8))}</section>`;
}
function comandero(){
 const filtered=state.products.filter(p=>p.active&&(state.cat==='Todos'||state.cats.find(c=>c.id===p.category_id)?.name===state.cat)&&p.name.toLowerCase().includes(state.q.toLowerCase()));
 const total=state.cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
 return `<div class="pos"><div><h1>Nueva comanda</h1><div class="seg">${['mesa','llevar','domicilio'].map(x=>`<button data-type="${x}" class="${state.type===x?'on':''}">${x}</button>`).join('')}</div>
 ${state.type==='mesa'?`<select id="tableSelect"><option value="">Seleccionar mesa</option>${state.tables.filter(t=>t.active!==false).map(t=>`<option value="${t.id}" ${state.table===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}
 <div class="search"><span>⌕</span><input id="searchProduct" placeholder="Buscar producto" value="${esc(state.q)}"></div>
 <div class="chips"><button data-cat="Todos" class="${state.cat==='Todos'?'active':''}">Todos</button>${state.cats.map(c=>`<button data-cat="${esc(c.name)}" class="${state.cat===c.name?'active':''}">${esc(c.name)}</button>`).join('')}</div>
 <div class="grid">${filtered.map(p=>`<button ${p.sold_out?'disabled':''} class="product" data-product="${p.id}"><b>${esc(p.name)}</b><small>${p.sold_out?'AGOTADO':esc(state.cats.find(c=>c.id===p.category_id)?.name||'')}</small><strong>${money(p.price)}</strong></button>`).join('')}</div></div>
 <aside class="cart"><h2>Comanda</h2>${!state.cart.length?'<p class="muted">Selecciona productos para comenzar.</p>':''}${state.cart.map(x=>`<div class="cartrow"><div><b>${esc(x.name)}</b><small>${money(x.price)} c/u</small></div><div class="qty"><button data-minus="${x.id}">−</button><b>${x.qty}</b><button data-plus="${x.id}">+</button><button data-remove="${x.id}">×</button></div></div>`).join('')}<div class="total"><span>Total</span><b>${money(total)}</b></div><button class="primary wide" id="saveOrder">Enviar comanda</button></aside></div>`;
}
function mesas(){
 const active=state.tables.filter(t=>t.active!==false), occupied=new Set(state.orders.filter(o=>!['pagado','cancelado'].includes(o.status)&&o.table_id).map(o=>o.table_id));
 return `<div class="pagehead responsivehead"><div><span class="eyebrow">SALÓN</span><h1>Mesas</h1><p class="muted">Administra las mesas conforme crezca el negocio.</p></div><button class="primary" id="newTable">＋ Nueva mesa</button></div><div class="metricstrip"><div><span>Activas</span><b>${active.length}</b></div><div><span>Ocupadas</span><b>${active.filter(t=>occupied.has(t.id)).length}</b></div><div><span>Disponibles</span><b>${active.filter(t=>!occupied.has(t.id)).length}</b></div><div><span>Capacidad</span><b>${active.reduce((a,t)=>a+Number(t.seats||0),0)}</b></div></div><div class="tablecards">${state.tables.map(t=>{const occ=occupied.has(t.id);return `<article class="tablecard ${t.active===false?'disabled':''}"><div class="tablevisual"><span>▦</span><i class="${occ?'busy':'free'}"></i></div><div class="tablemeta"><div><h3>${esc(t.name)}</h3><small>${t.seats||4} lugares</small></div><em class="${occ?'busy':'free'}">${occ?'Ocupada':'Disponible'}</em></div><div class="tableactions"><button data-edittable="${t.id}" class="softbtn">Editar</button><button data-toggletable="${t.id}" class="softbtn">${t.active===false?'Activar':'Desactivar'}</button><button data-deletetable="${t.id}" class="dangerghost">Eliminar</button></div></article>`}).join('')}</div>`;
}
function openTableModal(id=null){const t=id?state.tables.find(x=>x.id===id):null;document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><form class="modal smallmodal" id="tableForm"><div class="modalhead"><div><small>SALÓN</small><h2>${t?'Editar mesa':'Nueva mesa'}</h2><p>Define nombre y capacidad.</p></div><button type="button" class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><div class="tableformvisual">▦</div>${field('Nombre *','tableName',t?.name||`Mesa ${String(state.tables.length+1).padStart(2,'0')}`)}${field('Número de lugares *','tableSeats',t?.seats||4,'number')}<label class="toggleline"><input id="tableActive" type="checkbox" ${t?.active!==false?'checked':''}><span>Mesa activa para comandas</span></label></div><div class="modalfoot"><button type="button" id="cancelTable">Cancelar</button><button type="submit" class="primary">${t?'Guardar':'Crear mesa'}</button></div></form></div>`);$('#modalClose').onclick=$('#cancelTable').onclick=closeModal;$('#tableForm').onsubmit=e=>{e.preventDefault();saveTable(t?.id||null)}}
async function saveTable(id){const name=$('#tableName').value.trim(),seats=Math.max(1,Number($('#tableSeats').value||1)),active=$('#tableActive').checked;if(!name)return toast('Escribe un nombre para la mesa');const r=id?await db.from('dining_tables').update({name,seats,active}).eq('id',id):await db.from('dining_tables').insert({name,seats,active});if(r.error)return toast(r.error.code==='23505'?'Ya existe una mesa con ese nombre':r.error.message);closeModal();toast(id?'Mesa actualizada':'Mesa creada');load()}
async function toggleTable(id){const t=state.tables.find(x=>x.id===id);if(!t)return;const r=await db.from('dining_tables').update({active:t.active===false}).eq('id',id);if(r.error)return toast(r.error.message);load()}
function confirmDeleteTable(id){const t=state.tables.find(x=>x.id===id);if(!t)return;if(state.orders.some(o=>o.table_id===id&&!['pagado','cancelado'].includes(o.status)))return toast('No puedes eliminar una mesa con una comanda activa');document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><div class="modal confirmmodal"><div class="modalhead"><h2>Eliminar ${esc(t.name)}</h2><button class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><p>Dejará de aparecer para nuevas comandas. El historial no se pierde.</p></div><div class="modalfoot"><button id="cancelTableDelete">Cancelar</button><button class="danger" id="deleteTableNow">Eliminar</button></div></div></div>`);$('#modalClose').onclick=$('#cancelTableDelete').onclick=closeModal;$('#deleteTableNow').onclick=async()=>{const r=await db.from('dining_tables').delete().eq('id',id);if(r.error)return toast(r.error.message);closeModal();toast('Mesa eliminada');load()}}
function products(){
 const active=state.products.filter(p=>p.active!==false).length,sold=state.products.filter(p=>p.sold_out).length;
 return `<div class="pagehead"><div><h1>Catálogo</h1><p class="muted">Administra productos, precios, categorías y disponibilidad.</p></div><button class="primary" id="newProduct">＋ Nuevo producto</button></div>
 <div class="compactstats"><span><b>${state.products.length}</b> productos</span><span><b>${active}</b> activos</span><span><b>${sold}</b> agotados</span></div>
 <section class="catalogpanel"><div class="catalogtoolbar"><div class="search grow"><span>⌕</span><input id="catalogSearch" placeholder="Buscar producto..."></div><select id="catalogCategory"><option value="">Todas las categorías</option>${state.cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
 <div id="catalogContent">${catalogRows(state.products)}</div></section>`;
}
function catalogRows(items){
 if(!items.length)return `<div class="empty"><b>No hay productos</b><span>Agrega un producto para comenzar.</span></div>`;
 return `<div class="productlist">${items.map(p=>`<article class="productadmin"><div class="productavatar">${esc(p.name).slice(0,1).toUpperCase()}</div><div class="productinfo"><b>${esc(p.name)}</b><span>${esc(state.cats.find(c=>c.id===p.category_id)?.name||'Sin categoría')} · ${money(p.price)}</span></div><div class="productstatus"><span class="badge ${p.sold_out?'red':'green'}">${p.sold_out?'Agotado':'Disponible'}</span></div><div class="rowactions"><button title="Editar" data-editproduct="${p.id}">Editar</button><button data-sold="${p.id}">${p.sold_out?'Activar':'Agotar'}</button><button class="dangerghost" data-deleteproduct="${p.id}">Eliminar</button></div></article>`).join('')}</div>`;
}
function openProductModal(id=null){
 const p=id?state.products.find(x=>x.id===id):null;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><form class="modal productmodal" id="productForm"><div class="modalhead"><div><small>CATÁLOGO</small><h2>${p?'Editar producto':'Nuevo producto'}</h2><p>${p?'Actualiza la información del producto.':'Captura los datos del nuevo producto.'}</p></div><button type="button" class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><div class="fieldgrid">${field('Nombre *','productName',p?.name||'')}${field('Precio *','productPrice',p?.price||'','number')}<label>Categoría<select id="productCategory">${state.cats.map(c=>`<option value="${c.id}" ${p?.category_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>${field('Descripción','productDescription',p?.description||'')}</div><div class="togglegrid"><label class="toggleline"><input id="productActive" type="checkbox" ${p?.active!==false?'checked':''}><span>Producto activo</span></label><label class="toggleline"><input id="productMenu" type="checkbox" ${p?.show_on_menu!==false?'checked':''}><span>Mostrar en menú</span></label><label class="toggleline"><input id="productSold" type="checkbox" ${p?.sold_out?'checked':''}><span>Marcar agotado</span></label></div></div><div class="modalfoot"><button type="button" id="cancelProduct">Cancelar</button><button class="primary" type="submit">${p?'Guardar cambios':'Crear producto'}</button></div></form></div>`);
 $('#modalClose').onclick=$('#cancelProduct').onclick=closeModal;$('#productForm').onsubmit=e=>{e.preventDefault();saveProduct(p?.id||null)};
}
async function saveProduct(id){
 const payload={name:$('#productName').value.trim(),price:Number($('#productPrice').value),category_id:$('#productCategory').value||null,description:$('#productDescription').value.trim(),active:$('#productActive').checked,show_on_menu:$('#productMenu').checked,sold_out:$('#productSold').checked};
 if(!payload.name)return toast('Ingresa el nombre del producto');if(!Number.isFinite(payload.price)||payload.price<0)return toast('Ingresa un precio válido');
 const r=id?await db.from('products').update(payload).eq('id',id):await db.from('products').insert(payload);
 if(r.error)return toast(r.error.message);closeModal();toast(id?'Producto actualizado':'Producto creado');load();
}
async function deleteProduct(id){
 const p=state.products.find(x=>x.id===id);if(!p)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><div class="modal confirmmodal"><div class="modalhead"><div><small>CONFIRMAR</small><h2>Eliminar producto</h2></div><button class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><p>¿Deseas eliminar <b>${esc(p.name)}</b> del catálogo?</p><p class="hint">Si tiene ventas históricas, se desactivará para conservar el historial.</p></div><div class="modalfoot"><button id="cancelDelete">Cancelar</button><button class="danger" id="confirmDelete">Eliminar</button></div></div></div>`);
 $('#modalClose').onclick=$('#cancelDelete').onclick=closeModal;$('#confirmDelete').onclick=async()=>{let r=await db.from('products').delete().eq('id',id);if(r.error)r=await db.from('products').update({active:false,show_on_menu:false}).eq('id',id);if(r.error)return toast(r.error.message);closeModal();toast('Producto eliminado');load()}
}
function filterCatalog(){
 const q=($('#catalogSearch')?.value||'').toLowerCase(),cat=$('#catalogCategory')?.value||'';
 const items=state.products.filter(p=>(!q||p.name.toLowerCase().includes(q))&&(!cat||p.category_id===cat));
 $('#catalogContent').innerHTML=catalogRows(items);bindCatalogRows();
}
function bindCatalogRows(){
 document.querySelectorAll('[data-editproduct]').forEach(b=>b.onclick=()=>openProductModal(b.dataset.editproduct));
 document.querySelectorAll('[data-deleteproduct]').forEach(b=>b.onclick=()=>deleteProduct(b.dataset.deleteproduct));
 document.querySelectorAll('[data-sold]').forEach(b=>b.onclick=()=>toggleSold(b.dataset.sold));
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

function fiado(){
 const pending=state.credits.filter(c=>Number(c.balance)>0),total=pending.reduce((a,c)=>a+Number(c.balance),0);
 const overdue=pending.filter(c=>c.due_date&&new Date(c.due_date+'T23:59:59')<new Date()).length;
 return `<div class="pagehead"><div><h1>Ventas fiadas</h1><p class="muted">Consulta saldos, vencimientos y registra abonos sin perder el historial.</p></div><span class="debtpill">${pending.length} cuentas pendientes</span></div>
 <div class="cards creditcards">${card('Saldo por cobrar',money(total))}${card('Clientes con saldo',new Set(pending.map(c=>c.customer_id)).size)}${card('Vencidas',overdue)}${card('Liquidadas',state.credits.filter(c=>c.status==='pagado').length)}</div>
 <section class="creditpanel"><div class="catalogtoolbar"><div class="search grow"><span>⌕</span><input id="creditSearch" placeholder="Buscar cliente o folio..."></div><select id="creditStatus"><option value="">Todos los estados</option><option value="pendiente">Pendiente</option><option value="parcial">Parcial</option><option value="pagado">Pagado</option></select></div><div id="creditContent">${creditRows(state.credits)}</div></section>`;
}
function creditRows(items){
 if(!items.length)return `<div class="empty"><b>Sin ventas fiadas</b><span>Las ventas a crédito aparecerán aquí.</span></div>`;
 return `<div class="creditlist">${items.map(c=>{const pct=Math.max(0,Math.min(100,100-(Number(c.balance)/Math.max(Number(c.original_amount),1)*100)));return `<article class="credititem"><div class="creditmain"><div class="creditperson"><div class="clientavatar">${esc(c.customers?.name||'C').slice(0,1).toUpperCase()}</div><div><b>${esc(c.customers?.name||'Cliente')}</b><span>${esc(c.customers?.phone||'Sin teléfono')} · Pedido #${c.orders?.folio||'—'}</span></div></div><span class="badge ${c.status==='pagado'?'green':c.status==='parcial'?'':'red'}">${esc(c.status)}</span></div><div class="creditnumbers"><div><small>Importe</small><b>${money(c.original_amount)}</b></div><div><small>Saldo</small><strong>${money(c.balance)}</strong></div><div><small>Vencimiento</small><b>${c.due_date||'Sin fecha'}</b></div></div><div class="progress"><i style="width:${pct}%"></i></div><div class="creditfoot"><small>${Math.round(pct)}% liquidado · ${(c.credit_payments||[]).length} abono(s)</small><div class="creditactions"><button data-editcredit="${c.id}">Editar</button>${Number(c.balance)>0?`<button class="primary" data-creditpay="${c.id}">Abonar</button>`:'<span class="paidmark">✓ Liquidado</span>'}<button class="dangerghost" data-deletecredit="${c.id}">Eliminar</button></div></div></article>`}).join('')}</div>`;
}
function filterCredits(){
 const q=($('#creditSearch')?.value||'').toLowerCase(),status=$('#creditStatus')?.value||'';
 const items=state.credits.filter(c=>(!status||c.status===status)&&(!q||(c.customers?.name||'').toLowerCase().includes(q)||String(c.orders?.folio||'').includes(q)));
 $('#creditContent').innerHTML=creditRows(items);bindCreditRows();
}
function bindCreditRows(){document.querySelectorAll('[data-creditpay]').forEach(b=>b.onclick=()=>openCreditPayment(b.dataset.creditpay));document.querySelectorAll('[data-editcredit]').forEach(b=>b.onclick=()=>editCredit(b.dataset.editcredit));document.querySelectorAll('[data-deletecredit]').forEach(b=>b.onclick=()=>confirmDeleteCredit(b.dataset.deletecredit))}
function openCreditPayment(id){
 const c=state.credits.find(x=>x.id===id);if(!c)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><div class="modal smallmodal"><div class="modalhead"><div><small>ABONO A FIADO</small><h2>${esc(c.customers?.name||'Cliente')}</h2></div><button class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><div class="creditreceipt"><div><small>Pedido</small><b>#${c.orders?.folio||'—'}</b></div><div><small>Deuda original</small><b>${money(c.original_amount)}</b></div><div><small>Saldo actual</small><strong>${money(c.balance)}</strong></div></div>${field('Monto a abonar *','creditAmount',c.balance,'number')}${field('Nota','creditNote','','text','Opcional')}<label>Método<select id="creditMethod"><option>efectivo</option><option>tarjeta</option><option>transferencia</option></select></label></div><div class="modalfoot"><button id="cancelCredit">Cancelar</button><button class="primary" id="saveCredit">Registrar abono</button></div></div></div>`);
 $('#modalClose').onclick=$('#cancelCredit').onclick=closeModal;$('#saveCredit').onclick=()=>saveCreditPayment(c);
}
function editCredit(id){
 const c=state.credits.find(x=>x.id===id);if(!c)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><form class="modal smallmodal" id="editCreditForm"><div class="modalhead"><div><small>VENTA FIADA</small><h2>Editar datos</h2></div><button type="button" class="iconbtn" id="modalClose">×</button></div><div class="modalbody">${field('Cliente','creditClient',c.customers?.name||'')}${field('Teléfono','creditPhone',c.customers?.phone||'')}${field('Fecha compromiso','creditDue',c.due_date||'','date')}</div><div class="modalfoot"><button type="button" id="cancelCreditEdit">Cancelar</button><button class="primary" type="submit">Guardar</button></div></form></div>`);
 $('#modalClose').onclick=$('#cancelCreditEdit').onclick=closeModal;$('#editCreditForm').onsubmit=async e=>{e.preventDefault();let r=await db.from('customers').update({name:$('#creditClient').value.trim(),phone:$('#creditPhone').value.trim()}).eq('id',c.customer_id);if(r.error)return toast(r.error.message);r=await db.from('credit_accounts').update({due_date:$('#creditDue').value||null,updated_at:new Date().toISOString()}).eq('id',c.id);if(r.error)return toast(r.error.message);closeModal();toast('Fiado actualizado');load()};
}
function confirmDeleteCredit(id){
 const c=state.credits.find(x=>x.id===id);if(!c)return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><div class="modal confirmmodal"><div class="modalhead"><h2>Eliminar registro fiado</h2><button class="iconbtn" id="modalClose">×</button></div><div class="modalbody"><p>Se eliminarán los abonos y el registro de fiado. El pedido permanecerá y volverá a estado de pago pendiente.</p></div><div class="modalfoot"><button id="cancelCreditDelete">Cancelar</button><button class="danger" id="deleteCreditNow">Eliminar</button></div></div></div>`);
 $('#modalClose').onclick=$('#cancelCreditDelete').onclick=closeModal;$('#deleteCreditNow').onclick=async()=>{let r=await db.from('credit_payments').delete().eq('credit_account_id',c.id);if(r.error)return toast(r.error.message);r=await db.from('credit_accounts').delete().eq('id',c.id);if(r.error)return toast(r.error.message);await db.from('orders').update({payment_status:'pendiente',credit_due_date:null}).eq('id',c.order_id);closeModal();toast('Fiado eliminado');load()}
}
async function saveCreditPayment(c){
 const amount=Number($('#creditAmount').value);if(!amount||amount<=0||amount>Number(c.balance))return toast('Ingresa un monto válido');
 const r=await db.from('credit_payments').insert({credit_account_id:c.id,amount,method:$('#creditMethod').value,notes:$('#creditNote').value.trim()});if(r.error)return toast(r.error.message);
 const balance=Number(c.balance)-amount,status=balance<=0?'pagado':'parcial';
 await db.from('credit_accounts').update({balance,status,updated_at:new Date().toISOString()}).eq('id',c.id);
 if(balance<=0){await db.from('orders').update({payment_status:'pagado',status:'pagado'}).eq('id',c.order_id)}
 closeModal();toast('Abono registrado');load();
}
function config(){
 const s=state.settings;
 return `<div class="titlebar"><div><h1>Configuración del local</h1><p class="muted">Personaliza la información y apariencia del menú PDF.</p></div></div>
 <div class="settingsgrid"><section><h2>Datos del negocio</h2>${field('Nombre comercial','businessName',s.business_name)}${field('Subtítulo','subtitle',s.subtitle||'')}${field('Teléfono','shopPhone',s.phone||'')}${field('Correo','shopEmail',s.email||'','email')}${field('Dirección','shopAddress',s.address||'')}${field('RFC / identificación fiscal','taxId',s.tax_id||'')}${field('Redes / contacto','socialText',s.social_text||'')}${field('Pie del PDF','footerText',s.footer_text||'')}</section>
 <section><h2>Identidad visual</h2><div class="uploadbox"><div class="assetpreview">${s.logo_url?`<img src="${s.logo_url}" alt="Logo">`:'<span>LOGO</span>'}</div><label>Logo del negocio<input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="clearLogo">Quitar logo</button></div>
 <div class="uploadbox"><div class="assetpreview watermarkprev">${s.watermark_url?`<img src="${s.watermark_url}" alt="Marca de agua">`:'<span>MARCA DE AGUA</span>'}</div><label>Imagen de fondo / marca de agua<input id="watermarkFile" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="clearWatermark">Quitar imagen</button></div></section></div>
 <div class="stickyactions"><button class="primary" id="saveSettings">Guardar configuración</button></div>`;
}
function fileData(input){return new Promise((res,rej)=>{const f=input.files?.[0];if(!f)return res(null);if(f.size>1500000)return rej(new Error('La imagen debe pesar menos de 1.5 MB'));const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)})}
function render(){
 let content=state.page==='Inicio'?dashboard():state.page==='Comandero'?comandero():state.page==='Pedidos'?`<h1>Pedidos</h1><section>${ordersTable(state.orders.filter(o=>!['pagado','cancelado'].includes(o.status)))}</section>`:state.page==='Mesas'?mesas():state.page==='Caja'?cash():state.page==='Fiado'?fiado():state.page==='Productos'?products():state.page==='Menú'?menu():state.page==='Ventas'?salesHistory():config();
 $('#app').innerHTML=shell(content); bind();
}
function bind(){
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{state.page=b.dataset.nav;render()});
 const savedCollapsed=localStorage.getItem('losamigos-sidebar')==='1';if(savedCollapsed)document.querySelector('.app')?.classList.add('sidebar-mini');
 if($('#collapseSide'))$('#collapseSide').onclick=()=>{document.querySelector('.app').classList.toggle('sidebar-mini');localStorage.setItem('losamigos-sidebar',document.querySelector('.app').classList.contains('sidebar-mini')?'1':'0')};
 if($('#mobileMenu'))$('#mobileMenu').onclick=()=>document.querySelector('.app').classList.add('sidebar-open');
 if($('#sideoverlay'))$('#sideoverlay').onclick=()=>document.querySelector('.app').classList.remove('sidebar-open');
 document.querySelectorAll('[data-editorder]').forEach(b=>b.onclick=()=>openEditOrder(b.dataset.editorder));
 document.querySelectorAll('[data-deleteorder]').forEach(b=>b.onclick=()=>confirmDeleteOrder(b.dataset.deleteorder));
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
 if($('#saveOrder'))$('#saveOrder').onclick=openOrderModal;
 if($('#newTable'))$('#newTable').onclick=()=>openTableModal();document.querySelectorAll('[data-edittable]').forEach(b=>b.onclick=()=>openTableModal(b.dataset.edittable));document.querySelectorAll('[data-toggletable]').forEach(b=>b.onclick=()=>toggleTable(b.dataset.toggletable));document.querySelectorAll('[data-deletetable]').forEach(b=>b.onclick=()=>confirmDeleteTable(b.dataset.deletetable));if($('#newProduct'))$('#newProduct').onclick=()=>openProductModal();
 bindCatalogRows();
 if($('#catalogSearch'))$('#catalogSearch').oninput=filterCatalog;
 if($('#catalogCategory'))$('#catalogCategory').onchange=filterCatalog;
 if($('#creditSearch'))$('#creditSearch').oninput=filterCredits;
 if($('#creditStatus'))$('#creditStatus').onchange=filterCredits;
 if($('#openCash'))$('#openCash').onclick=openCash;
 if($('#closeCash'))$('#closeCash').onclick=closeCash;
 if($('#pdfMenu'))$('#pdfMenu').onclick=pdfMenu;
 bindCreditRows();
 if($('#saveSettings'))$('#saveSettings').onclick=saveSettings;
 if($('#clearLogo'))$('#clearLogo').onclick=()=>{state.settings.logo_url='';render()};
 if($('#clearWatermark'))$('#clearWatermark').onclick=()=>{state.settings.watermark_url='';render()};
}
function addProduct(id){const p=state.products.find(x=>x.id===id);if(!p)return;const x=state.cart.find(i=>i.id===id);if(x)x.qty++;else state.cart.push({...p,qty:1,notes:''});render()}

function closeModal(){const m=$('.modalback');if(m)m.remove()}
function field(label,id,value='',type='text',placeholder=''){return `<label>${label}<input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"></label>`}
function openOrderModal(){
 if(!state.cart.length)return toast('Agrega productos a la comanda');
 const total=state.cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
 document.body.insertAdjacentHTML('beforeend',`<div class="modalback"><form class="modal ordermodal singleform" id="orderForm">
 <div class="modalhead"><div><small>NUEVA COMANDA</small><h2>Datos del pedido</h2><p>Completa la información y confirma la comanda.</p></div><button type="button" class="iconbtn" id="modalClose">×</button></div>
 <div class="modalbody">
   <div class="singleordergrid">
    <div class="orderformfields">
      <div class="formsection">
       <h3>1. Tipo de servicio</h3>
       <div class="seg servicepicker">${['mesa','llevar','domicilio'].map(x=>`<button type="button" data-modaltype="${x}" class="${state.type===x?'on':''}">${x==='mesa'?'Mesa':x==='llevar'?'Para llevar':'Domicilio'}</button>`).join('')}</div>
       <div id="serviceFields" class="adaptivefields">${serviceFields()}</div>
      </div>
      <div class="formsection">
       <h3>2. Datos adicionales</h3>
       <label>Notas de la comanda<textarea id="orderNotes" rows="3" placeholder="Ej. sin cebolla, salsa aparte, indicaciones especiales..."></textarea></label>
      </div>
      <div class="formsection">
       <h3>3. Forma de pago</h3>
       <div class="paymentgrid">${['efectivo','tarjeta','transferencia','fiado'].map(x=>`<label class="paychoice"><input type="radio" name="paymethod" value="${x}" ${x==='efectivo'?'checked':''}><span>${x==='fiado'?'◷ ':''}${x}</span></label>`).join('')}</div>
       <div id="creditFields" class="creditinline hidden">${field('Fecha compromiso','dueDate','','date')}<p class="hint">Para fiado debes capturar el nombre del cliente.</p></div>
      </div>
    </div>
    <aside class="ordersummary">
      <div class="summaryhead"><div><small>RESUMEN</small><h3>Comanda actual</h3></div><span>${state.cart.reduce((a,x)=>a+x.qty,0)} artículos</span></div>
      <div class="summaryitems">${state.cart.map(x=>`<div class="sumrow"><div><b>${x.qty} × ${esc(x.name)}</b><small>${money(x.price)} c/u</small></div><strong>${money(Number(x.price)*x.qty)}</strong></div>`).join('')}</div>
      <div class="sumtotal"><span>Total</span><strong>${money(total)}</strong></div>
    </aside>
   </div>
 </div>
 <div class="modalfoot"><button type="button" id="cancelOrder">Cancelar</button><button type="submit" class="primary" id="confirmOrder">Crear comanda · ${money(total)}</button></div>
 </form></div>`);
 bindOrderModal();
}
function serviceFields(){
 if(state.type==='mesa') return `<div class="fieldgrid"><label>Mesa *<select id="modalTable" required><option value="">Seleccionar mesa</option>${state.tables.filter(t=>t.active!==false).map(t=>`<option value="${t.id}" ${state.table===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>${field('Cliente','customerName','','text','Opcional')}${field('Teléfono','customerPhone','','tel','Opcional')}</div>`;
 if(state.type==='domicilio') return `<div class="fieldgrid">${field('Cliente *','customerName','','text','Nombre completo')}${field('Teléfono *','customerPhone','','tel','999 000 0000')}${field('Dirección *','customerAddress','','text','Calle, número y colonia')}${field('Referencia','customerReference','','text','Color de casa, cruzamientos, etc.')}</div>`;
 return `<div class="fieldgrid">${field('Cliente','customerName','','text','Opcional')}${field('Teléfono','customerPhone','','tel','Opcional')}</div>`;
}
function bindOrderModal(){
 $('#modalClose').onclick=$('#cancelOrder').onclick=closeModal;
 document.querySelectorAll('[data-modaltype]').forEach(b=>b.onclick=()=>{
   state.type=b.dataset.modaltype;
   document.querySelectorAll('[data-modaltype]').forEach(x=>x.classList.toggle('on',x.dataset.modaltype===state.type));
   $('#serviceFields').innerHTML=serviceFields();
 });
 document.querySelectorAll('input[name=paymethod]').forEach(r=>r.onchange=()=>$('#creditFields').classList.toggle('hidden',r.value!=='fiado'));
 $('#orderForm').onsubmit=e=>{e.preventDefault();confirmOrder()};
}
async function getOrCreateCustomer(required=false){
 const name=$('#customerName')?.value.trim()||'',phone=$('#customerPhone')?.value.trim()||'',address=$('#customerAddress')?.value.trim()||'',reference=$('#customerReference')?.value.trim()||'';
 if(required&&!name)throw new Error('Ingresa el nombre del cliente para registrar el fiado.');
 if(!name&&!phone)return null;
 if(phone){const found=await db.from('customers').select('*').eq('phone',phone).limit(1);if(found.data?.[0]){await db.from('customers').update({name:name||found.data[0].name,address:address||found.data[0].address,reference:reference||found.data[0].reference}).eq('id',found.data[0].id);return found.data[0].id}}
 const c=await db.from('customers').insert({name:name||'Cliente',phone,address,reference}).select().single();if(c.error)throw c.error;return c.data.id;
}
async function confirmOrder(){
 const btn=$('#confirmOrder');btn.disabled=true;btn.textContent='Guardando…';
 try{
   const method=document.querySelector('input[name=paymethod]:checked')?.value||'efectivo';
   if(state.type==='domicilio'){
     if(!$('#customerName')?.value.trim())throw new Error('Ingresa el nombre del cliente.');
     if(!$('#customerPhone')?.value.trim())throw new Error('Ingresa el teléfono del cliente.');
     if(!$('#customerAddress')?.value.trim())throw new Error('Ingresa la dirección de entrega.');
   }
   const customer_id=await getOrCreateCustomer(method==='fiado'||state.type==='domicilio');
   const table_id=state.type==='mesa'?($('#modalTable')?.value||state.table||null):null;
   if(state.type==='mesa'&&!table_id)throw new Error('Selecciona una mesa.');
   const total=state.cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);
   const notes=$('#orderNotes')?.value.trim()||'';
   const o=await db.from('orders').insert({order_type:state.type,table_id,customer_id,status:method==='fiado'?'entregado':'pendiente',subtotal:total,total,notes,payment_status:method==='fiado'?'fiado':'pendiente',credit_due_date:method==='fiado'?($('#dueDate')?.value||null):null}).select().single();
   if(o.error)throw o.error;
   const ir=await db.from('order_items').insert(state.cart.map(x=>({order_id:o.data.id,product_id:x.id,product_name:x.name,quantity:x.qty,unit_price:x.price,line_total:Number(x.price)*x.qty,notes:x.notes||''})));if(ir.error)throw ir.error;
   if(method==='fiado'){const cr=await db.from('credit_accounts').insert({order_id:o.data.id,customer_id,original_amount:total,balance:total,due_date:$('#dueDate')?.value||null});if(cr.error)throw cr.error}
   state.cart=[];state.table='';closeModal();toast(method==='fiado'?'Fiado registrado correctamente':'Comanda creada correctamente');await load();
 }catch(e){toast(e.message||'No se pudo guardar');btn.disabled=false;btn.textContent='Confirmar pedido'}
}
async function pay(id){const o=state.orders.find(x=>x.id===id);if(!o)return;const method=prompt('Método: efectivo, tarjeta, transferencia u otro','efectivo');if(!method)return;let r=await db.from('payments').insert({order_id:o.id,method,amount:o.total});if(r.error)return toast(r.error.message);await db.from('orders').update({status:'pagado',updated_at:new Date().toISOString()}).eq('id',o.id);toast('Venta cobrada');load()}
async function setStatus(id,status){await db.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);load()}
function newProduct(){openProductModal()}
async function toggleSold(id){const p=state.products.find(x=>x.id===id);if(!p)return;await db.from('products').update({sold_out:!p.sold_out}).eq('id',id);load()}
async function openCash(){const n=Number(prompt('Fondo inicial','0'));const r=await db.from('cash_sessions').insert({opening_amount:n}).select().single();if(r.error)return toast(r.error.message);state.cash=r.data;toast('Caja abierta');render()}
async function closeCash(){const n=Number(prompt('Efectivo contado','0'));const r=await db.from('cash_sessions').update({status:'cerrada',closed_at:new Date().toISOString(),closing_counted:n}).eq('id',state.cash.id);if(r.error)return toast(r.error.message);state.cash=null;toast('Caja cerrada');render()}
async function saveSettings(){
 try{
  const logo=await fileData($('#logoFile')),watermark=await fileData($('#watermarkFile'));
  const updates={business_name:$('#businessName').value.trim(),subtitle:$('#subtitle').value.trim(),phone:$('#shopPhone').value.trim(),email:$('#shopEmail').value.trim(),address:$('#shopAddress').value.trim(),tax_id:$('#taxId').value.trim(),social_text:$('#socialText').value.trim(),footer_text:$('#footerText').value.trim(),logo_url:logo||state.settings.logo_url||'',watermark_url:watermark||state.settings.watermark_url||'',updated_at:new Date().toISOString()};
  const r=await db.from('menu_settings').update(updates).eq('id',1);if(r.error)throw r.error;state.settings={...state.settings,...updates};toast('Configuración guardada');render();
 }catch(e){toast(e.message)}
}
function pdfMenu(){
 const {jsPDF}=window.jspdf,d=new jsPDF(),s=state.settings;
 if(s.watermark_url){try{d.setGState(new d.GState({opacity:.07}));d.addImage(s.watermark_url,'AUTO',35,75,140,140);d.setGState(new d.GState({opacity:1}))}catch(e){}}
 if(s.logo_url){try{d.addImage(s.logo_url,'AUTO',15,12,28,22)}catch(e){}}
 d.setFontSize(22);d.text(s.business_name||'Taquería Los Amigos',105,20,{align:'center'});
 d.setFontSize(10);d.text([s.subtitle,s.address,s.phone,s.email,s.tax_id?`RFC: ${s.tax_id}`:''].filter(Boolean),105,28,{align:'center'});
 let y=48;state.cats.forEach(c=>{const ps=state.products.filter(p=>p.category_id===c.id&&p.show_on_menu&&p.active);if(!ps.length)return;if(y>255){d.addPage();y=25}d.setFontSize(15);d.text(c.name,15,y);y+=8;ps.forEach(p=>{d.setFontSize(10.5);d.text(p.name,18,y);d.text(money(p.price),190,y,{align:'right'});if(s.show_descriptions&&p.description){y+=5;d.setFontSize(8);d.text(String(p.description).slice(0,85),18,y)}y+=8})});
 const pages=d.getNumberOfPages();for(let i=1;i<=pages;i++){d.setPage(i);d.setFontSize(8);d.text([s.social_text,s.footer_text].filter(Boolean).join(' · '),105,287,{align:'center'})}
 d.save('menu-taqueria-los-amigos.pdf')
}
load();
