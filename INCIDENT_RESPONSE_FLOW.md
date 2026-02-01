═══════════════════════════════════════════════════════════════════════════════
  INCIDENT RESPONSE FLOW - FIELD OPERATIONS GUIDE
═══════════════════════════════════════════════════════════════════════════════

📋 DOCUMENT VERSION: 1.0
📅 EFFECTIVE DATE: January 2026
🎯 OWNER: Operations Team & Support
⏱️ RESPONSE TIME TARGETS: 15 min (alert), 30 min (first contact), 2 hr (resolution)

───────────────────────────────────────────────────────────────────────────────
QUICK INCIDENT CLASSIFICATION
───────────────────────────────────────────────────────────────────────────────

When an incident occurs, IMMEDIATELY identify type:

🔴 CRITICAL (Respond in 5 min):
  • System down / Server offline
  • Payment gateway not working
  • All orders stuck in system
  • WhatsApp integration offline
  • Database corrupted

🟠 HIGH (Respond in 15 min):
  • Order stuck 2+ hours without confirmation
  • Payment failure affecting multiple orders
  • Vendor no-shows (multiple orders)
  • Quality issue from major vendor
  • Customer data issue

🟡 MEDIUM (Respond in 30 min):
  • Single vendor cancellation
  • Single payment failure (easy fix)
  • Quality issue from single order
  • Late delivery (< 1 hour delay)
  • Communication failure

🟢 LOW (Respond in 2 hours):
  • Retailer has question
  • Vendor wants price change
  • Feedback/suggestion
  • Minor system issue


═══════════════════════════════════════════════════════════════════════════════
INCIDENT REPORTING - START HERE
═══════════════════════════════════════════════════════════════════════════════

STEP 1: IDENTIFY THE PROBLEM

When you notice an issue, ask:
  1. WHAT is the problem?
     _________________________________________________
  
  2. WHO is affected?
     □ Single retailer
     □ Multiple retailers
     □ Single vendor
     □ Multiple vendors
     □ System-wide
     Number affected: ______
  
  3. WHEN did it start?
     Time: ________________
     Duration: ________________
  
  4. WHAT is the impact?
     □ Orders not placed
     □ Orders not confirmed
     □ Payment not processed
     □ Delivery delayed
     □ Quality issue
     □ System error
  
  5. WHAT is the scale?
     □ 1 order
     □ 5-10 orders
     □ 10-50 orders
     □ 50+ orders / System-wide

STEP 2: CLASSIFY SEVERITY

Based on answers above:
  ☐ CRITICAL (🔴) → Escalate immediately
  ☐ HIGH (🟠) → Handle quickly
  ☐ MEDIUM (🟡) → Handle within 30 min
  ☐ LOW (🟢) → Handle within 2 hours


STEP 3: NOTIFY TEAM

☐ Critical incident:
   → Call team lead IMMEDIATELY
   → Send WhatsApp message
   → Alert tech team
   → Document time: _______

☐ High incident:
   → Notify supervisor
   → Send team message
   → Document time: _______

☐ Medium/Low incident:
   → Log in system
   → Document time: _______


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 1: ORDER DELIVERY FAILURE
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Order not delivered on time or marked failed

STEP 1: GATHER INFORMATION
  □ Order ID: ________________
  □ Retailer: ________________
  □ Vendor: ________________
  □ Promised delivery time: ________________
  □ Current time: ________________
  □ Delay duration: ________________
  □ Last known status: ________________
  □ Delivery partner: ________________

STEP 2: DETERMINE ROOT CAUSE

  ASK THESE QUESTIONS:

  A) Was order confirmed by vendor?
     ☐ YES → Continue to B
     ☐ NO → Go to SECTION: VENDOR NOT RESPONDING

  B) Did order leave vendor?
     ☐ YES → Continue to C
     ☐ NO → Go to SECTION: VENDOR REFUSES TO SEND

  C) Is it in delivery?
     ☐ YES → Continue to D
     ☐ NO → Go to SECTION: ORDER LOST/STUCK

  D) Has delivery driver confirmed?
     ☐ YES → Continue to E
     ☐ NO → Go to SECTION: DELIVERY PARTNER ISSUE

  E) Can driver reach retailer location?
     ☐ YES → DELIVERY IMMINENT
     ☐ NO → Go to SECTION: ADDRESS ISSUE / ACCESS DENIED


