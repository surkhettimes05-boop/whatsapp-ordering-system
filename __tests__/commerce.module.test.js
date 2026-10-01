const commerceService = require('../src/services/commerce.service');

describe('commerce service module', () => {
  test('exports catalog, cart, checkout and sales operations', () => {
    expect(typeof commerceService.listCatalog).toBe('function');
    expect(typeof commerceService.getCart).toBe('function');
    expect(typeof commerceService.addCartItem).toBe('function');
    expect(typeof commerceService.checkoutCart).toBe('function');
    expect(typeof commerceService.getSalesDashboard).toBe('function');
    expect(typeof commerceService.getDailyReconciliation).toBe('function');
  });
});
