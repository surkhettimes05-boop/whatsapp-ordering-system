const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;
const authToken = process.env.TWILIO_AUTH_TOKEN; // set this in env
const publicUrl = process.env.PUBLIC_URL; // set to your public URL (eg https://abcd.ngrok.io)

app.use(bodyParser.urlencoded({ extended: false }));

app.post('/twilio/webhook', (req, res) => {
	// Validate Twilio signature if auth token is present
	const signature = req.header('x-twilio-signature');
	const url = publicUrl ? publicUrl + req.originalUrl : `${req.protocol}://${req.get('host')}${req.originalUrl}`;
	const validator = new twilio.RequestValidator(authToken || '');
	const isValid = authToken ? validator.validate(url, req.body, signature) : true;

	if (!isValid) {
		return res.status(403).send('Invalid Twilio signature');
	}

	const from = req.body.From;
	const body = req.body.Body;

	// Immediate TwiML response so the sender always gets a reply
	const twiml = new twilio.twiml.MessagingResponse();
	twiml.message('Thanks — we received your message and are processing it. You will get an update shortly.');

	// Async/background processing: call your existing message handler here
	(async () => {
		try {
			// ...existing code...
			// Example placeholder:
			// const whatsappHandler = require('./src/controllers/whatsapp.controller');
			// await whatsappHandler.handleIncoming({ from, body, raw: req.body });
			// ...existing code...
		} catch (err) {
			console.error('Background processing error', err);
			// optionally send follow-up message using Twilio REST API if needed
		}
	})();

	res.type('text/xml').send(twiml.toString());
});

app.listen(port, () => {
	console.log(`Twilio webhook server listening on ${port}`);
	if (!authToken) console.warn('TWILIO_AUTH_TOKEN not set — requests will not be validated.');
	if (!publicUrl) console.warn('PUBLIC_URL not set — Twilio validation will use host from request.');
});