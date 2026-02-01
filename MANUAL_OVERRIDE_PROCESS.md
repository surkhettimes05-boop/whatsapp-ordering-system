═══════════════════════════════════════════════════════════════════════════════
  MANUAL OVERRIDE PROCESS - FIELD STAFF GUIDE
═══════════════════════════════════════════════════════════════════════════════

📋 DOCUMENT VERSION: 1.0
📅 EFFECTIVE DATE: January 2026
🎯 OWNER: Operations Team
⏱️ AUTHORIZATION REQUIRED: Supervisor approval for all overrides
⚠️  CRITICAL: Only use when system solutions fail

───────────────────────────────────────────────────────────────────────────────
OVERVIEW: When to use manual overrides
───────────────────────────────────────────────────────────────────────────────

Manual overrides are EMERGENCY procedures when:
✓ System can't process through normal flow
✓ Customer needs immediate resolution
✓ Waiting for system = customer loss/damage
✓ All automatic solutions failed

NEVER use overrides for:
✗ Vendor discounts (use pricing system)
✗ Regular price changes (use pricing system)
✗ Inventory updates (use inventory system)
✗ Convenience when system works fine

BEFORE OVERRIDING:
☐ Check if system solution available
☐ Get supervisor approval
☐ Document reason in detail
☐ Record who authorized override
☐ Track override for audit


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 1: RETRY FAILED ORDER
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Order failed but can be salvaged with manual intervention

STEP 1: DETERMINE FAILURE TYPE

Order ID: ________________
Retailer: ________________
Reason for failure: ________________
  □ Vendor didn't confirm (timeout)
  □ Payment failed (system error)
  □ Delivery not possible (vendor unavailable)
  □ System error (order stuck)
  □ Other: ________________

STEP 2: DIAGNOSIS

Before manual override, confirm:

□ Order still needed by retailer? (call to confirm)
□ Vendor still available? (call to confirm)
□ Payment can be reprocessed? (check payment status)
□ System error temporary or permanent? (retry once in system first)

STEP 3: PREPARATION

☐ Contact retailer: "Your order failed. Want to retry?"
  Retailer response: ________________
  
☐ Contact vendor: "Can you confirm order [ID] if we resend?"
  Vendor response: ________________
  
☐ Verify payment method:
  □ Payment fails again? Get new method
  □ Card declined? Ask for alternate card/method
  □ UPI limit? Use bank transfer
  □ No funds? Offer credit/payment plan

STEP 4: MANUAL PROCESSING

GET SUPERVISOR APPROVAL:

Message to supervisor:
"REQUEST OVERRIDE: Retry order [ID]
 Retailer: [Name]
 Reason: [Reason]
 Vendor confirmed: [YES/NO]
 Payment method: [Method]
 Amount: Rs [Amount]
 Need authorization to process manually"

Supervisor authorization: ________________ Time: ________

STEP 5: MANUAL ORDER CREATION

Go to: Dashboard → ADVANCED → MANUAL ORDER ENTRY

☐ Enter order details:
  • Order ID: [Mark as MANUAL-[original ID]]
  • Retailer: ________________
  • Vendor: ________________
  • Items & quantities: ________________
  • Total amount: Rs ________________
  • Payment status: [Mark as MANUAL VERIFIED]
  
☐ Payment handling:
  • Amount: Rs ________________
  • Method: ________________
  • Reference: ________________
  • Received from: Retailer / Pre-paid / Other
  
☐ Order status:
  • Set as: MANUALLY CONFIRMED
  • By: [Your name]
  • Time: ________________
  • Reason: ________________

☐ Click: CREATE MANUAL ORDER

STEP 6: NOTIFY VENDOR

Message to vendor:
"Manual order created - Order [ID]
 Items: [List]
 Payment verified: YES
 Pickup time: [Time]
 Please confirm"

STEP 7: MONITOR & COMPLETE

