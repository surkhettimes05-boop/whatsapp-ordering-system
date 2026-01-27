// Order Event Service - Simple logging
const prisma = require('../config/database');
const logger = require('../utils/logger');

async function logOrderEvent(orderId, eventType, payload = {}) {
	try {
		const event = await prisma.orderEvent.create({
			data: {
				orderId,
				eventType,
				payload: JSON.stringify(payload)
			}
		});

		logger.info(`[EVENT] ${eventType} for order ${orderId}`);
		return event;
	} catch (error) {
		logger.error(`Error logging event: ${error.message}`);
		// Don't throw - event logging should not break the flow
	}
}

module.exports = {
	logOrderEvent
};
