# 📊 ORDER STATE MACHINE - VISUAL REFERENCE

## 🔄 State Transition Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ORDER LIFECYCLE FLOW                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

                              ╔════════════════╗
                              ║    CREATED     ║
                              ║ (order placed) ║
                              ╚════════╤═══════╝
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                    │
                    ▼                                    ▼
           ╔════════════════╗                  ╔════════════════╗
           ║ CREDIT_APPROVED║                  ║   CANCELLED    ║
           ║ (credit held)  ║                  ║   (Terminal)   ║
           ╚════════╤═══════╝                  ╚════════════════╝
                    │
                    ▼
           ╔════════════════╗
           ║ STOCK_RESERVED ║
           ║ (stock locked) ║
           ╚════════╤═══════╝
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   ╔═════════════╗         ╔════════════════╗
   ║   FAILED    ║         ║WHOLESALER_     ║
   ║ (Terminal)  ║         ║ACCEPTED        ║
   ╚═════════════╝         ╚════════╤═══════╝
                                    │
                                    ▼
                          ╔════════════════════╗
                          ║ OUT_FOR_DELIVERY   ║
                          ║ (in transit)       ║
                          ╚════════╤═══════════╝
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
           ╔════════════════╗          ╔════════════════╗
           ║   DELIVERED    ║          ║   CANCELLED    ║
           ║   (Terminal)   ║          ║   (Terminal)   ║
           ║ ✓ Credit paid  ║          ║ ✓ All released ║
           ║ ✓ Stock given  ║          ╚════════════════╝
           ╚════════════════╝

LEGEND:
───────
★ Terminal States: DELIVERED, CANCELLED, FAILED
  (No further transitions allowed)

━ Valid Transitions: 15 total
  (Cannot skip steps)

✓ State Actions:
  ├─ CREDIT_APPROVED: Place credit hold
  ├─ STOCK_RESERVED: Lock inventory
  ├─ WHOLESALER_ACCEPTED: Confirm at warehouse
  ├─ OUT_FOR_DELIVERY: Start shipment
  ├─ DELIVERED: Deduct credit & stock
  ├─ FAILED: Release all holds
  └─ CANCELLED: Release all holds
```

---

## 📋 Valid Transitions Table

```
FROM STATE              → TO STATES (allowed)
────────────────────────────────────────────────────────────────
CREATED                 → CREDIT_APPROVED, CANCELLED
CREDIT_APPROVED         → STOCK_RESERVED, FAILED, CANCELLED
STOCK_RESERVED          → WHOLESALER_ACCEPTED, FAILED, CANCELLED
WHOLESALER_ACCEPTED     → OUT_FOR_DELIVERY, FAILED, CANCELLED
OUT_FOR_DELIVERY        → DELIVERED, FAILED, CANCELLED
DELIVERED               → (Terminal - no transitions)
FAILED                  → (Terminal - no transitions)
CANCELLED               → (Terminal - no transitions)

Total Valid Transitions: 15 ✓
Total Possible Transitions: 56
Invalid Transitions: 41 (blocked)
```

---

## 🎯 Business Logic Per State

```
STATE ENTRY              TRIGGERS
────────────────────────────────────────────────────────────────
CREATED                  → Order ID generated, initial status set

CREDIT_APPROVED          → Check credit available
                         → Place hold on retailer's credit
                         → Log credit approval
                         → Notify retailer

STOCK_RESERVED           → Check stock availability
                         → Lock quantity in inventory
                         → Create reservation
                         → Notify wholesaler

WHOLESALER_ACCEPTED      → Update wholesaler status
                         → Log acceptance
                         → Schedule pickup notification

OUT_FOR_DELIVERY         → Create shipment record
                         → Generate tracking info
                         → Send delivery notification
                         → Start delivery timer

DELIVERED                → DEDUCT credit from retailer account
                         → DEDUCT stock from wholesaler inventory
                         → Finalize order
                         → Send receipt
                         → Update stats/analytics

FAILED                   → Release credit hold
                         → Release stock reservation
                         → Log failure reason
                         → Send notification
                         → Trigger support alert

CANCELLED                → Release credit hold
                         → Release stock reservation
                         → Log cancellation reason
                         → Send cancellation notice
                         → Notify all parties
```

---

## 🔒 State Security Rules

```
RULE                             ENFORCED BY
────────────────────────────────────────────────────────────────
Cannot skip states               OrderStateMachineValidator
                                 (checks VALID_TRANSITIONS)

Cannot go backwards              VALID_TRANSITIONS only forward

Cannot modify terminal states    isTerminalState() check
                                 throws TerminalStateError

Cannot modify non-terminal       canModify() check
in late stages (OUT_FOR_         prevents late editing
DELIVERY+)

Cannot deduct twice              Atomic transactions
                                 (DELIVERED state deducts once)

Cannot create invalid orders     createOrder() enforces
                                 CREATED state always

Cannot transition without        validateTransition() required
permission                       before every state change

Cannot lose transition history   OrderTransitionLog models
                                 all transitions automatically
```

---

## 🔌 API Endpoints Cheat Sheet

```
╔════════════════════════════════════════════════════════════════╗
║                    TRANSITION ENDPOINTS                         ║
╚════════════════════════════════════════════════════════════════╝

POST /api/v1/orders/state-machine/create
└─ Body: { wholesalerId, items[], paymentMode }
└─ Response: { orderId, status: "CREATED" }

