
const $=s=>document.querySelector(s); const money=n=>'Rs '+Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:2});
let token=sessionStorage.getItem('commerceToken')||'';
async function api(path,options={}){const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers.Authorization='Bearer '+token;const r=await fetch(path,{...options,headers});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Request failed');return j.data??j}
function showApp(){ $('#login').classList.add('hidden');$('#app').classList.remove('hidden');$('#logout').classList.remove('hidden');loadSales();loadCategories();loadCatalog();loadSetup();loadOperationalOrders()}
$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginMsg').textContent='';try{const data=await api('/api/v1/auth/login',{method:'POST',body:JSON.stringify({phoneNumber:$('#phone').value,password:$('#password').value})});token=data.token;sessionStorage.setItem('commerceToken',token);showApp()}catch(err){$('#loginMsg').textContent=err.message}}
$('#logout').onclick=()=>{sessionStorage.removeItem('commerceToken');location.reload()}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.className='tab ghost');b.className='tab active';$('#salesView').classList.toggle('hidden',b.dataset.view!=='sales');$('#catalogView').classList.toggle('hidden',b.dataset.view!=='catalog');$('#setupView').classList.toggle('hidden',b.dataset.view!=='setup')})
async function loadSales(){try{const d=await api('/api/v1/commerce/admin/sales?range='+$('#range').value);$('#sales').textContent=money(d.sales);$('#orders').textContent=d.deliveredOrders;$('#units').textContent=d.unitsSold;$('#aov').textContent=money(d.averageOrderValue);$('#topProducts').innerHTML=d.topProducts.map(x=>'<tr><td>'+esc(x.sku||'—')+'</td><td>'+esc(x.name)+'</td><td>'+x.quantity+'</td><td>'+money(x.sales)+'</td></tr>').join('')||'<tr><td colspan=4 class=muted>No delivered sales yet</td></tr>';$('#statuses').innerHTML=Object.entries(d.orderStatus).map(([k,v])=>'<div class="toolbar"><span>'+k.replaceAll('_',' ')+'</span><b>'+v+'</b></div>').join('')||'<div class=muted>No orders</div>';$('#recentOrders').innerHTML=d.recentOrders.map(x=>'<tr><td>'+esc(x.orderNumber)+'</td><td>'+esc(x.customer)+'</td><td>'+x.sourceChannel+'</td><td><span class=status>'+x.status+'</span></td><td>'+money(x.totalAmount)+'</td><td>'+actionButton(x)+'</td></tr>').join('');await loadRecon();await loadFailed();$('#connectionNotice').textContent='Updated '+new Date().toLocaleTimeString()}catch(e){$('#connectionNotice').textContent='Update failed: '+e.message}}
async function loadRecon(){const date=$('#reconDate').value; if(!date)return;const d=await api('/api/v1/commerce/admin/reconciliation?date='+date);$('#reconSummary').textContent=d.deliveredOrders+' delivered orders • '+d.totalUnits+' units • '+money(d.netSales);$('#recon').innerHTML=d.items.map(x=>'<tr><td>'+esc(x.sku||'—')+'</td><td>'+esc(x.name)+'</td><td><b>'+x.quantity+'</b></td><td>'+money(x.salesAmount)+'</td></tr>').join('')||'<tr><td colspan=4 class=muted>No delivered sales for this date</td></tr>'}
async function loadCategories(){try{const d=await api('/api/v1/commerce/categories');const options=d.map(x=>'<option value="'+x.id+'">'+(x.parentId?'↳ ':'')+esc(x.name)+'</option>').join('');$('#category').innerHTML=options;const parent=$('#catParent');if(parent)parent.innerHTML='<option value="">Top level category</option>'+options}catch(e){console.error(e)}}
async function loadCatalog(){try{const d=await api('/api/v1/commerce/catalog?limit=50');$('#productGrid').innerHTML=d.products.map(p=>'<div class="card product">'+(p.imageUrl?'<img src="'+attr(p.imageUrl)+'" alt="">':'<div style="aspect-ratio:1.2;display:grid;place-items:center;background:#13251a;border-radius:12px" class=muted>No image</div>')+'<h3>'+esc(p.name)+'</h3><div class=muted>'+(p.brand?esc(p.brand)+' • ':'')+esc(p.sku||'No SKU')+'</div><div><span class=price>'+money(p.price)+'</span>'+(p.mrp?'<span class=strike>'+money(p.mrp)+'</span>':'')+'</div><div class=muted>'+p.stockStatus+(p.packSize?' • '+esc(p.packSize):'')+'</div><div class=muted>Available: '+p.availableUnits+'</div><button data-receive="'+attr(p.id)+'">Receive stock</button></div>').join('')}catch(e){console.error(e)}}
$('#productForm').onsubmit=async e=>{e.preventDefault();const body={sku:$('#sku').value,name:$('#pname').value,brand:$('#brand').value,categoryId:$('#category').value,fixedPrice:$('#price').value,mrp:$('#mrp').value,unit:$('#unit').value,packSize:$('#packSize').value,imageUrl:$('#imageUrl').value,description:$('#description').value};try{await api('/api/v1/commerce/admin/products',{method:'POST',body:JSON.stringify(body)});$('#productMsg').className='full success';$('#productMsg').textContent='Product added';e.target.reset();await loadCategories();await loadCatalog()}catch(err){$('#productMsg').className='full error';$('#productMsg').textContent=err.message}}
$('#categoryForm').onsubmit=async e=>{e.preventDefault();const body={name:$('#catName').value,parentId:$('#catParent').value||null,imageUrl:$('#catImage').value||null,sortOrder:Number($('#catSort').value||0),description:$('#catDescription').value||null};try{await api('/api/v1/commerce/admin/categories',{method:'POST',body:JSON.stringify(body)});$('#catMsg').className='full success';$('#catMsg').textContent='Category created';e.target.reset();await loadCategories()}catch(err){$('#catMsg').className='full error';$('#catMsg').textContent=err.message}}
async function loadSetup(){try{
const [providers,areas,offers]=await Promise.all([
api('/api/v1/shopping/payments/providers'),
api('/api/v1/shopping/admin/service-areas'),
api('/api/v1/shopping/admin/offers?all=true')
]);
$('#khaltiStatus').textContent='Disabled (COD only)';
$('#esewaStatus').textContent='Disabled (COD only)';
$('#offerCount').textContent=offers.filter(x=>x.isActive&&new Date(x.endsAt)>new Date()).length;
$('#serviceAreaRows').innerHTML=areas.map(x=>'<tr><td>'+esc(x.code)+'</td><td>'+esc(x.name||[x.city,x.district].filter(Boolean).join(', ')||'—')+'</td><td>'+money(x.minOrder)+'</td><td>'+money(x.deliveryFee)+'</td><td>'+esc(x.etaText||'—')+'</td></tr>').join('')||'<tr><td colspan=5 class=muted>No service areas configured</td></tr>';
$('#offerRows').innerHTML=offers.map(x=>'<tr><td>'+esc(x.title)+'</td><td>'+esc(x.code||'Auto')+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.value)+'</td><td>'+money(x.minOrderAmount)+'</td><td>'+new Date(x.endsAt).toLocaleString()+'</td></tr>').join('')||'<tr><td colspan=6 class=muted>No offers configured</td></tr>';
}catch(e){console.error(e)}}
$('#areaForm').onsubmit=async e=>{e.preventDefault();const body={code:$('#areaCode').value,name:$('#areaName').value,city:$('#areaCity').value,district:$('#areaDistrict').value,postalCode:$('#areaPostal').value,keywords:$('#areaKeywords').value,minOrder:$('#areaMin').value||0,deliveryFee:$('#areaFee').value||0,etaText:$('#areaEta').value};try{await api('/api/v1/shopping/admin/service-areas',{method:'POST',body:JSON.stringify(body)});$('#areaMsg').className='full success';$('#areaMsg').textContent='Service area saved';e.target.reset();await loadSetup()}catch(err){$('#areaMsg').className='full error';$('#areaMsg').textContent=err.message}}
$('#offerForm').onsubmit=async e=>{e.preventDefault();const body={title:$('#offerTitle').value,code:$('#offerCode').value||null,type:$('#offerType').value,value:$('#offerValue').value,minOrderAmount:$('#offerMin').value||0,maxDiscount:$('#offerMax').value||null,endsAt:new Date($('#offerEnds').value).toISOString(),autoApply:$('#offerAuto').checked};try{await api('/api/v1/shopping/admin/offers',{method:'POST',body:JSON.stringify(body)});$('#offerMsg').className='full success';$('#offerMsg').textContent='Offer created';e.target.reset();await loadSetup()}catch(err){$('#offerMsg').className='full error';$('#offerMsg').textContent=err.message}}
$('#range').onchange=loadSales;$('#refreshCatalog').onclick=loadCatalog;$('#refreshSetup').onclick=loadSetup;$('#reconDate').onchange=loadRecon;
function actionButton(o){
  const next={CREATED:'CONFIRMED',CONFIRMED:'PROCESSING',PROCESSING:'PACKED',PACKED:'OUT_FOR_DELIVERY',OUT_FOR_DELIVERY:'DELIVERED',FAILED:'PROCESSING'}[o.status];
  const advance=next?'<button data-order="'+attr(o.id)+'" data-status="'+next+'" data-total="'+Number(o.totalAmount)+'">'+(next==='DELIVERED'?'Record cash & deliver':next.replaceAll('_',' '))+'</button>':'';
  const cancel=!['DELIVERED','CANCELLED'].includes(o.status)?'<button class="ghost" data-order="'+attr(o.id)+'" data-status="CANCELLED">Cancel</button>':'';
  return '<button class="ghost" data-detail="'+attr(o.id)+'">Details</button>'+advance+cancel;
}
async function handleStatusAction(e){
  const b=e.target.closest('button[data-order]');if(!b)return;
  const status=b.dataset.status;const body={status};
  if(status==='DELIVERED'){
    const cash=prompt('Enter cash actually collected. Expected: '+money(b.dataset.total));
    if(cash===null)return;body.cashReceived=Number(cash);
  }
  if(!confirm('Move order to '+status.replaceAll('_',' ')+'?'))return;
  try{await api('/api/v1/commerce/admin/orders/'+b.dataset.order+'/status',{method:'PUT',body:JSON.stringify(body)});await loadSales();await loadOperationalOrders()}catch(err){alert(err.message)}
}
$('#recentOrders').addEventListener('click',handleStatusAction);
setInterval(()=>{if(token&&!document.hidden)loadSales()},15000);
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))} function attr(v){return esc(v)}
$('#reconDate').value=new Date(Date.now()+345*60000).toISOString().slice(0,10);

