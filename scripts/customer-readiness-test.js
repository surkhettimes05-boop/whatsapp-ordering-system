// Destructive fixtures belong ONLY in a disposable test database.
require('dotenv').config();
if (process.env.NODE_ENV !== 'test' || process.env.USE_REAL_DATABASE !== 'true') throw new Error('Use NODE_ENV=test USE_REAL_DATABASE=true and a disposable PostgreSQL database');
process.env.WHATSAPP_PROVIDER='meta';
process.env.COMMERCE_WHOLESALER_ID='customer-test-fulfillment';
process.env.ENABLE_PROMOTIONS='false';
process.env.JWT_SECRET='disposable-test-secret-with-at-least-32-characters';
process.env.META_WHATSAPP_PHONE_NUMBER_ID='test-business';
process.env.META_WHATSAPP_APP_SECRET='test-signature-secret';
process.env.META_CATALOG_ID='TEST-CATALOG';
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const request=require('supertest');
const prisma=require('../src/config/database');
const commerce=require('../src/services/commerce.service');
const shopping=require('../src/services/shopping.service');
const inventory=require('../src/services/commerceInventory.service');
const inbox=require('../src/services/whatsappWebhook.service');
const controller=require('../src/controllers/commerce-whatsapp.controller');
const auth=require('../src/services/auth.service');
const passed=[];
async function check(name, fn){await fn();passed.push(name);console.log('PASS '+name)}
async function run(){
  const {seedFreeTest}=require('./seed-free-test');await seedFreeTest();
  const app=require('../src/app');
  const suffix=Date.now().toString().slice(-8);
  const a=await prisma.retailer.create({data:{phoneNumber:'97798'+suffix,whatsappNumber:'97798'+suffix,pasalName:'Test A'}});
  const b=await prisma.retailer.create({data:{phoneNumber:'97797'+suffix,whatsappNumber:'97797'+suffix,pasalName:'Test B'}});
  const product=await prisma.product.findUnique({where:{sku:'TEST-RICE-5KG'}});
  const row=await prisma.wholesalerProduct.findUnique({where:{wholesalerId_productId:{wholesalerId:process.env.COMMERCE_WHOLESALER_ID,productId:product.id}}});
  await prisma.wholesalerProduct.update({where:{id:row.id},data:{stock:3,reservedStock:0}});
  for(const customer of [a,b]) await shopping.createAddress(customer.id,{addressLine1:'Test Chowk, Birendranagar',city:'Birendranagar',isDefault:true});
  const admin=await prisma.user.create({data:{phoneNumber:'admin-'+suffix,whatsappNumber:'admin-'+suffix,name:'Test admin',role:'ADMIN'}});
  const customer=await prisma.user.create({data:{phoneNumber:'user-'+suffix,whatsappNumber:a.whatsappNumber,name:'Test customer',role:'RETAILER'}});
  const adminToken=auth.generateToken(admin),customerToken=auth.generateToken(customer);
  await check('Public registration cannot create any privileged account',async()=>{
    for(const role of [undefined,'ADMIN','WHOLESALER','RETAILER']) assert.equal((await request(app).post('/api/v1/auth/register').send({phoneNumber:'9779800000001',name:'Attacker',password:'Password123',role})).status,403);
  });
  await check('Anonymous and password-only users cannot access another customer cart/address',async()=>{
    assert.equal((await request(app).get('/api/v1/commerce/retailers/'+b.id+'/cart')).status,401);
    assert.equal((await request(app).get('/api/v1/commerce/retailers/'+b.id+'/cart').set('Authorization','Bearer '+customerToken)).status,403);
    assert.equal((await request(app).get('/api/v1/shopping/retailers/'+b.id+'/addresses').set('Authorization','Bearer '+customerToken)).status,403);
    assert.equal((await request(app).get('/api/v1/commerce/retailers/'+a.id+'/cart').set('Authorization','Bearer '+adminToken)).status,200);
  });
  await check('Suspended administrator token is rejected',async()=>{
    await prisma.user.update({where:{id:admin.id},data:{status:'SUSPENDED'}});
    assert.equal((await request(app).get('/api/v1/commerce/admin/sales').set('Authorization','Bearer '+adminToken)).status,401);
    await prisma.user.update({where:{id:admin.id},data:{status:'ACTIVE'}});
  });
  await check('Payment callbacks and legacy order bypasses are disabled',async()=>{
    assert.equal((await request(app).get('/api/v1/shopping/payments/khalti/callback')).status,403);
    assert.equal((await request(app).post('/api/v1/orders').send({})).status,404);
    await assert.rejects(()=>shopping.checkout(a.id,{paymentProvider:'khalti'}),/Only cash/);
  });
  let orderA,cartA;
  await check('Concurrent checkout cannot oversell the final 3 units',async()=>{
    await commerce.addCartItem(a.id,product.id,2);await commerce.addCartItem(b.id,product.id,2);
    cartA=await commerce.getCart(a.id);const cartB=await commerce.getCart(b.id);
    const results=await Promise.allSettled([shopping.checkout(a.id,{cartId:cartA.id}),shopping.checkout(b.id,{cartId:cartB.id})]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
    orderA=results.find(r=>r.status==='fulfilled').value.order;
    if(orderA.retailerId!==a.id) cartA=cartB;
    assert.match(results.find(r=>r.status==='rejected').reason.message,/Insufficient stock/);
    const after=await prisma.wholesalerProduct.findUnique({where:{id:row.id}});assert.equal(after.stock,3);assert.equal(after.reservedStock,2);
    const failed=results[0].status==='rejected'?a:b;
    assert.equal(await prisma.order.count({where:{retailerId:failed.id}}),0);
    assert.equal((await commerce.getCart(failed.id)).items[0].quantity,2);
  });
  await check('Checkout retry returns the same order and one reservation',async()=>{
    const retry=await shopping.checkout(orderA.retailerId,{cartId:cartA.id});assert.equal(retry.order.id,orderA.id);
    assert.equal(await prisma.stockReservation.count({where:{orderId:orderA.id}}),1);
    assert.equal((await commerce.getCart(orderA.retailerId)).items.length,0);
  });
  await check('Cancellation releases stock once and keeps physical stock unchanged',async()=>{
    await Promise.all([commerce.updateCommerceOrderStatus(orderA.id,'CANCELLED',{actorId:admin.id}),commerce.updateCommerceOrderStatus(orderA.id,'CANCELLED',{actorId:admin.id})]);
    const after=await prisma.wholesalerProduct.findUnique({where:{id:row.id}});assert.equal(after.stock,3);assert.equal(after.reservedStock,0);
    assert.equal(await prisma.commerceInventoryEvent.count({where:{orderId:orderA.id,kind:'RELEASE'}}),1);
  });
  let sale;
  await check('Shared checkout validates serviceability and reserves stock',async()=>{
    await commerce.addCartItem(orderA.retailerId,product.id,2);
    const cart=await commerce.getCart(orderA.retailerId);
    sale=(await shopping.checkout(orderA.retailerId,{cartId:cart.id})).order;
    assert.equal(sale.paymentMode,'COD');assert.equal(sale.serviceAreaCode,'BIRENDRANAGAR-TEST');
    for(const status of ['CONFIRMED','PROCESSING','PACKED','OUT_FOR_DELIVERY'])await commerce.updateCommerceOrderStatus(sale.id,status,{actorId:admin.id});
    await commerce.addCartItem(b.id,product.id,1);
    const wrong=await shopping.createAddress(b.id,{addressLine1:'Kathmandu',city:'Kathmandu',isDefault:true});
    await assert.rejects(()=>shopping.quote(b.id,{addressId:wrong.id}),/Delivery is not/);
    assert.equal((await shopping.resolveServiceArea('B')).serviceable,false);
  });
  await check('Delivery rejects missing or incorrect cash without reducing inventory',async()=>{
    await assert.rejects(()=>commerce.updateCommerceOrderStatus(sale.id,'DELIVERED',{actorId:admin.id}),/exact COD/);
    await assert.rejects(()=>commerce.updateCommerceOrderStatus(sale.id,'DELIVERED',{actorId:admin.id,cashReceived:1}),/exact COD/);
    assert.equal((await prisma.wholesalerProduct.findUnique({where:{id:row.id}})).stock,3);
  });
  await check('Concurrent delivery retries create exactly one sale, cash receipt and stock deduction',async()=>{
    const args={actorId:admin.id,cashReceived:Number(sale.totalAmount)};
    await Promise.all([commerce.updateCommerceOrderStatus(sale.id,'DELIVERED',args),commerce.updateCommerceOrderStatus(sale.id,'DELIVERED',args)]);
    const after=await prisma.wholesalerProduct.findUnique({where:{id:row.id}});assert.equal(after.stock,1);assert.equal(after.reservedStock,0);
    assert.equal(await prisma.commercePaymentTransaction.count({where:{orderId:sale.id,status:'PAID'}}),1);
    assert.equal((await prisma.order.findUnique({where:{id:sale.id}})).paymentStatus,'PAID');
    assert.equal(await prisma.commerceInventoryEvent.count({where:{orderId:sale.id,kind:'FULFILL'}}),1);
    const sales=await commerce.getSalesDashboard({range:'all'});assert(sales.deliveredOrders>=1);assert(sales.sales>=Number(sale.totalAmount));
  });
  await check('Stock receipts are idempotent and inventory history is immutable',async()=>{
    const ref='test-'+suffix;await inventory.receiveStock(product.id,3,ref,admin.id);await inventory.receiveStock(product.id,3,ref,admin.id);
    assert.equal((await prisma.wholesalerProduct.findUnique({where:{id:row.id}})).stock,4);
    const log=await prisma.commerceInventoryEvent.findUnique({where:{reference:'RECEIPT:'+ref}});
    await assert.rejects(()=>prisma.commerceInventoryEvent.update({where:{id:log.id},data:{quantity:99}}),/immutable/);
    await assert.rejects(()=>prisma.wholesalerProduct.update({where:{id:row.id},data:{stock:-1}}));
  });
  await check('No active service areas fails closed',async()=>{
    await prisma.serviceArea.updateMany({data:{isActive:false}});
    assert.equal((await shopping.resolveServiceArea('Birendranagar')).serviceable,false);
    await prisma.serviceArea.updateMany({data:{isActive:true}});
  });
  const phone='97796'+suffix; // invalid Nepal mobile is intentionally ignored
  await check('Invalid signatures rejected and every signed batch message persisted',async()=>{
    const payload={entry:[{changes:[{value:{metadata:{phone_number_id:'test-business'},messages:[{id:'batch-a-'+suffix,from:a.whatsappNumber,type:'text',text:{body:'menu'}},{id:'batch-b-'+suffix,from:a.whatsappNumber,type:'text',text:{body:'cart'}}]}}]}]};
    assert.equal((await request(app).post('/api/v1/whatsapp/webhook').send(payload)).status,401);
    const raw=JSON.stringify(payload);const sig='sha256='+crypto.createHmac('sha256','test-signature-secret').update(raw).digest('hex');
    assert.equal((await request(app).post('/api/v1/whatsapp/webhook').set('x-hub-signature-256',sig).set('Content-Type','application/json').send(raw)).status,200);
    assert.equal(await prisma.whatsAppInboundEvent.count({where:{providerMessageId:{in:['batch-a-'+suffix,'batch-b-'+suffix]}}}),2);
    await inbox.tick();
  });
  await check('Duplicate inbound command cannot add items twice',async()=>{
    await controller.handleIncomingEvent({provider:'meta',providerMessageId:'catalog-'+suffix,phone:a.whatsappNumber,text:'catalog'});
    const ids=JSON.parse((await prisma.retailer.findUnique({where:{id:a.id}})).catalogProductIds);
    const evt={provider:'meta',providerMessageId:'add-'+suffix,phone:a.whatsappNumber,text:(ids.indexOf(product.id)+1)+'x1'};
    await controller.handleIncomingEvent(evt);await controller.handleIncomingEvent(evt);
    assert.equal((await commerce.getCart(a.id)).items.find(i=>i.productId===product.id).quantity,1);
  });
  await check('Worker failure rolls back cart mutation and restart retries once',async()=>{
    const evt={provider:'meta',providerMessageId:'retry-'+suffix,phone:a.whatsappNumber,text:'test retry'};await inbox.persistEvents([evt]);
    const failing={processEvent:async()=>{await commerce.addCartItem(a.id,product.id,1);const error=new Error('simulated database outage');error.code='TRANSIENT';throw error;}};
    await inbox.processPending(failing);
    assert.equal((await commerce.getCart(a.id)).items.find(i=>i.productId===product.id).quantity,1);
    const pending=await prisma.whatsAppInboundEvent.findUnique({where:{providerMessageId:evt.providerMessageId}});assert.equal(pending.processedAt,null);assert.equal(pending.attempts,1);
    await prisma.whatsAppInboundEvent.update({where:{id:pending.id},data:{nextAttemptAt:new Date(0)}});
    await inbox.processPending({processEvent:async()=>commerce.addCartItem(a.id,product.id,1)});
    await inbox.processPending({processEvent:async()=>commerce.addCartItem(a.id,product.id,1)});
    assert.equal((await commerce.getCart(a.id)).items.find(i=>i.productId===product.id).quantity,2);
  });
  await check('Outbox send failure retries without repeating commerce state',async()=>{
    const messaging=require('../src/services/whatsapp.service');const original=messaging.sendMessage;
    const out=await prisma.whatsAppOutbox.create({data:{sender:'isolated-'+suffix,payload:JSON.stringify({method:'sendMessage',args:['isolated-'+suffix,'retry-proof',{immediate:true}]})}});
    messaging.sendMessage=async(...args)=>{if(args[0]==='isolated-'+suffix)throw new Error('transport offline');return original(...args)};
    await inbox.flushOutbox();assert.equal((await prisma.whatsAppOutbox.findUnique({where:{id:out.id}})).attempts,1);
    messaging.sendMessage=original;await prisma.whatsAppOutbox.update({where:{id:out.id},data:{nextAttemptAt:new Date(0)}});await inbox.flushOutbox();
    assert((await prisma.whatsAppOutbox.findUnique({where:{id:out.id}})).sentAt);
  });
  await check('Native WhatsApp checkout commits order/replies once and rolls back out-of-stock checkout',async()=>{
    const p='97798'+String(require('node:crypto').randomInt(10000000,99999999));
    const event=(id,data)=>({provider:'meta',providerMessageId:'native-'+suffix+'-'+id,phone:p,profileName:'Native customer',...data});
    await controller.handleIncomingEvent(event('hello',{text:'hi'}));
    await controller.handleIncomingEvent(event('cart',{nativeOrder:{catalogId:'TEST-CATALOG',products:[{retailerId:'TEST-RICE-5KG',quantity:2,currency:'NPR'}]}}));
    await controller.handleIncomingEvent(event('zone',{text:'Birendranagar'}));
    await controller.handleIncomingEvent(event('address',{text:'Native Test Chowk, Birendranagar'}));
    const submit=event('checkout',{actionId:'checkout_cod'});
    await controller.handleIncomingEvent(submit);await controller.handleIncomingEvent(submit);
    const nativeCustomer=await prisma.retailer.findUnique({where:{phoneNumber:p}});
    const nativeOrders=await prisma.order.findMany({where:{retailerId:nativeCustomer.id}});assert.equal(nativeOrders.length,1);
    assert.equal((await prisma.wholesalerProduct.findUnique({where:{id:row.id}})).reservedStock,2);
    await controller.handleIncomingEvent(event('oos-cart',{nativeOrder:{catalogId:'TEST-CATALOG',products:[{retailerId:'TEST-RICE-5KG',quantity:100,currency:'NPR'}]}}));
    await controller.handleIncomingEvent(event('oos-checkout',{actionId:'checkout_cod'}));
    assert.equal(await prisma.order.count({where:{retailerId:nativeCustomer.id}}),1);
    assert.equal((await commerce.getCart(nativeCustomer.id)).items[0].quantity,100);
    assert.equal((await prisma.wholesalerProduct.findUnique({where:{id:row.id}})).reservedStock,2);
    assert(await prisma.whatsAppOutbox.count({where:{sender:p}})>0);
    const details=await request(app).get('/api/v1/commerce/admin/orders/'+nativeOrders[0].id).set('Authorization','Bearer '+adminToken);
    assert.equal(details.status,200);assert.equal(details.body.data.items[0].quantity,2);assert(details.body.data.deliveryAddress.includes('Native Test'));
    const list=await request(app).get('/api/v1/commerce/admin/orders?status=ACTIVE&page=1').set('Authorization','Bearer '+adminToken);
    assert.equal(list.status,200);assert(list.body.data.orders.some(o=>o.id===nativeOrders[0].id));
    await commerce.updateCommerceOrderStatus(nativeOrders[0].id,'CANCELLED',{actorId:admin.id});
  });
  await check('Dashboard script is external and served without authentication',async()=>{
    const html=await request(app).get('/commerce-admin');assert.equal(html.status,200);assert(html.text.includes('/assets/commerce-dashboard.js'));assert(!html.text.includes('<script>'));
    assert.equal((await request(app).get('/assets/commerce-dashboard.js')).status,200);
  });
  console.log(JSON.stringify({ok:true,checks:passed.length,passed},null,2));
}
run().catch(error=>{console.error(error.stack);process.exitCode=1}).finally(async()=>{await prisma.$disconnect()});