POST /api/v1/orders/:orderId/state-machine/approve-credit
└─ Body: { context: { userId } }
└─ Response: { status: "CREDIT_APPROVED" }
└─ Triggers: Credit hold placed

POST /api/v1/orders/:orderId/state-machine/reserve-stock
└─ Body: { context: { userId } }
└─ Response: { status: "STOCK_RESERVED" }
└─ Triggers: Stock locked

POST /api/v1/orders/:orderId/state-machine/accept
└─ Body: { context: { userId } }
└─ Response: { status: "WHOLESALER_ACCEPTED" }

POST /api/v1/orders/:orderId/state-machine/start-delivery
└─ Body: { trackingId, context: { userId } }
└─ Response: { status: "OUT_FOR_DELIVERY" }

POST /api/v1/orders/:orderId/state-machine/complete-delivery
└─ Body: { context: { userId } }
└─ Response: { status: "DELIVERED" }
└─ Triggers: Credit deducted, Stock deducted

POST /api/v1/orders/:orderId/state-machine/fail
└─ Body: { failureReason, context: { userId } }
└─ Response: { status: "FAILED" }
└─ Triggers: All holds released

POST /api/v1/orders/:orderId/state-machine/cancel
└─ Body: { cancelReason, context: { userId } }
└─ Response: { status: "CANCELLED" }
└─ Triggers: All holds released

╔════════════════════════════════════════════════════════════════╗
║                      QUERY ENDPOINTS                           ║
╚════════════════════════════════════════════════════════════════╝

GET /api/v1/orders/:orderId/state-machine/state
└─ Response: { currentState, validNextStates: [] }

GET /api/v1/orders/:orderId/state-machine/info
└─ Response: { order, currentState, validNextStates, history }

GET /api/v1/orders/:orderId/state-machine/history
└─ Response: { transitions: [{ from, to, timestamp, reason }] }

POST /api/v1/orders/:orderId/state-machine/validate-transition
└─ Body: { targetState }
└─ Response: { isValid: boolean, error?: string }
```

---

## 🚨 Error Codes Reference

```
HTTP CODE   ERROR TYPE                 MEANING
───────────────────────────────────────────────────────────────
200         ✓ Success                  Transition successful

400         Bad Request                Invalid input/body
            • Missing required field
            • Invalid data format
            • Invalid order ID format

402         Payment Required           Insufficient credit
            • Credit hold failed
            • Not enough credit available

404         Not Found                  Order doesn't exist

409         Conflict                   State operation conflict
            • Invalid transition
            • Terminal state cannot transition
            • Order already in target state

500         Internal Error             System error
            • Database error
            • Service error
            • Unhandled exception
```

---

## 📊 State Machine Statistics

```
METRIC                          VALUE
────────────────────────────────────────────────────────────────
Total States                    8
├─ Normal States               5 (CREATED, CREDIT_APPROVED, ...)
├─ Terminal States             2 (DELIVERED, CANCELLED)
└─ Failure States              2 (FAILED, CANCELLED)

Valid Transitions              15
Invalid Transitions            41 (blocked)
Possible Transitions           56

API Endpoints                  13
├─ Transition Endpoints        8
├─ Query Endpoints             4
└─ Validation Endpoints        1

Error Types                    2
├─ InvalidTransitionError      (HTTP 409)
└─ TerminalStateError          (HTTP 409)

Average Transition Time        <100ms
Audit Log Entries             Created on each transition
Database Indexes              2 (orderId, timestamp)
```

---

## 🎓 Example Flow Timeline

```
Timeline        State                  Action
─────────────────────────────────────────────────────────────
T+0:00          CREATED                Order created
                                       └─ /create endpoint
T+0:15          CREDIT_APPROVED        Credit verified & held
                                       └─ /approve-credit
T+0:30          STOCK_RESERVED         Stock locked
                                       └─ /reserve-stock
T+1:00          WHOLESALER_ACCEPTED    Wholesaler confirmed
                                       └─ /accept
T+5:00          OUT_FOR_DELIVERY       Shipment in transit
                                       └─ /start-delivery
T+24:00         DELIVERED              ✓ Complete
                                       └─ /complete-delivery
                                       └─ Credit deducted
                                       └─ Stock deducted
                                       └─ Terminal state
```

---

## 💡 Quick Tips

✅ **Always check validNextStates** before user interface offers transitions  
✅ **Store transition reasons** for audit trail and debugging  
✅ **Handle 409 conflicts** gracefully in client error handlers  
✅ **Use GET /state** to refresh allowed actions in UI  
✅ **Monitor transition history** for debugging issues  
✅ **Log userId context** on all transitions for audit trail  
✅ **Test terminal states** to ensure cannot transition  
✅ **Test invalid transitions** to ensure validator works  

---

## 🔗 Related Documentation

- **Full Guide**: `ORDER_STATE_MACHINE_GUIDE.md`
- **Quick Reference**: `ORDER_STATE_MACHINE_QUICK_REFERENCE.md`
- **Integration**: `INTEGRATION_CHECKLIST.md`
- **Schema**: `SCHEMA_ADDITIONS_FOR_ORDER_STATE_MACHINE.md`
- **Code**: `src/services/orderStateMachine.service.js`

---

**Print this page for quick reference! 📌**