STEP 3: HANDLE SPECIFIC SCENARIOS

─────────────────────────────────────────────────────────────────────────────
SCENARIO A: VENDOR NOT RESPONDING TO ORDER

  Action 1: Contact vendor immediately
  □ Try WhatsApp message: "Order [ID] - Did you receive? Please confirm"
  □ Wait 5 minutes for response
  
  If NO response:
  □ Call vendor (phone)
  □ Reason for no response: ________________
  
  Response options:
  □ A1: "Yes, I'll prepare it" → Confirm time needed
  □ A2: "I can partially supply" → Ask which items
  □ A3: "I can't supply" → Go to REASSIGNMENT
  □ A4: No response after 15 min → Go to FALLBACK VENDOR

  Action 2: If partial supply
  □ Contact retailer: "Vendor can supply X but not Y. Proceed? Refund Y?"
  □ Wait for retailer decision
  □ Update order accordingly

  Action 3: If vendor can't supply
  □ Find alternative vendor with same items
  □ Confirm alternative can supply
  □ Update retailer: "Original vendor unavailable. Using [Vendor2]"
  □ Mark original order cancelled (with proper handling)
  □ Create new order with alternate vendor

  Action 4: If no response after 15 minutes
  □ Mark vendor as "UNRESPONSIVE"
  □ Contact backup vendor
  □ Reassign order
  □ Document time: _______


─────────────────────────────────────────────────────────────────────────────
SCENARIO B: VENDOR REFUSES TO SEND ORDER

  Reason for refusal: ________________
  
  If reason = OUT OF STOCK:
  □ Update vendor's inventory immediately
  □ Mark items as unavailable
  □ Contact retailer: "Items unavailable. Refund or alternative?"
  □ Refund if retailer requests
  □ Document issue: ________________
  □ Note for future: This vendor has stock issues
  
  If reason = QUALITY ISSUE:
  □ Ask: "What quality issue?" ________________
  □ Document concern
  □ Contact retailer: "Vendor reports quality issue. Continuing with caution..."
  □ OR offer alternative vendor
  
  If reason = PAYMENT NOT RECEIVED:
  □ Check vendor payment status
  □ If payment missing: Process immediately
  □ Confirm with vendor: Payment sent
  □ Vendor should proceed with order
  □ Escalate payment issue to finance
  
  If reason = PERSONAL:
  □ Ask vendor to reconsider
  □ Offer incentive: "Priority next order" / "Bonus"
  □ If still refuses: Find alternative vendor
  □ Contact retailer with update


─────────────────────────────────────────────────────────────────────────────
SCENARIO C: ORDER LOST/STUCK

  Last known status: ________________
  Time in this status: ________________
  
  Action 1: Check system
  □ Go to Dashboard → Orders → [Order ID]
  □ Check order status history
  □ Look for last update: ________________
  □ Time difference from now: ________________
  
  Action 2: Contact vendor
  □ "Where is order [ID]? Last status: [Status]"
  □ Vendor response: ________________
  
  Possible responses:
  □ C1: "We sent it at [time]" → Contact delivery partner
  □ C2: "It's still at our place" → Ask why? Resolve delay
  □ C3: "We'll send it now" → Wait and monitor
  □ C4: "We can't send it" → Reassign order
  
  Action 3: If at vendor location
  □ Issue: ________________
  □ Time needed to resolve: ________________
  □ Contact retailer: "Your order delayed. New ETA: ________"
  □ If > 3 hours late: Offer 10-15% discount
  □ If > 5 hours late: Offer 25% discount or refund
  
  Action 4: Check delivery partner
  □ Did delivery partner pick up?
  □ When was pickup: ________________
  □ Is it in vehicle: ________________
  □ Current location: ________________


