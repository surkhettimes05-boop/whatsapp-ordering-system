const { spawn } = require('child_process');
const localtunnel = require('localtunnel');
const fs = require('fs');
require('dotenv').config();

async function start() {
    console.log('🚀 Starting WhatsApp Backend with LOCALTUNNEL...');

    // 1. Start Backend Server
    const server = spawn('npm', ['run', 'dev'], { shell: true });

    server.stdout.on('data', (data) => {
        console.log(`[Server] ${data.toString()}`);
    });

    server.stderr.on('data', (data) => {
        console.error(`[Server Error] ${data.toString()}`);
    });

    server.on('close', (code) => {
        console.log(`[Server] process exited with code ${code}`);
    });

    // 2. Start localtunnel
    console.log('🔗 Creating public tunnel...');
    try {
        const tunnel = await localtunnel({ port: 5000 });

        console.log('\n==================================================');
        console.log('✅ SERVER & TUNNEL LIVE!');
        console.log('==================================================');
        console.log('\n🔴 IMPORTANT: Copy this URL to Twilio Sandbox:');
        console.log(`\n    ${tunnel.url}/api/v1/whatsapp/webhook\n`);

        // Write to file for Agent/User access
        fs.writeFileSync('tunnel_url.txt', `${tunnel.url}/api/v1/whatsapp/webhook`);

        console.log('1. Go to Twilio Console > Messaging > Sandbox Settings');
        console.log('2. Paste the URL above');
        console.log('3. Save');
        console.log('==================================================\n');

        tunnel.on('close', () => {
            console.log('Tunnel closed');
        });
    } catch (err) {
        console.error('❌ Failed to create tunnel:', err);
    }
}

start();
