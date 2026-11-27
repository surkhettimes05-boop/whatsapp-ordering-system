const { reviewBasket } = require('../src/services/manualBasket');
const items = [{id:'a',quantity:5,priceAtOrder:'25.00'},{id:'b',quantity:1,priceAtOrder:'240.00'}];
test('full availability preserves basket',()=>expect(reviewBasket(items,[{id:'a',quantity:5},{id:'b',quantity:1}],30)).toMatchObject({outcome:'CONFIRMABLE',total:'395.00'}));
test('partial availability requires approval',()=>expect(reviewBasket(items,[{id:'a',quantity:2},{id:'b',quantity:0}],30)).toMatchObject({outcome:'CUSTOMER_APPROVAL_REQUIRED',total:'80.00'}));
test('empty basket is rejected without fee',()=>expect(reviewBasket(items,[{id:'a',quantity:0},{id:'b',quantity:0}],30)).toMatchObject({outcome:'REJECTED',total:'0.00'}));
test.each([[{id:'a',quantity:6},{id:'b',quantity:1}],[{id:'a',quantity:-1},{id:'b',quantity:1}],[{id:'a',quantity:1},{id:'a',quantity:1}],[{id:'a',quantity:1},{id:'c',quantity:1}],[{id:'a',quantity:1.5},{id:'b',quantity:1}]])('rejects invalid review %#',(...args)=>expect(()=>reviewBasket(items,args)).toThrow());
