const app = require('../src/app');

function listRoutes(router, prefix = '') {
  const routes = [];
  const stack = router.stack || (router._router && router._router.stack) || [];
  for (const layer of stack) {
    if (layer.route && layer.route.path) {
      const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
      routes.push(`${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const newPrefix = prefix + (layer.regexp && layer.regexp.fast_slash ? '' : (layer.regexp && layer.regexp.fast_star ? '' : ''));
      // Attempt to derive path
      const path = layer.regexp && layer.regexp.source ? layer.regexp.source : '<router>';
      // Recurse into nested router
      for (const l of layer.handle.stack) {
        if (l.route && l.route.path) {
          const methods = Object.keys(l.route.methods).join(',').toUpperCase();
          routes.push(`${methods} ${prefix}${path} -> ${l.route.path}`);
        }
      }
    }
  }
  return routes;
}

console.log('Inspecting top-level routes...');
const routes = listRoutes(app);
for (const r of routes) console.log(r);

// Try to access internal mount for /api/v1/admin
try {
  const adminRouter = require('../src/routes/admin.routes');
  console.log('\nInspecting admin.routes definitions:');
  const adminRoutes = listRoutes(adminRouter);
  for (const r of adminRoutes) console.log(r);
} catch (e) {
  console.error('Failed to load admin.routes:', e.message);
}