─────────────────────────────────────────────────────────────────────────────
SCENARIO D: DELIVERY PARTNER ISSUE

  Delivery partner: ________________
  Driver name: ________________
  Vehicle: ________________
  
  Action 1: Contact driver
  □ "Where is order [ID]?" 
  □ Driver response: ________________
  
  Common issues:
  □ D1: Traffic delay → ETA: ________________
  □ D2: Vehicle breakdown → New driver assigned?
  □ D3: Driver not responding → Call logistics manager
  □ D4: Delivered but not marked → Update system
  
  Action 2: If traffic delay
  □ Current location: ________________
  □ Distance to destination: ________________
  □ Estimated arrival: ________________
  □ Contact retailer with ETA
  □ Monitor for updates every 10 min
  
  Action 3: If vehicle breakdown
  □ When?: ________________
  □ Can vehicle be fixed?: ________________
  □ Alternative driver being sent?: ________________
  □ New ETA: ________________
  □ If > 4 hours delay: Offer compensation
  
  Action 4: If driver not responding
  □ Contact logistics manager immediately
  □ Status of order: ________________
  □ Can another driver take over?: ________________
  □ Mark as "HIGH PRIORITY" to new driver
  □ Set ETA: ________________
  
  Action 5: After delivery
  □ Mark in system as DELIVERED
  □ Update delivery time
  □ Get retailer confirmation
  □ Close order


─────────────────────────────────────────────────────────────────────────────
SCENARIO E: ADDRESS ISSUE / ACCESS DENIED

  Reason: ________________
  □ Address incorrect
  □ Retailer location closed
  □ Building locked
  □ Gate locked
  □ Retailer not available
  □ Other: ________________
  
  Action 1: Contact retailer
  □ "Driver can't access your location. Issue: ________"
  □ What's the problem?
  □ How to resolve?: ________________
  
  Action 2: Possible solutions
  □ E1: Address wrong → Get correct address
  □ E2: Closed temporarily → When will open?
  □ E3: Gate locked → Send unlock code? Or reschedule?
  □ E4: Not available → Can family member receive?
  □ E5: Access issue → Meet driver at nearby location?
  
  Action 3: If can't resolve
  □ Tell retailer: Order will be returned
  □ Venue: "When do you want redelivery?" OR "Refund?"
  □ If refund: Process immediately
  □ If redeliver: Schedule next day, morning confirmed
  
  Action 4: Send driver updated instructions
  □ New address OR
  □ Rescheduled time OR
  □ New arrangement (meet outside, etc.)
  □ Confirm with driver before proceeding


STEP 4: RESOLUTION & FOLLOW-UP

After resolving delivery issue:

☐ Update retailer:
  Message: "Your order is [delivered/on the way/rescheduled]. Thanks!"

☐ Update vendor:
  Message: "Order [ID] complete. Thanks for your service."

☐ Update delivery partner:
  Message: "Delivery complete."

☐ Check if compensation needed:
  □ Was delay > 1 hour? → 10% discount
  □ Was delay > 2 hours? → 15% discount
  □ Was delay > 4 hours? → 25% discount or full refund
  □ Apply compensation in system

☐ Document incident:
  Time to resolve: ________________ min
  Actions taken: ________________
  Compensation given: Rs ________________
  Lesson learned: ________________

☐ Rate vendor/driver performance:
  Vendor rating: _____ (out of 5)
  Driver rating: _____ (out of 5)
  
  If low rating (< 3): Investigate further


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 2: PAYMENT FAILURE
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Retailer or vendor payment failed

STEP 1: IDENTIFY PAYMENT TYPE

☐ Retailer payment (for order)
  → Order should not be placed until payment confirmed
  → If failed: Order stuck or need manual payment
  
☐ Vendor settlement (weekly/monthly)
  → Vendor expecting payment on [date]
  → Payment didn't arrive

