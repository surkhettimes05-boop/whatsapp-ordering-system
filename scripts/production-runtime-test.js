// Executes production configuration against disposable local PostgreSQL and Redis.
// No Meta network requests are made: the provider transport is stubbed explicitly.
const assert=require('node:assert/strict');
if(process.env.RUN_PRODUCTION_RUNTIME_TEST !== 'true') throw new Error('Set RUN_PRODUCTION_RUNTIME_TEST=true only for a disposable database');
Object.assign(process.env,{
 NODE_ENV:'production',USE_REAL_DATABASE:'true',COMMERCE_WHOLESALER_ID:'production-runtime-test',
 ADMIN_PHONE:'9779800000011',ADMIN_PASSWORD:'DisposableTestPassword123',JWT_SECRET:'disposable-production-runtime-test-secret-123456',
 WHATSAPP_PROVIDER:'meta',META_GRAPH_VERSION:'v26.0',META_WHATSAPP_PHONE_NUMBER_ID:'test-business',META_WHATSAPP_ACCESS_TOKEN:'fake-test-token',
 META_WHATSAPP_VERIFY_TOKEN:'fake-test-verify',META_WHATSAPP_APP_SECRET:'fake-test-secret',META_CATALOG_ID:'test-catalog',CATALOG_FEED_TOKEN:'fake-test-feed',
 WHATSAPP_STATUS_TEMPLATE:'fake-test-template',UPLOAD_DIR:'/var/data/whatsapp-runtime-test',PUBLIC_BASE_URL:'https://example.test',PUBLIC_SHOP_URL:'https://example.test',
 CORS_ORIGIN:'https://example.test',REQUIRE_LIVE_PAYMENTS:'false',ENABLE_LEGACY_ROUTES:'false',ENABLE_PROMOTIONS:'false',TRUST_PROXY_HOPS:'0'
});
global.fetch=async url=>{if(!String(url).startsWith('https://graph.facebook.com/')) throw new Error('Unexpected test network request');return {ok:true,json:async()=>({messages:[{id:'stub-provider-message'}]})}};
const request=require('supertest');
const prisma=require('../src/config/database');
const {bootstrap}=require('./bootstrap-production');
const config=require('../src/config/production-readiness');
(async()=>{
 await bootstrap();await bootstrap();
 assert.equal(await prisma.user.count({where:{phoneNumber:process.env.ADMIN_PHONE}}),1);
 assert.throws(()=>config.assertProductionConfiguration({...process.env,REQUIRE_LIVE_PAYMENTS:'true'}),/Live payments/);
 assert.throws(()=>config.assertProductionConfiguration({...process.env,ENABLE_LEGACY_ROUTES:'true'}),/Legacy/);
 assert.throws(()=>config.assertProductionConfiguration({...process.env,CORS_ORIGIN:'*'}),/allowlist/);
 const app=require('../src/app');
 assert.equal((await request(app).get('/health/ready')).status,200);
 const html=await request(app).get('/commerce-admin');assert.equal(html.status,200);
 assert.match(html.headers['content-security-policy'],/script-src 'self'/);
 assert(!html.text.includes('onclick='));assert(!html.text.includes('<script>'));
 const script=await request(app).get('/assets/commerce-dashboard.js');assert.equal(script.status,200);new Function(script.text);
 assert.equal((await request(app).get('/api/v1/commerce/catalog').set('Origin','https://untrusted.example')).status,403);
 const login=await request(app).post('/api/v1/auth/login').send({phoneNumber:process.env.ADMIN_PHONE,password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200);
 const token=login.body.data.token;
 assert.equal((await request(app).get('/api/v1/commerce/admin/sales').set('Authorization','Bearer '+token)).status,200);
 assert.deepEqual((await request(app).get('/api/v1/shopping/payments/providers')).body.data.online,[]);
 require('../src/queue/queue').connection.disconnect();
 assert.equal((await request(app).get('/health/ready')).status,503);
 console.log(JSON.stringify({ok:true,checks:['production bootstrap idempotency','unsafe production settings rejected','real PostgreSQL/Redis readiness','production CSP and external dashboard script','CORS rejection','admin password login and sales','COD-only providers','Redis outage fails readiness']},null,2));
 await prisma.$disconnect();process.exit(0);
})().catch(async error=>{console.error(error.stack);await prisma.$disconnect();process.exit(1)});
