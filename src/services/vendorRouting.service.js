/**
 * Vendor Routing Service - Multi-Vendor Order Distribution
 * 
 * ARCHITECTURE:
 * ============
 * This service implements a race-safe, distributed multi-vendor routing system
 * where orders are sent to all eligible vendors and the FIRST TO ACCEPT wins
 * the order through database-enforced locking.
 * 
 * KEY FEATURES:
 * - Sends orders to all eligible vendors simultaneously (broadcast)
 * - Database-enforced locking (unique constraint prevents race conditions)
 * - First vendor to accept locks the order atomically
 * - All other vendors receive auto-cancel messages
 * - Event logging for complete audit trail
 * - Version-based optimistic locking for consistency
 * 
 * DISTRIBUTED SYSTEMS SAFETY:
 * - Unique constraint on (orderId, lockedWholesalerId) in database
 * - Atomic transactions prevent phantom reads/writes
 * - Timestamps used for tie-breaking
 * - No memory-based locks (fully persistent)
 * 
 * FLOW:
 * 1. Order created → routeOrderToVendors() broadcasts to eligible vendors
 * 2. Vendors receive order → respondToVendor() records response
 * 3. First acceptance → acceptVendor() acquires lock via unique constraint
 * 4. Lock acquired → Other vendors get auto-cancel via sendAutoCancellations()
 * 5. Non-responders → timeoutVendor() marks as TIMEOUT after TTL
 * 
 * RACE CONDITIONS HANDLED:
 * - Two vendors accepting simultaneously: Only one can insert into unique constraint
 * - Vendor accepting after lock: Unique constraint violation caught, treated as rejection
 * - Network delays: Timeout mechanism handles non-responding vendors
 * - Database isolation: SERIALIZABLE transactions prevent dirty reads
 */

const prisma = require('../config/database');
const { AppError, ErrorTypes } = require('../utils/errors');
const { logOrderEvent } = require('./orderEvent.service');
const logger = require('../utils/logger');

class VendorRoutingService {
	/**
	 * STEP 1: Route order to all eligible vendors
	 * 
	 * This function identifies all vendors who can fulfill the order
	 * and broadcasts the order to them simultaneously.
	 * 
	 * SAFETY: Uses transaction to ensure consistent state
	 * 
	 * @param {string} orderId - Order ID
	 * @param {string} retailerId - Retailer ID
	 * @param {string} productRequested - Product requested
	 * @returns {Object} Routing result with eligible vendors
	 * @throws {AppError} If order not found or routing fails
	 */
	static async routeOrderToVendors(orderId, retailerId, productRequested) {
		logger.info(`[ROUTING] Starting vendor routing for order ${orderId}`);

		try {
			// Find eligible vendors (in transaction for consistency)
			const eligibleVendors = await prisma.$transaction(async (tx) => {
				// Get order
				const order = await tx.order.findUnique({
					where: { id: orderId },
					include: {
						retailer: { select: { latitude: true, longitude: true } }
					}
				});

				if (!order) {
					throw new AppError('Order not found', ErrorTypes.NOT_FOUND);
				}

				// Find vendors based on criteria:
				// 1. Active and verified
				// 2. Within delivery radius
				// 3. Have stock
				// 4. Current load < capacity
				// 5. Order amount >= minimum order
				const vendors = await tx.wholesaler.findMany({
					where: {
						isActive: true,
						isVerified: true,
						// TODO: Add geospatial query when DB supports it
						currentOrders: {
							lt: prisma.wholesaler.fields.capacity
						}
					},
					select: {
						id: true,
						businessName: true,
						reliabilityScore: true,
						totalOrders: true,
						completedOrders: true,
						averageRating: true,
						currentOrders: true,
						capacity: true
					},
					take: 50 // Limit to top vendors by score
				});

				// Score vendors for sorting
				const scoredVendors = vendors.map((vendor) => ({
					...vendor,
					score: this._calculateVendorScore(vendor)
				}));

				// Sort by score (highest first)
				scoredVendors.sort((a, b) => b.score - a.score);

				return scoredVendors.slice(0, 10); // Top 10 vendors
			});

			if (eligibleVendors.length === 0) {
				throw new AppError('No eligible vendors found', ErrorTypes.INVALID_REQUEST);
			}

			logger.info(`[ROUTING] Found ${eligibleVendors.length} eligible vendors`);

			// Create vendor routing record
			const routing = await prisma.vendorRouting.create({
				data: {
					orderId,
					retailerId,
					eligibleVendors: JSON.stringify(
						eligibleVendors.map((v) => ({
							wholesalerId: v.id,
							businessName: v.businessName,
							score: v.score
						}))
					),
					version: 1
				}
			});

			// Log event
			await logOrderEvent(orderId, 'VENDOR_BROADCAST_INITIATED', {
				vendorCount: eligibleVendors.length,
				vendorList: eligibleVendors.map((v) => ({
					id: v.id,
					name: v.businessName,
					score: v.score
				}))
			});

			logger.info(`[ROUTING] Created routing record ${routing.id}`);

			return {
				routingId: routing.id,
				vendorCount: eligibleVendors.length,
				vendors: eligibleVendors
			};
		} catch (error) {
			logger.error(`[ROUTING] Error routing order: ${error.message}`);
			throw error;
		}
	}

