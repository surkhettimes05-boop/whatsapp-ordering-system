const axios = require('axios');
const fs = require('fs');

async function checkTunnel() {
    try {
        const urlFile = fs.readFileSync('tunnel_url.txt', 'utf8').trim();
        console.log(`Checking URL: ${urlFile}`);

        console.log('Sending packet...');
        const res = await axios.post(urlFile, {
            From: 'whatsapp:+9779800000000',
            Body: 'Tunnel Check',
            ProfileName: 'Tester'
        });

        console.log(`✅ Tunnel Alive! Response: ${res.status}`);
    } catch (error) {
        console.log(`❌ Tunnel Check Failed: ${error.message}`);
        if (error.response) console.log(`   Status: ${error.response.status}`);
    }
}

checkTunnel();