STEP 2: FOR RETAILER PAYMENT FAILURE

  Order ID: ________________
  Retailer: ________________
  Amount: Rs ________________
  Payment method: □ Card  □ UPI  □ Bank Transfer  □ Other
  Error message: ________________

  Action 1: Check payment gateway status
  □ Go to Dashboard → Payments → Status
  □ Is payment gateway online: ☑️ YES / ☐ NO
  □ If NO → Contact tech team
  
  Action 2: Contact retailer
  □ "Payment failed for order [ID]. Reason: ________"
  □ Ask: What do you want to do?
  □ Options:
     ☐ Retry payment (same method)
     ☐ Use different payment method
     ☐ Process as manual/later payment
     ☐ Cancel order and refund
  
  Action 3: If retry payment
  □ Process again
  □ If succeeds → Confirm with retailer
  □ If fails again → Try alternate method
  
  Action 4: If using alternate method
  □ Take manual payment details
  □ Process payment
  □ Mark as "manual payment - verified"
  □ Document: ________________
  
  Action 5: If order cancelled
  □ Notify vendor order cancelled
  □ Refund retailer (if pre-paid)
  □ Update retailer
  □ Document reason: Payment issue
  
  Action 6: If payment gateway down
  □ Hold order temporarily
  □ Contact tech team: "Payment gateway offline"
  □ Wait for restoration (usually 15-30 min)
  □ Once restored: Retry payment
  □ If still failing: Use manual payment process


STEP 3: FOR VENDOR SETTLEMENT FAILURE

  Vendor: ________________
  Settlement amount: Rs ________________
  Payment date: ________________
  Days overdue: ________________
  
  Action 1: Verify payment processing
  □ Check if payment was initiated: ☐ YES / ☐ NO
  □ Check bank transfer status
  □ Check vendor bank account details
  
  If not initiated:
  □ Immediately process payment
  □ Document reason for delay: ________________
  
  Action 2: If payment initiated but not received
  □ Contact bank: "Payment [ID] not received"
  □ Get reference number: ________________
  □ Bank status: ________________
  □ Estimated arrival: ________________
  □ Provide reference to vendor
  
  Action 3: Contact vendor
  □ "Your payment [date] has been processed"
  □ Amount: Rs ________________
  □ Reference number: ________________
  □ "It should arrive in your bank in 2-3 business days"
  □ "Please confirm once received"
  
  Action 4: If payment delayed > 5 days
  □ Escalate to finance manager
  □ Investigate issue
  □ Process manual payment if needed
  □ Offer compensation: Rs ________ (processing fee)
  
  Action 5: Follow-up
  □ Once received: Get vendor confirmation
  □ Update vendor in system: "Payment received ✓"
  □ Document resolution time: ________________ days


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 3: QUALITY COMPLAINT
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Retailer receives bad quality products

STEP 1: GATHER COMPLAINT DETAILS

  Retailer: ________________
  Order ID: ________________
  Vendor: ________________
  Product: ________________
  Issue: □ Damaged  □ Stale  □ Wrong item  □ Quantity short  □ Other
  Description: ________________________
  When discovered: ________________
  Photo provided: ☐ YES / ☐ NO

STEP 2: CLASSIFY SEVERITY

  ☐ Minor (fixable)
    • 1-2 items damaged / wrong
    • Partial solution possible
    • Retailer can use rest
  
  ☐ Major (replacement needed)
    • > 50% items damaged / wrong
    • Unusable for sale
    • Full replacement needed
  
  ☐ Critical (refund needed)
    • 100% items damaged / unusable
    • Health/safety concern
    • Full refund + compensation

STEP 3: DOCUMENT COMPLAINT

  □ Take retailer's statement
  □ Ask for photo evidence
  □ Note exact issue: ________________
  □ Retailer signature/confirmation: ________________

STEP 4: CONTACT VENDOR

  Message to vendor:
  "Order [ID] - Quality complaint from [Retailer]:
   Product: [Product]
   Issue: [Issue]
   Photo attached
   
   Please explain or confirm replacement needed"
  
  Wait for vendor response: ________________
  
  Vendor's explanation: ________________

