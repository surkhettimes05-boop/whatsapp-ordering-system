const path = require('path');
const { spawnSync, spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const setup = spawnSync(process.execPath, [path.join(__dirname, 'seed-test-admin.js')], { cwd: root, stdio: 'inherit' });
if (setup.error) { console.error(setup.error.message); process.exit(1); }
if (setup.status !== 0) process.exit(setup.status || 1);
const server = spawn(process.execPath, [path.join(root, 'src/app.js')], { cwd: root, stdio: 'inherit' });
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.kill(signal));
server.on('error', error => { console.error(error.message); process.exit(1); });
server.on('exit', code => process.exit(code || 0));
