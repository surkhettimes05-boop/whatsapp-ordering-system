/**
 * Fake Twilio Mock Server
 * 
 * Simulates Twilio WhatsApp API for local development
 * Logs all messages instead of sending them
 */

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store messages in memory
const messages = [];

/**
 * Mock: Send WhatsApp Message
 * POST /2010-04-01/Accounts/:AccountSid/Messages.json
 */
app.post('/2010-04-01/Accounts/:accountSid/Messages.json', (req, res) => {
    const message = {
        sid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
        from: req.body.From,
        to: req.body.To,
        body: req.body.Body,
        status: 'sent',
        direction: 'outbound-api',
        timestamp: new Date().toISOString()
    };

    messages.push(message);

    console.log('📤 Mock Twilio: Message Sent');
    console.log(`   From: ${message.from}`);
    console.log(`   To: ${message.to}`);
    console.log(`   Body: ${message.body}`);
    console.log('');

    res.json({
        sid: message.sid,
        date_created: message.timestamp,
        date_updated: message.timestamp,
        date_sent: message.timestamp,
        account_sid: req.params.accountSid,
        to: message.to,
        from: message.from,
        messaging_service_sid: null,
        body: message.body,
        status: 'queued',
        num_segments: '1',
        num_media: '0',
        direction: 'outbound-api',
        api_version: '2010-04-01',
        price: null,
        price_unit: 'USD',
        error_code: null,
        error_message: null,
        uri: `/2010-04-01/Accounts/${req.params.accountSid}/Messages/${message.sid}.json`
    });
});

/**
 * Mock: Get Message
 * GET /2010-04-01/Accounts/:AccountSid/Messages/:MessageSid.json
 */
app.get('/2010-04-01/Accounts/:accountSid/Messages/:messageSid.json', (req, res) => {
    const message = messages.find(m => m.sid === req.params.messageSid);

    if (!message) {
        return res.status(404).json({
            code: 20404,
            message: 'The requested resource was not found',
            more_info: 'https://www.twilio.com/docs/errors/20404',
            status: 404
        });
    }

    res.json({
        sid: message.sid,
        date_created: message.timestamp,
        date_updated: message.timestamp,
        date_sent: message.timestamp,
        account_sid: req.params.accountSid,
        to: message.to,
        from: message.from,
        body: message.body,
        status: 'delivered',
        num_segments: '1',
        num_media: '0',
        direction: message.direction,
        api_version: '2010-04-01',
        price: '-0.00750',
        price_unit: 'USD',
        error_code: null,
        error_message: null,
        uri: `/2010-04-01/Accounts/${req.params.accountSid}/Messages/${message.sid}.json`
    });
});

/**
 * Mock: List Messages
 * GET /2010-04-01/Accounts/:AccountSid/Messages.json
 */
app.get('/2010-04-01/Accounts/:accountSid/Messages.json', (req, res) => {
    res.json({
        messages: messages.map(m => ({
            sid: m.sid,
            date_created: m.timestamp,
            date_updated: m.timestamp,
            date_sent: m.timestamp,
            account_sid: req.params.accountSid,
            to: m.to,
            from: m.from,
            body: m.body,
            status: 'delivered',
            direction: m.direction,
            api_version: '2010-04-01',
            price: '-0.00750',
            price_unit: 'USD'
        })),
        uri: `/2010-04-01/Accounts/${req.params.accountSid}/Messages.json`,
        first_page_uri: `/2010-04-01/Accounts/${req.params.accountSid}/Messages.json?Page=0&PageSize=50`,
        next_page_uri: null,
        previous_page_uri: null,
        page: 0,
        page_size: 50
    });
});

/**
 * Simulate incoming webhook (for testing)
 * POST /simulate-incoming
 */
app.post('/simulate-incoming', (req, res) => {
    const { From, To, Body } = req.body;

    console.log('📥 Mock Twilio: Simulating Incoming Message');
    console.log(`   From: ${From}`);
    console.log(`   To: ${To}`);
    console.log(`   Body: ${Body}`);
    console.log('');

    // Send webhook to backend
    const webhookUrl = process.env.BACKEND_WEBHOOK_URL || 'http://backend:3000/api/v1/whatsapp/webhook';

    fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            From,
            To,
            Body,
            MessageSid: `SM${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
            AccountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
        })
    })
        .then(() => {
            res.json({ success: true, message: 'Webhook triggered' });
        })
        .catch(error => {
            res.status(500).json({ success: false, error: error.message });
        });
});

/**
 * Dashboard to view messages
 * GET /
 */
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Fake Twilio Mock Server</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                .message { border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px; }
                .outbound { background: #e3f2fd; }
                .inbound { background: #f3e5f5; }
                .timestamp { color: #666; font-size: 12px; }
                form { margin: 20px 0; padding: 15px; border: 2px solid #4CAF50; border-radius: 5px; }
                input, textarea { width: 100%; padding: 8px; margin: 5px 0; }
                button { background: #4CAF50; color: white; padding: 10px 20px; border: none; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>📱 Fake Twilio Mock Server</h1>
            <p>Total Messages: ${messages.length}</p>

            <h2>Simulate Incoming Message</h2>
            <form action="/simulate-incoming" method="POST">
                <label>From (WhatsApp Number):</label>
                <input type="text" name="From" value="whatsapp:+9779800000001" required>
                
                <label>To (Your Twilio Number):</label>
                <input type="text" name="To" value="whatsapp:+1234567890" required>
                
                <label>Message Body:</label>
                <textarea name="Body" rows="3" required>Hello, I want to order rice</textarea>
                
                <button type="submit">Send Incoming Message</button>
            </form>

            <h2>Message Log</h2>
            ${messages.reverse().map(m => `
                <div class="message ${m.direction === 'outbound-api' ? 'outbound' : 'inbound'}">
                    <strong>${m.direction === 'outbound-api' ? '📤 Outbound' : '📥 Inbound'}</strong><br>
                    <strong>From:</strong> ${m.from}<br>
                    <strong>To:</strong> ${m.to}<br>
                    <strong>Body:</strong> ${m.body}<br>
                    <span class="timestamp">${m.timestamp}</span>
                </div>
            `).join('')}
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Fake Twilio Mock Server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`📥 Simulate incoming: POST http://localhost:${PORT}/simulate-incoming`);
});