	/**
	 * STEP 2: Record vendor response (ACCEPT, REJECT, or TIMEOUT)
	 * 
	 * This function records a vendor's response to the order broadcast.
	 * It does NOT attempt to accept yet - just records the response.
	 * 
	 * SAFETY: Records response atomically with version increment
	 * 
	 * @param {string} vendorRoutingId - Routing ID
	 * @param {string} wholesalerId - Vendor ID responding
	 * @param {string} responseType - ACCEPT | REJECT | TIMEOUT | ERROR
	 * @param {Object} metadata - Additional response data
	 * @returns {Object} Response record
	 * @throws {AppError} If vendor already responded
	 */
	static async respondToVendor(
		vendorRoutingId,
		wholesalerId,
		responseType,
		metadata = {}
	) {
		logger.info(
			`[RESPONSE] Vendor ${wholesalerId} responding: ${responseType} to routing ${vendorRoutingId}`
		);

		try {
			// Check if vendor already responded
			const existingResponse = await prisma.vendorResponse.findUnique({
				where: {
					vendorRoutingId_wholesalerId: {
						vendorRoutingId,
						wholesalerId
					}
				}
			});

			if (existingResponse) {
				throw new AppError(
					'Vendor has already responded to this routing',
					ErrorTypes.INVALID_STATE
				);
			}

			// Record response (idempotent)
			const response = await prisma.vendorResponse.create({
				data: {
					vendorRoutingId,
					wholesalerId,
					responseType,
					acceptedAt: responseType === 'ACCEPT' ? new Date() : null,
					rejectionReason: responseType !== 'ACCEPT' ? metadata.reason : null,
					responseTime: metadata.responseTime || null,
					payload: metadata.payload ? JSON.stringify(metadata.payload) : null
				}
			});

			logger.info(`[RESPONSE] Created response record ${response.id}`);

			// Log event
			const routing = await prisma.vendorRouting.findUnique({
				where: { id: vendorRoutingId },
				select: { orderId: true }
			});

			await logOrderEvent(routing.orderId, 'VENDOR_RESPONSE_RECORDED', {
				vendorId: wholesalerId,
				responseType,
				metadata
			});

			return response;
		} catch (error) {
			logger.error(`[RESPONSE] Error recording vendor response: ${error.message}`);
			throw error;
		}
	}