$('#productGrid').addEventListener('click', async e => {
  const b=e.target.closest('[data-receive]');if(!b)return;
  const quantity=prompt('Quantity received (whole units):');if(quantity===null)return;
  const reference=prompt('Unique receipt reference (invoice + SKU):');if(!reference)return;
  try { await api('/api/v1/commerce/admin/inventory/'+b.dataset.receive+'/receipts',{method:'POST',body:JSON.stringify({quantity:Number(quantity),reference})});await loadCatalog(); }
  catch(error){alert(error.message)}
});

async function loadFailed(){
 const d=await api('/api/v1/commerce/admin/messages/failed');
 $('#failedMessages').innerHTML=['inbound','outbound'].flatMap(kind=>d[kind].map(x=>'<div>'+esc(kind+' '+(x.sender||''))+': '+esc(x.lastError)+' <button data-retry="'+attr(x.id)+'" data-kind="'+kind+'">Retry</button></div>')).join('')||'<span class=muted>No failed messages</span>';
}
$('#failedMessages').addEventListener('click',async e=>{const b=e.target.closest('[data-retry]');if(!b)return;try{await api('/api/v1/commerce/admin/messages/'+b.dataset.kind+'/'+b.dataset.retry+'/retry',{method:'POST'});await loadFailed()}catch(error){alert(error.message)}});