STEP 5: RESOLVE BASED ON VENDOR RESPONSE

  A) If vendor acknowledges issue:
     □ Offer replacement
     □ Schedule pickup from vendor
     □ Arrange redelivery to retailer
     □ Timeline: ________________
     □ Cost: Vendor bears cost (no charge to retailer)
  
  B) If vendor disputes issue:
     □ Ask vendor: "How do you explain this?"
     □ Request vendor's photo evidence
     □ If both have photos → Compare and decide
     □ If vendor refuses to help:
        → Automatically refund retailer
        → Deduct from vendor payment
        → Issue vendor warning
  
  C) If issue is health/safety:
     □ Immediately remove vendor's inventory
     □ Do NOT use this vendor today
     □ Full investigation required
     □ Escalate to management
     □ Possible vendor deactivation

STEP 6: COMPENSATION & RESOLUTION

  Based on severity:
  
  ☐ Minor issue:
    • Vendor provides 1 free unit next order
    • Retailer satisfied: ☐ YES / ☐ NO
  
  ☐ Major issue:
    • Vendor provides replacement immediately
    • Retailer gets 10% discount on this order
    • Time to redeliver: ________________
  
  ☐ Critical issue:
    • Vendor provides full replacement
    • Retailer gets 25% refund on this order
    • Free delivery on replacement
    • Vendor gets formal warning
  
  If vendor refuses to compensate:
  □ We refund retailer
  □ Deduct from vendor's payment
  □ Issue vendor suspension warning

STEP 7: FOLLOW-UP

  Next day:
  □ Check if replacement received (if applicable)
  □ Ask retailer: Satisfied? ☐ YES / ☐ NO
  □ If not satisfied → Escalate further
  
  Record:
  □ Vendor rating impact: -1 point
  □ If repeated issues: Vendor deactivation threshold reached?
  □ Document for vendor performance review


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 4: VENDOR CANCELLATION
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Vendor cancels order after confirming

STEP 1: IMMEDIATE ACTIONS

  Time now: ________________
  When was order confirmed: ________________
  How late is cancellation: ________________
  
  ☐ CRITICAL IF: < 1 hour before delivery
  ☐ HIGH IF: 1-3 hours before delivery
  ☐ MEDIUM IF: > 3 hours before delivery

STEP 2: CONTACT VENDOR IMMEDIATELY

  Message: "Order [ID] - Why are you cancelling?"
  
  Vendor response: ________________
  
  Common reasons:
  □ Stock issue (unavailable)
  □ Quality concern (products bad)
  □ Personal emergency
  □ Payment not received
  □ Communication issue (didn't understand order)
  □ No reason given

STEP 3: TRY TO SAVE ORDER

  Ask vendor: "Can you reconsider?"
  □ Do you have ANY of the items? (partial supply)
  □ Can you supply by later time?
  □ What would help you proceed?
  
  If vendor willing to proceed:
  □ Confirm new timeline: ________________
  □ Give retail incentive for inconvenience
  □ Monitor order closely
  
  If vendor adamant about cancellation:
  → Proceed to Step 4

STEP 4: CONTACT RETAILER

  Message: "Your order [ID] - Vendor cancelled for reason: ________"
  
  Options offered:
  ☐ A) Alternative vendor available (different vendor, same products)
  ☐ B) Partial supply from same vendor
  ☐ C) Full refund + 20% credit (refund + compensation)
  ☐ D) Wait for order next day (rescheduled)
  
  Get retailer choice: ________________

STEP 5: EXECUTE RETAILER'S CHOICE

  A) Alternative vendor:
     □ Find vendor with same items
     □ Confirm they have stock
     □ Create new order
     □ Process payment (no additional charge)
     □ Notify retailer: New order [ID] processing
  
  B) Partial supply:
     □ Ask vendor which items they can provide
     □ Ask retailer: Accept partial? Refund rest?
     □ If yes → Create new partial order
     □ Refund for missing items
  
  C) Full refund + credit:
     □ Process full refund to retailer
     □ Add 20% credit to retailer account
     □ Message: "Order cancelled by vendor. Full refund + Rs [X] credit"
  
  D) Rescheduled for next day:
     □ Contact vendor: Confirm available tomorrow
     □ Get commitment from vendor
     □ Message to retailer: "Rescheduled for tomorrow morning"
     □ Mark order status: RESCHEDULED