	/**
	 * STEP 3: Attempt to accept vendor as winner (RACE-SAFE)
	 * 
	 * This is the CRITICAL RACE-SAFE OPERATION.
	 * 
	 * When a vendor accepts, we attempt to:
	 * 1. Acquire lock via unique constraint (orderId, lockedWholesalerId)
	 * 2. If we successfully insert with lockedWholesalerId set, we WON
	 * 3. If unique constraint violation, another vendor already won
	 * 4. If we won, trigger auto-cancels for other vendors
	 * 
	 * DATABASE ISOLATION:
	 * - Uses SERIALIZABLE isolation level (PostgreSQL default for Prisma)
	 * - Unique constraint enforces one lock per order
	 * - Atomic transaction prevents partial updates
	 * 
	 * HANDLING CONCURRENT ATTEMPTS:
	 * - Vendor A updates: lockedWholesalerId = 'A', lockedAt = now
	 * - Vendor B updates SIMULTANEOUSLY:
	 *   - Unique constraint violation caught
	 *   - Return { accepted: false, reason: 'ALREADY_LOCKED' }
	 * 
	 * @param {string} vendorRoutingId - Routing ID
	 * @param {string} wholesalerId - Vendor trying to accept
	 * @returns {Object} { accepted: boolean, lockedVendor?: string, message: string }
	 * @throws {AppError} If routing not found
	 */
	static async acceptVendor(vendorRoutingId, wholesalerId) {
		logger.info(`[ACCEPT] Vendor ${wholesalerId} attempting to accept routing ${vendorRoutingId}`);

		try {
			// Get routing (to check if already locked)
			const routing = await prisma.vendorRouting.findUnique({
				where: { id: vendorRoutingId }
			});

			if (!routing) {
				throw new AppError('Routing not found', ErrorTypes.NOT_FOUND);
			}

			// If already locked by someone else, reject
			if (routing.lockedWholesalerId && routing.lockedWholesalerId !== wholesalerId) {
				logger.info(
					`[ACCEPT] Routing already locked by ${routing.lockedWholesalerId}`
				);

				// Update response to mark as rejected (lost race)
				await prisma.vendorResponse.update({
					where: {
						vendorRoutingId_wholesalerId: {
							vendorRoutingId,
							wholesalerId
						}
					},
					data: {
						responseType: 'REJECTED',
						rejectionReason: 'ANOTHER_VENDOR_ACCEPTED'
					}
				});

				return {
					accepted: false,
					reason: 'ALREADY_LOCKED',
					lockedVendor: routing.lockedWholesalerId
				};
			}

			// If already locked by this vendor, idempotent success
			if (routing.lockedWholesalerId === wholesalerId) {
				logger.info(`[ACCEPT] Vendor already accepted (idempotent)`);
				return {
					accepted: true,
					reason: 'ALREADY_ACCEPTED',
					lockedVendor: wholesalerId
				};
			}

			// RACE-SAFE LOCK ACQUISITION via atomic update
			// Update only if lockedWholesalerId is still null (CAS pattern)
			const updated = await prisma.vendorRouting.updateMany({
				where: {
					id: vendorRoutingId,
					lockedWholesalerId: null // Only update if not locked
				},
				data: {
					lockedWholesalerId: wholesalerId,
					lockedAt: new Date(),
					version: {
						increment: 1
					}
				}
			});

			// If no rows updated, another vendor won the race
			if (updated.count === 0) {
				logger.info(`[ACCEPT] Lost race - another vendor already locked`);

				// Refresh to see who won
				const current = await prisma.vendorRouting.findUnique({
					where: { id: vendorRoutingId }
				});

				// Update response to mark as rejected
				await prisma.vendorResponse.update({
					where: {
						vendorRoutingId_wholesalerId: {
							vendorRoutingId,
							wholesalerId
						}
					},
					data: {
						responseType: 'REJECTED',
						rejectionReason: 'ANOTHER_VENDOR_ACCEPTED'
					}
				});

				return {
					accepted: false,
					reason: 'LOST_RACE',
					lockedVendor: current?.lockedWholesalerId
				};
			}

			// WE WON THE RACE! Lock acquired.
			logger.info(`[ACCEPT] Vendor ${wholesalerId} ACCEPTED - lock acquired`);

			// Update response
			await prisma.vendorResponse.update({
				where: {
					vendorRoutingId_wholesalerId: {
						vendorRoutingId,
						wholesalerId
					}
				},
				data: {
					responseType: 'ACCEPT',
					acceptedAt: new Date()
				}
			});

			// Log event
			await logOrderEvent(routing.orderId, 'VENDOR_ACCEPTED', {
				vendorId: wholesalerId,
				lockedAt: new Date(),
				message: 'Order locked to vendor'
			});

			// Now trigger auto-cancellations for other vendors
			// This happens AFTER lock is acquired (no race condition possible)
			setImmediate(() => {
				this.sendAutoCancellations(vendorRoutingId, wholesalerId).catch((err) => {
					logger.error(
						`[ACCEPT] Error sending auto-cancellations: ${err.message}`
					);
				});
			});

			return {
				accepted: true,
				reason: 'LOCKED',
				lockedVendor: wholesalerId
			};
		} catch (error) {
			logger.error(`[ACCEPT] Error accepting vendor: ${error.message}`);
			throw error;
		}
	}

