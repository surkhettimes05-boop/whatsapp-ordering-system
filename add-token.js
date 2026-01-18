const fs = require('fs');
const path = require('path');

const token = process.argv[2];

if (!token) {
    console.error('❌ Please provide your ngrok token.');
    console.log('Usage: node add-token.js YOUR_NGROK_TOKEN');
    process.exit(1);
}

const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
}

// Remove existing token if it exists
envContent = envContent.replace(/^NGROK_AUTHTOKEN=.*$/m, '');

// Append new token
envContent += `\nNGROK_AUTHTOKEN=${token}\n`;

fs.writeFileSync(envPath, envContent.trim() + '\n');

console.log('✅ NGROK_AUTHTOKEN has been added to your .env file!');
console.log('🚀 You can now run: node start-with-tunnel.js');
