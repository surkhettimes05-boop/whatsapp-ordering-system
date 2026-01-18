/**
 * Get ngrok URL from API
 */

const http = require('http');

console.log('🔍 Fetching ngrok URL...\n');

const options = {
  hostname: 'localhost',
  port: 4040,  // ngrok web interface
  path: '/api/tunnels',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const tunnels = JSON.parse(data);
      
      console.log('═'.repeat(70));
      console.log('\n✅ NGROK IS RUNNING!\n');
      
      if (tunnels.tunnels && tunnels.tunnels.length > 0) {
        tunnels.tunnels.forEach(tunnel => {
          console.log(`Public URL: ${tunnel.public_url}`);
          console.log(`Protocol: ${tunnel.proto}`);
          console.log(`Status: ${tunnel.status}`);
          console.log();
        });
        
        const httpsUrl = tunnels.tunnels.find(t => t.proto === 'https');
        if (httpsUrl) {
          console.log('═'.repeat(70));
          console.log('\n🎯 COPY THIS URL:\n');
          console.log(`${httpsUrl.public_url}`);
          console.log();
          console.log('═'.repeat(70));
          console.log('\n📝 NEXT STEPS:\n');
          console.log('1. Go to: https://console.twilio.com');
          console.log('2. Messaging → Settings → Webhook URL');
          console.log(`3. Paste: ${httpsUrl.public_url}/api/v1/whatsapp/webhook`);
          console.log('4. Method: POST');
          console.log('5. Click SAVE');
          console.log('\n6. Send WhatsApp to: +1 (415) 523-8886');
          console.log('7. Say: "hi"');
          console.log('8. Check server logs for reply ✅\n');
        }
      } else {
        console.log('⚠️  No tunnels found');
      }
      
    } catch (error) {
      console.log('❌ Error parsing ngrok response:', error.message);
      console.log('\nMake sure ngrok is running:');
      console.log('  cd C:\\ngrok');
      console.log('  .\\ngrok http 5000');
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Cannot connect to ngrok');
  console.log(`Error: ${error.message}`);
  console.log('\nngrok might not be running.');
  console.log('Start it with:');
  console.log('  cd C:\\ngrok');
  console.log('  .\\ngrok http 5000');
});

req.end();