let operationalPage=1;
async function loadOperationalOrders(){
 try{
  const d=await api('/api/v1/commerce/admin/orders?page='+operationalPage+'&status='+$('#orderFilter').value);
  $('#fulfillmentOrders').innerHTML=d.orders.map(o=>'<tr><td>'+esc(o.orderNumber)+'</td><td>'+esc(o.deliveryName||o.retailer.pasalName)+'</td><td>'+money(o.totalAmount)+'</td><td>'+esc(o.status)+'</td><td>'+actionButton(o)+'</td></tr>').join('')||'<tr><td colspan=5>No orders</td></tr>';
  $('#ordersPage').textContent='Page '+d.page+' of '+d.pages+' • '+d.total+' orders';$('#ordersPrev').disabled=d.page<=1;$('#ordersNext').disabled=d.page>=d.pages;
 }catch(error){$('#ordersPage').textContent=error.message}
}
$('#orderFilter').onchange=()=>{operationalPage=1;loadOperationalOrders()};
$('#ordersPrev').onclick=()=>{operationalPage--;loadOperationalOrders()};$('#ordersNext').onclick=()=>{operationalPage++;loadOperationalOrders()};$('#refreshOrders').onclick=loadOperationalOrders;
$('#fulfillmentOrders').addEventListener('click',handleStatusAction);
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-detail]');if(!b)return;
 try{const o=await api('/api/v1/commerce/admin/orders/'+b.dataset.detail);
 $('#orderDetailsBody').innerHTML='<h2>'+esc(o.orderNumber)+'</h2><p>'+esc(o.deliveryName||'')+'<br>'+esc(o.deliveryPhone||'')+'<br>'+esc(o.deliveryAddress||'')+'</p><p>'+esc(o.status)+' • '+esc(o.paymentStatus)+' • '+money(o.totalAmount)+'</p><ul>'+o.items.map(i=>'<li>'+esc(i.product.name)+' '+esc(i.product.packSize||'')+' × <b>'+i.quantity+'</b></li>').join('')+'</ul><p>'+esc(o.customerNotes||'')+'</p>';
 $('#orderDetails').showModal();}catch(error){alert(error.message)}
});
$('#closeOrderDetails').onclick=()=>$('#orderDetails').close();
setInterval(()=>{if(token&&!document.hidden)loadOperationalOrders()},15000);

if(token)showApp();