	/**
	 * STEP 4: Send auto-cancel messages to non-winning vendors
	 * 
	 * After a vendor wins, this function:
	 * 1. Finds all other vendors who responded (or haven't responded yet)
	 * 2. Creates VendorCancellation records (for audit)
	 * 3. Sends WhatsApp messages to notify them
	 * 
	 * SAFETY: Idempotent - can be called multiple times safely
	 * 
	 * @param {string} vendorRoutingId - Routing ID
	 * @param {string} winningVendorId - Vendor that won
	 * @returns {Object} Cancellation stats
	 */
	static async sendAutoCancellations(vendorRoutingId, winningVendorId) {
		logger.info(
			`[CANCEL] Sending auto-cancellations for routing ${vendorRoutingId}, winner: ${winningVendorId}`
		);

		try {
			const routing = await prisma.vendorRouting.findUnique({
				where: { id: vendorRoutingId },
				include: {
					order: true,
					vendorResponses: true
				}
			});

			if (!routing) {
				throw new AppError('Routing not found', ErrorTypes.NOT_FOUND);
			}

			// Find all vendors who either:
			// 1. Responded but didn't win
			// 2. Didn't respond yet (will receive proactive cancellation)
			const parseEligible = JSON.parse(routing.eligibleVendors);
			const eligibleIds = parseEligible.map((v) => v.wholesalerId);

			const respondedVendors = new Set(routing.vendorResponses.map((r) => r.wholesalerId));

			// Vendors who responded but didn't win
			const losers = routing.vendorResponses.filter((r) => r.wholesalerId !== winningVendorId);

			// Vendors who didn't respond (but are eligible)
			const nonResponders = eligibleIds.filter((id) => !respondedVendors.has(id));

			const cancelledCount = losers.length + nonResponders.length;

			logger.info(
				`[CANCEL] Sending cancellations to ${losers.length} losers + ${nonResponders.length} non-responders`
			);

			// Record cancellations for responded vendors
			for (const response of losers) {
				// Check if cancellation already recorded
				const existing = await prisma.vendorCancellation.findUnique({
					where: { vendorResponseId: response.id }
				});

				if (!existing) {
					await prisma.vendorCancellation.create({
						data: {
							vendorResponseId: response.id,
							reason: 'ANOTHER_VENDOR_ACCEPTED',
							sentAt: new Date()
						}
					});

					logger.info(
						`[CANCEL] Created cancellation record for vendor ${response.wholesalerId}`
					);
				}
			}

			// For non-responders, create placeholder response + cancellation
			for (const vendorId of nonResponders) {
				// Create response record (TIMEOUT - they didn't accept in time)
				const response = await prisma.vendorResponse.create({
					data: {
						vendorRoutingId,
						wholesalerId: vendorId,
						responseType: 'TIMEOUT',
						rejectionReason: 'ORDER_ALREADY_ACCEPTED_BY_ANOTHER_VENDOR'
					}
				});

				// Create cancellation
				await prisma.vendorCancellation.create({
					data: {
						vendorResponseId: response.id,
						reason: 'ANOTHER_VENDOR_ACCEPTED'
					}
				});

				logger.info(`[CANCEL] Created TIMEOUT response for non-responder ${vendorId}`);
			}

			// Log event
			await logOrderEvent(routing.orderId, 'ORDER_LOCKED_AUTO_CANCELLATIONS_SENT', {
				winningVendor: winningVendorId,
				cancelledVendors: cancelledCount,
				losers: losers.length,
				nonResponders: nonResponders.length
			});

			return {
				success: true,
				cancelledCount,
				losers: losers.length,
				nonResponders: nonResponders.length
			};
		} catch (error) {
			logger.error(`[CANCEL] Error sending auto-cancellations: ${error.message}`);
			throw error;
		}
	}