☐ Track order through delivery
☐ Resolve any issues
☐ Mark as DELIVERED
☐ Confirm retailer satisfaction
☐ Document final status


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 2: FORCE ORDER STATUS UPDATE
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Order status incorrect in system (marked delivered but isn't, etc.)

STEP 1: IDENTIFY STATUS ISSUE

Order ID: ________________
Current system status: ________________
Actual status: ________________
Time difference: ________________

STEP 2: DIAGNOSIS

□ Why is system status wrong?
  ☐ Delivery partner marked wrong
  ☐ Notification didn't send properly
  ☐ System error/lag
  ☐ Order completed but not updated
  ☐ Order stuck, needs force-move

□ Can you fix through normal process?
  ☐ Contact vendor/driver?
  ☐ Retry confirmation?
  ☐ Wait for system update (if just delay)?

If normal process won't work → Proceed to manual override

STEP 3: VERIFY ACTUAL STATUS

□ Call retailer: "Did you receive order?"
  Response: ________________
  
□ Call vendor: "Did you send order?"
  Response: ________________
  
□ Call delivery partner: "What's order status?"
  Response: ________________

GET CONFIRMATION OF ACTUAL STATUS: ________________

STEP 4: GET SUPERVISOR APPROVAL

Message to supervisor:
"REQUEST OVERRIDE: Force status update
 Order [ID]
 Current status: [System status]
 Actual status: [Real status]
 Reason: [Why override needed]
 Retailer confirmed: [YES/NO]
 Vendor confirmed: [YES/NO]
 Need authorization to update manually"

Supervisor authorization: ________________ Time: ________

STEP 5: MANUAL STATUS UPDATE

Go to: Dashboard → ORDERS → [Order ID] → ADVANCED OPTIONS

☐ Click: FORCE STATUS UPDATE

☐ Select new status from dropdown:
  □ CONFIRMED (if not confirmed yet)
  □ IN DELIVERY (if driver has it)
  □ DELIVERED (if actually delivered)
  □ FAILED (if can't be delivered)
  □ CANCELLED (if order cancelled)

☐ Provide reason:
  Reason: ________________
  
☐ Updated by: [Your name]
  Authorization: [Supervisor name]
  Time: ________________

☐ Click: UPDATE STATUS

STEP 6: NOTIFY STAKEHOLDERS

Message to retailer (if now marked delivered):
"Your order [ID] has been delivered.
 If you haven't received it, please contact us immediately.
 Proof: [Details retailer provided]"

Message to vendor (if status corrected):
"Order [ID] status corrected in system to [status].
 This was manual correction for system error.
 No action needed from you."

STEP 7: SYSTEM DOCUMENTATION

☐ Log the override:
  • Order ID: ________________
  • Original status: ________________
  • New status: ________________
  • Reason: ________________
  • Authorized by: ________________
  • Time: ________________

☐ Follow-up within 24 hours:
  • Confirm actual status matches
  • Check if issue repeated
  • Identify if system bug needs fixing


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 3: APPLY CREDIT/COMPENSATION
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Customer needs compensation (refund, credit, discount) for issue

STEP 1: DETERMINE COMPENSATION TYPE

Reason for compensation:
□ Late delivery
□ Quality issue
□ System error
□ Service failure
□ Other: ________________

What's appropriate:
□ Full refund (100%)
□ Partial refund (%)
□ Store credit
□ Discount on next order
□ Combination

STEP 2: CALCULATE AMOUNT

Standard compensation:
  • Late < 1 hour: 5% discount
  • Late 1-2 hours: 10% discount
  • Late 2-4 hours: 15% discount
  • Late > 4 hours: 25% discount or full refund
  • Quality issue: 15-25% depending on severity
  • Service failure: 20% discount
  • System error: 50% discount (goodwill)

ORDER AMOUNT: Rs ________________
COMPENSATION %: ______%
COMPENSATION AMOUNT: Rs ________________

STEP 3: GET SUPERVISOR APPROVAL

Message to supervisor:
"REQUEST OVERRIDE: Compensation
 Order [ID]
 Retailer: [Name]
 Issue: [Issue]
 Compensation type: [Type]
 Amount: Rs [Amount] (___%)
 Reason for amount: [Justify why this amount]
 Need authorization"

Supervisor authorization: ________________ Time: ________

STEP 4: APPLY COMPENSATION

Go to: Dashboard → ORDERS → [Order ID] → COMPENSATION

☐ Select compensation type:
  □ Refund (back to payment method)
  □ Credit (store credit for future orders)
  □ Discount (% off this order)
  □ Combination

☐ Enter details:
  • Compensation type: ________________
  • Amount: Rs ________________
  • Percentage: _____%
  • Reason: ________________
  • Authorized by: [Supervisor name]
  • Applied by: [Your name]
  • Time: ________________

☐ If REFUND:
  • Process via original payment method
  • Time to appear: 2-3 business days
  • Reference number: ________________

☐ If CREDIT:
  • Add to retailer's account
  • Retailer can use on next order
  • Expires in: 60 days

☐ If DISCOUNT:
  • Reduce order total immediately
  • Affect vendor payment: Rs [amount] deducted

STEP 5: NOTIFY CUSTOMER

Message to retailer:
"We've applied compensation for [issue]:
 Order [ID]
 Compensation: [Type]
 Amount: Rs [Amount]
 [Details about how to use credit/when refund appears]
 
 Sorry for the inconvenience!
 We value your business."

STEP 6: UPDATE VENDOR (if applicable)

If vendor's payment reduced due to compensation:

Message to vendor:
"Order [ID] - Compensation applied due to [issue]
 Your payment reduced by: Rs [Amount]
 This was [full/partial] refund to retailer
 [Explanation]"

STEP 7: DOCUMENTATION

☐ Record in system:
  • Compensation reason
  • Amount & type
  • Authorized by
  • Date & time
  • Impact on vendor/retailer

☐ Flag for audit:
  • If > 3 compensations to same party → escalate
  • If pattern emerges → investigate vendor/delivery


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 4: VENDOR REASSIGNMENT (SAVE FAILED ORDER)
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Original vendor can't deliver, reassign to backup vendor

STEP 1: IDENTIFY SITUATION

Original Order ID: ________________
Original Vendor: ________________
Reason vendor can't fulfill:
  □ Out of stock
  □ Vendor unreachable
  □ Vendor cancelled
  □ Vendor quality issue
  □ Other: ________________

STEP 2: ASSESS RETAILER SITUATION

Retailer: ________________
Items needed: ________________
Time urgency: ________________
Retailer's preference: □ Same-day (if possible)  □ Any time OK  □ Refund OK

STEP 3: FIND BACKUP VENDOR

Go to: Dashboard → VENDORS → INVENTORY

Search for vendors who have ALL items:
  Item 1: ________________ → Vendors: ________________
  Item 2: ________________ → Vendors: ________________
  Item 3: ________________ → Vendors: ________________
  
Vendors with ALL items: ________________

Check availability:
  Backup vendor 1: ________________
  ☐ Has stock: [YES/NO]
  ☐ Can supply same-day: [YES/NO]
  ☐ Rating: ______ / 5
  ☐ Response time: ______ min

Backup vendor 2: ________________
  ☐ Has stock: [YES/NO]
  ☐ Can supply same-day: [YES/NO]
  ☐ Rating: ______ / 5
  ☐ Response time: ______ min

STEP 4: CONFIRM WITH BACKUP VENDOR

Call backup vendor:
"Can you supply [items] by [time] for order replacement?"

Vendor response: ________________
Confirmation: ☐ YES / ☐ NO
If yes, timeline: ________________

If vendor says NO:
→ Try next backup vendor
→ Repeat until find willing vendor
→ If no vendor available → Proceed to refund

STEP 5: GET SUPERVISOR APPROVAL

Message to supervisor:
"REQUEST OVERRIDE: Vendor reassignment
 Original order [ID]
 Retailer: [Name]
 Original vendor: [Vendor] - couldn't fulfill ([reason])
 Backup vendor: [Vendor] - confirmed available
 
 Plan: Create new order with backup vendor
       Cancel original order & refund original vendor fee
       
 Need authorization"

Supervisor authorization: ________________ Time: ________

STEP 6: CREATE NEW ORDER WITH BACKUP VENDOR

Go to: Dashboard → ORDERS → MANUAL ENTRY

☐ Create new order:
  • Retailer: [Same]
  • Vendor: [Backup vendor]
  • Items: [Same as original]
  • Quantities: [Same as original]
  • Price: [Backup vendor's price] (may be different)
  • Order type: REPLACEMENT FOR [Original Order ID]
  • Status: CONFIRMED (pre-confirmed with vendor)

☐ Payment handling:
  • Use original order's payment
  • If price difference:
    - If cheaper: Credit to retailer (they save)
    - If more expensive: Get retailer approval
  
☐ Delivery:
  • Same delivery address as original
  • Pickup time: ________________
  • Target delivery: ________________

STEP 7: CANCEL ORIGINAL ORDER

Go to: Dashboard → ORDERS → [Original Order ID]

☐ Mark status: CANCELLED - VENDOR REASSIGNMENT
☐ Reason: ________________
☐ Replacement order: [New Order ID]
☐ Refund original vendor fee: [YES/NO]

STEP 8: NOTIFY ALL PARTIES

Message to original vendor:
"Order [ID] - Cancelled due to your unavailability
 Reassigned to alternative vendor
 Your payment for this order: Rs 0
 (We value your partnership - next order coming soon!)"

Message to backup vendor:
"New order [ID] created
 Items: [List]
 Payment verified
 Pickup time: [Time]
 Please confirm"

Message to retailer:
"Your order [ID] has been reassigned
 Reason: Original vendor unavailable
 New vendor: [Vendor name]
 Same items, same price (or updated price: Rs ____)
 Pickup time: [Time]
 Estimated delivery: [Time]
 
 We apologize for the change and appreciate your patience!"

STEP 9: MONITOR NEW ORDER

☐ Track completion of new order
☐ Ensure on-time delivery
☐ Quality check with retailer
☐ Document outcome


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 5: EMERGENCY PRICE OVERRIDE
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Price needs immediate change for specific order/customer

⚠️  WARNING: Overrides affect profit margins. Use only when necessary.

STEP 1: IDENTIFY PRICE ISSUE

Situation: ________________
  □ Retailer price dispute (says charged wrong)
  □ Competitor undercuts us (need to match)
  □ Bulk order (volume discount needed)
  □ Loyal customer special (goodwill)
  □ Other: ________________

Order/items affected: ________________
Current price: Rs ________________
Requested/target price: Rs ________________
Difference: Rs ________________ (___%)

STEP 2: EVALUATE REQUEST

□ Is request legitimate?
□ Is margin still acceptable at new price?
  Current vendor cost: Rs ________________
  Proposed retail price: Rs ________________
  Margin: Rs ________________ (___%)
  Minimum acceptable margin: 10%
  Is this OK? ☐ YES / ☐ NO

If NO - Can't approve. Explain to customer.

STEP 3: CHECK COMPETITOR PRICING (if undercutting reason)

Competitor: ________________
Their price: Rs ________________
Our current price: Rs ________________
Difference: Rs ________________
Why we're higher: ________________
  □ Quality difference
  □ Delivery speed
  □ Reliability
  □ No good reason - we need to match

STEP 4: GET SUPERVISOR APPROVAL

Message to supervisor:
"REQUEST OVERRIDE: Price adjustment
 Situation: [Situation]
 Items: [Items]
 Current price: Rs [Current]
 Requested price: Rs [Requested]
 Discount: Rs [Amount] (__%)
 
 Reason: [Reason]
 Vendor margin impact: Rs [Margin]
 Platform margin impact: Rs [Margin]
 
 Retailer: [Retailer name]
 Order size: [Size]
 Retailer value: [High/Medium/Low]
 
 Need authorization"

Supervisor authorization: ________________ Time: ________

STEP 5: COMMUNICATE WITH RETAILER

Approved discount? ☐ YES / ☐ PARTIAL / ☐ NO

If YES:
"Special price approved for you!
 Item: [Item]
 Regular price: Rs ________
 Special price: Rs ________ (You save Rs ____)
 Valid for: [Timeframe - today/this week/etc]
 Order now to lock in this price!"

If PARTIAL (smaller discount than requested):
"We can offer you a special price:
 Item: [Item]
 Regular price: Rs ________
 Special price: Rs ________ (Discount: _____%)
 This is our best offer - thanks for your business!"

If NO:
"We appreciate your business!
 We can't discount on this item, but:
 Option 1: Bulk purchase gets 5% discount (min ___ units)
 Option 2: Try alternative item at similar price
 Option 3: Subscribe for weekly delivery - get member discount
 Let's find a way to make this work!"

STEP 6: APPLY PRICE OVERRIDE IN SYSTEM

Go to: Dashboard → ORDERS → PRICE OVERRIDE

☐ Order/Item details:
  • Retailer: ________________
  • Items: ________________
  • Original price: Rs ________________
  • Override price: Rs ________________
  
☐ Reason:
  □ Competitive matching
  □ Volume discount
  □ Goodwill/VIP customer
  □ Approval error correction
  □ Other: ________________

☐ Validity:
  • Valid for: [This order / Today / This week]
  • Valid for: [This retailer / All retailers]
  • Expires: ________________

☐ Authorization:
  • Approved by: [Supervisor name]
  • Override by: [Your name]
  • Timestamp: ________________

☐ Click: APPLY OVERRIDE

STEP 7: NOTIFY VENDOR (if their price affected)

If reducing vendor payment:

Message to vendor:
"Order [ID] - Special pricing applied
 Item: [Item]
 Customer price: Rs ________
 Your payment: Rs ________ (vs normal [amount])
 Reason: [Reason]
 This is one-time for this retailer"

STEP 8: DOCUMENT FOR AUDIT

☐ Record override details
☐ Flag for pricing review if pattern emerges
☐ Check if repeated overrides to same retailer
  (If YES → May need formal contract/pricing structure)


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE TYPE 6: FORCE DELIVERY REATTEMPT
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Delivery failed (retailer unavailable, door locked, etc.) - retry

STEP 1: UNDERSTAND FAILURE

Order ID: ________________
Delivery partner: ________________
Driver name: ________________
Delivery time: ________________
Failure reason:
  □ Retailer not available
  □ Retailer location locked
  □ Retailer address wrong
  □ Retailer refused delivery
  □ Other: ________________

Current order status: ________________

STEP 2: CONTACT RETAILER

Call retailer:
"Your order [ID] couldn't be delivered. Reason: [Reason]
 Can we redeliver? When would be good?"

Retailer response: ________________
Retailer availability:
  □ Available now: ________________
  □ Available later today: ________________ (time)
  □ Available tomorrow: ________________ (time)
  □ Wants refund: ________________

STEP 3: PREPARE REATTEMPT

If retailer wants reattempt:

□ Confirm location/address with retailer:
  Location: ________________
  Access instructions: ________________
  Best contact person: ________________
  Best phone: ________________

□ Confirm with delivery partner:
  "Can you redeliver order [ID]?"
  "Time: ________________"
  
Delivery partner response: ________________

If delivery partner can't reattempt:
→ Assign to backup driver
→ Or arrange customer pickup


STEP 4: GET SUPERVISOR APPROVAL (if > 2 reattempts)

If this is 2nd+ attempt:

Message to supervisor:
"REQUEST OVERRIDE: Force delivery reattempt
 Order [ID]
 Attempt #: ___
 Previous failures: [Reasons]
 Retailer confirmed available: [YES/NO]
 Time: ________________
 Driver assigned: ________________
 
 Need authorization to continue"

Supervisor authorization: ________________ Time: ________

STEP 5: UPDATE DELIVERY STATUS IN SYSTEM

Go to: Dashboard → ORDERS → [Order ID] → DELIVERY

☐ Mark status: DELIVERY REATTEMPT
☐ Attempt number: ______
☐ Scheduled time: ________________
☐ Driver: ________________
☐ Special instructions: ________________
  (e.g., "Door code: 1234", "Ask for Raj at reception")

STEP 6: COORDINATE DELIVERY

Message to driver:
"Order [ID] - REATTEMPT DELIVERY
 Location: [Address]
 Instructions: [Special instructions]
 Retailer phone: [Contact]
 Time: [Time]
 
 IMPORTANT: Confirm before leaving.
 If can't access again, call immediately.
 DO NOT leave at wrong place."

Message to retailer:
"Your order is on its way for redelivery!
 Driver: [Driver name]
 Vehicle: [Vehicle]
 Expected time: [Time]
 Driver contact: [Phone]
 
 Please be available to receive.
 If issue, call driver immediately."

STEP 7: MONITOR REATTEMPT

☐ Track delivery in real-time
☐ Check status every 15 min
☐ If driver can't deliver again:
  - Get explanation from driver
  - Contact retailer immediately
  - Determine if 3rd attempt possible or refund needed


STEP 8: FINAL OUTCOME

If successful delivery:
☐ Mark as DELIVERED
☐ Get retailer confirmation
☐ Close order
☐ Message: "Order delivered successfully!"

If failed again:
☐ Mark as DELIVERY FAILED
☐ Offer options:
  - 3rd attempt (if retailer agrees)
  - Refund (full or partial)
  - Store credit
☐ Document reason: ________________


═══════════════════════════════════════════════════════════════════════════════
OVERRIDE LOG & AUDIT TRAIL
═══════════════════════════════════════════════════════════════════════════════

ALL OVERRIDES MUST BE LOGGED FOR AUDIT

Date: ________________
Logged by: ________________

OVERRIDE #1
  Type: ________________
  Order/Retailer/Vendor: ________________
  Reason: ________________
  Supervisor approval: ________________
  Amount/Impact: Rs ________________ / _____%
  Timestamp: ________________
  Outcome: ________________

OVERRIDE #2
  Type: ________________
  Order/Retailer/Vendor: ________________
  Reason: ________________
  Supervisor approval: ________________
  Amount/Impact: Rs ________________ / _____%
  Timestamp: ________________
  Outcome: ________________

OVERRIDE #3
  Type: ________________
  Order/Retailer/Vendor: ________________
  Reason: ________________
  Supervisor approval: ________________
  Amount/Impact: Rs ________________ / _____%
  Timestamp: ________________
  Outcome: ________________

TOTAL OVERRIDES TODAY: ______
TOTAL IMPACT: Rs ________________


═══════════════════════════════════════════════════════════════════════════════
🎯 CRITICAL RULES FOR OVERRIDES
───────────────────────────────────────────────────────────────────────────────

✓ ALWAYS get supervisor approval before override
✓ ALWAYS document reason in detail
✓ ALWAYS log for audit trail
✓ ALWAYS notify affected parties
✓ NEVER override for personal reasons
✓ NEVER override if system solution available
✓ NEVER make up authorization
✓ NEVER override without timestamp
✓ TRACK patterns - if same issue repeating → escalate for system fix
✓ MINIMIZE overrides - high frequency = need system change

═══════════════════════════════════════════════════════════════════════════════