STEP 6: VENDOR PENALTY

  Record cancellation:
  ☐ Vendor: ________________
  ☐ Cancellation date: ________________
  ☐ Reason: ________________
  ☐ Retailer impact: ________________
  
  Penalty structure:
  • 1st cancellation → Warning + rating -0.5
  • 2nd cancellation → Warning + rating -1.0
  • 3rd cancellation → Possible suspension review
  • 5+ cancellations → Account deactivation
  
  Current cancellation count: ______
  Action: ________________

STEP 7: SYSTEM UPDATE

  □ Mark original order: CANCELLED BY VENDOR
  □ Record reason: ________________
  □ Refund retailer if applicable
  □ Deduct from vendor's payment: No charge
  □ Update vendor rating
  □ Document in vendor file


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 5: SYSTEM/TECHNICAL FAILURE
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: System down, orders stuck, WhatsApp not working, etc.

STEP 1: DETERMINE SYSTEM STATUS

  What's not working:
  □ Orders can't be placed
  □ Orders not visible
  □ WhatsApp notifications not sending
  □ Payment gateway not responding
  □ Database slow/unresponsive
  □ Server down (completely offline)
  □ Other: ________________
  
  When did it start: ________________
  Time now: ________________
  Duration: ________________
  
  SEVERITY:
  ☐ Low: Feature slow but working
  ☐ Medium: Feature intermittent
  ☐ High: Major feature down
  ☐ Critical: System completely offline