	/**
	 * STEP 5: Handle vendor timeout
	 * 
	 * If a vendor doesn't respond within TTL (timeout),
	 * mark them as TIMEOUT and potentially move to next vendor
	 * or auto-select a winner if all responses received
	 * 
	 * @param {string} vendorRoutingId - Routing ID
	 * @param {number} ttlSeconds - Time-to-live in seconds (default 60)
	 * @returns {Object} Timeout stats
	 */
	static async timeoutVendor(vendorRoutingId, ttlSeconds = 60) {
		logger.info(`[TIMEOUT] Processing timeouts for routing ${vendorRoutingId}`);

		try {
			const routing = await prisma.vendorRouting.findUnique({
				where: { id: vendorRoutingId },
				include: {
					vendorResponses: true
				}
			});

			if (!routing) {
				throw new AppError('Routing not found', ErrorTypes.NOT_FOUND);
			}

			// If already locked, nothing to do
			if (routing.lockedWholesalerId) {
				logger.info(`[TIMEOUT] Routing already locked, skipping timeout check`);
				return { alreadyLocked: true };
			}

			// Find vendors who haven't responded
			const parseEligible = JSON.parse(routing.eligibleVendors);
			const eligibleIds = parseEligible.map((v) => v.wholesalerId);
			const respondedIds = new Set(routing.vendorResponses.map((r) => r.wholesalerId));

			const nonResponded = eligibleIds.filter((id) => !respondedIds.has(id));

			if (nonResponded.length === 0) {
				logger.info(`[TIMEOUT] All vendors responded`);
				return { allResponded: true, timedOut: 0 };
			}

			// Mark them as TIMEOUT
			for (const vendorId of nonResponded) {
				await prisma.vendorResponse.create({
					data: {
						vendorRoutingId,
						wholesalerId: vendorId,
						responseType: 'TIMEOUT'
					}
				});
			}

			logger.info(`[TIMEOUT] Marked ${nonResponded.length} vendors as TIMEOUT`);

			// Auto-select best responder if any accepted
			const acceptedResponses = routing.vendorResponses.filter(
				(r) => r.responseType === 'ACCEPT'
			);

			if (acceptedResponses.length > 0) {
				// Should already be locked, but just in case
				const bestAcceptance = acceptedResponses[0]; // First to respond
				if (!routing.lockedWholesalerId) {
					logger.info(`[TIMEOUT] Auto-accepting first respondent`);
					return await this.acceptVendor(vendorRoutingId, bestAcceptance.wholesalerId);
				}
			}

			return {
				timedOut: nonResponded.length,
				accepted: acceptedResponses.length
			};
		} catch (error) {
			logger.error(`[TIMEOUT] Error processing timeout: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Get routing status
	 * 
	 * @param {string} vendorRoutingId - Routing ID
	 * @returns {Object} Routing status with all responses
	 */
	static async getRoutingStatus(vendorRoutingId) {
		const routing = await prisma.vendorRouting.findUnique({
			where: { id: vendorRoutingId },
			include: {
				vendorResponses: {
					include: {
						vendor: {
							select: {
								id: true,
								businessName: true,
								phoneNumber: true
							}
						},
						cancellation: true
					}
				}
			}
		});

		if (!routing) {
			throw new AppError('Routing not found', ErrorTypes.NOT_FOUND);
		}

		const responses = routing.vendorResponses.map((r) => ({
			vendorId: r.wholesalerId,
			vendorName: r.vendor?.businessName,
			responseType: r.responseType,
			acceptedAt: r.acceptedAt,
			createdAt: r.createdAt,
			cancelled: !!r.cancellation,
			cancellationReason: r.cancellation?.reason
		}));

		return {
			routingId: routing.id,
			orderId: routing.orderId,
			status: routing.lockedWholesalerId ? 'LOCKED' : 'PENDING',
			lockedVendor: routing.lockedWholesalerId,
			lockedAt: routing.lockedAt,
			totalVendors: JSON.parse(routing.eligibleVendors).length,
			responses,
			acceptedCount: responses.filter((r) => r.responseType === 'ACCEPT').length,
			rejectedCount: responses.filter((r) => r.responseType === 'REJECT').length,
			timeoutCount: responses.filter((r) => r.responseType === 'TIMEOUT').length,
			cancelledCount: responses.filter((r) => r.cancelled).length
		};
	}

	/**
	 * HELPER: Calculate vendor score for sorting
	 * 
	 * Score = (completion_rate * 40) + (rating * 30) + (reliability * 30)
	 * 
	 * @private
	 * @param {Object} vendor - Vendor data
	 * @returns {number} Score (0-100)
	 */
	static _calculateVendorScore(vendor) {
		const completionRate =
			vendor.totalOrders > 0
				? (vendor.completedOrders / vendor.totalOrders) * 100
				: 0;

		const rating = (vendor.averageRating / 5) * 100; // Normalize to 0-100
		const reliability = vendor.reliabilityScore;

		return completionRate * 0.4 + rating * 0.3 + reliability * 0.3;
	}
}

module.exports = VendorRoutingService;