STEP 2: ALERT TECH TEAM IMMEDIATELY

  Send message/call:
  "TECH ALERT: [Problem]
   Time: [Duration]
   Severity: [Level]
   Affected: [What's impacted]
   Contact: [Your name]"
  
  Tech team response time: ________________

STEP 3: STABILIZE OPERATIONS

  While tech team works on fix:
  
  ☐ If orders can't be placed:
    • Tell retailers: System temporarily offline
    • Ask them to wait (estimated time) OR retry in 30 min
    • Take manual orders if critical
  
  ☐ If payment gateway down:
    • Accept manual payment arrangements
    • "Process payment once system restored"
    • Don't cancel orders, just delay
  
  ☐ If WhatsApp down:
    • Call vendors with critical orders
    • Send SMS alerts if WhatsApp offline
    • Don't delay orders waiting for WhatsApp
  
  ☐ If database slow:
    • Don't create new orders (might cause duplicates)
    • Wait for performance to improve
    • Check tech team status

STEP 4: COMMUNICATE WITH STAKEHOLDERS

  Inform vendors:
  "System temporary maintenance. Expect delayed responses for [duration].
   We're working on quick fix. Thanks for patience."
  
  Inform retailers:
  "System update in progress. May experience delays. 
   Expected resolution: [time]. We'll update you shortly."

STEP 5: TRACK RESOLUTION

  ☐ Time issue reported: ________________
  ☐ Time tech team started: ________________
  ☐ Issue root cause: ________________
  ☐ Time to resolution: ________________
  ☐ Total downtime: ________________ min
  
  Impacts during downtime:
  ☐ Orders not placed: ______
  ☐ Orders not confirmed: ______
  ☐ Payments failed: ______
  ☐ Deliveries delayed: ______

STEP 6: POST-RESOLUTION

  Once system is back:
  □ Verify all functions working
  □ Manually process any stuck orders
  □ Contact retailers waiting (confirm order placed)
  □ Contact vendors with pending orders
  □ Update retailer/vendor: "System restored. Sorry for delay."

  Communicate with customers:
  Message: "System issue resolved. Everything back to normal.
   If your order was affected, please contact support.
   Sorry for inconvenience!"

STEP 7: INCIDENT DOCUMENTATION

  For tech team:
  ☐ Issue description: ________________
  ☐ Time started: ________________
  ☐ Time resolved: ________________
  ☐ Root cause: ________________
  ☐ Prevention for future: ________________
  ☐ Follow-up required: ________________


═══════════════════════════════════════════════════════════════════════════════
INCIDENT TYPE 6: CUSTOMER COMPLAINTS
═══════════════════════════════════════════════════════════════════════════════

SCENARIO: Retailer/Vendor has complaint or issue

STEP 1: RECEIVE COMPLAINT

  Who: □ Retailer  □ Vendor
  Contact name: ________________
  Contact phone: ________________
  Complaint: ________________
  
  Tone: □ Calm  □ Frustrated  □ Angry
  
  If angry:
  ☑️ Stay professional & calm
  ☑️ Listen without interrupting
  ☑️ Acknowledge their concern
  ☑️ Show empathy

STEP 2: GATHER DETAILS

  Ask questions:
  □ "What happened?"
  □ "When did this happen?"
  □ "How does this affect you?"
  □ "What resolution would help?"
  □ "Is there a time urgency?"

STEP 3: CLASSIFY COMPLAINT TYPE

  □ Quality issue
  □ Delivery issue
  □ Payment issue
  □ Service issue
  □ Price issue
  □ Account/system issue
  □ Other: ________________

STEP 4: TAKE IMMEDIATE ACTION

  Based on type:
  □ Quality → See INCIDENT TYPE 3
  □ Delivery → See INCIDENT TYPE 1
  □ Payment → See INCIDENT TYPE 2
  □ Service → Escalate to manager
  □ Price → See MANUAL OVERRIDE PROCESS
  □ Account → Contact tech support
  □ Other → Document & escalate

STEP 5: FOLLOW UP

  Within 24 hours:
  □ Contact complainant
  □ "Has issue been resolved?"
  □ "Are you satisfied?"
  □ If NO → Escalate further
  If YES → Thank them & close ticket

STEP 6: DOCUMENT IN SYSTEM

  □ Record complaint type
  □ Record resolution
  □ Flag repeat complaints from same party
  □ Rate severity: Low / Medium / High


═══════════════════════════════════════════════════════════════════════════════
ESCALATION CONTACTS - QUICK DIAL
═══════════════════════════════════════════════════════════════════════════════

ISSUE TYPE              CONTACT             PHONE            PRIORITY
─────────────────────────────────────────────────────────────────────────
System/Tech Issues      Tech Lead           ____________     CRITICAL
Payment Issues          Finance Manager     ____________     CRITICAL
Vendor Disputes         Operations Head     ____________     HIGH
Retailer Complaints     Customer Support    ____________     HIGH
Delivery Issues         Logistics Manager   ____________     HIGH
Quality Issues          Quality Manager     ____________     MEDIUM
Escalations             General Manager     ____________     CRITICAL


═══════════════════════════════════════════════════════════════════════════════
INCIDENT LOG - PRINT & KEEP RECORD
═══════════════════════════════════════════════════════════════════════════════

DATE: ________________

INCIDENT #1
  Type: ________________
  Time reported: ________  Time resolved: ________
  Duration: ________
  Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
  Resolution: ________________
  Assigned to: ________________

INCIDENT #2
  Type: ________________
  Time reported: ________  Time resolved: ________
  Duration: ________
  Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
  Resolution: ________________
  Assigned to: ________________

INCIDENT #3
  Type: ________________
  Time reported: ________  Time resolved: ________
  Duration: ________
  Severity: ☐ Critical  ☐ High  ☐ Medium  ☐ Low
  Resolution: ________________
  Assigned to: ________________

INCIDENTS TODAY: ______
MOST COMMON TYPE: ________________
ESCALATIONS: ______


═══════════════════════════════════════════════════════════════════════════════
🎯 CRITICAL SUCCESS FACTORS
───────────────────────────────────────────────────────────────────────────────

✓ RESPOND FAST - First contact within 15 minutes of reporting
✓ LISTEN FIRST - Understand issue before proposing solution
✓ COMMUNICATE - Update stakeholder every 15 minutes if unresolved
✓ DOCUMENT - Record all details for future reference
✓ RESOLVE - Don't just acknowledge - actually fix the problem
✓ FOLLOW UP - Confirm satisfaction after 24 hours
✓ PREVENT - Note patterns to prevent future incidents
✓ ESCALATE - Know when to ask for help, don't struggle alone

═══════════════════════════════════════════════════════════════════════════════
