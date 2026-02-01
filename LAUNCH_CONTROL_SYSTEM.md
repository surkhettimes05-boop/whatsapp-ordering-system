# 🚀 Launch Control System - Growth & Risk Engineering

## Overview

The Launch Control System is a comprehensive platform management solution designed to provide real-time control over platform capacity, risk exposure, and feature availability. Built for Growth & Risk Engineering teams to safely scale operations while maintaining system stability.

## 🎯 Key Features

### **Real-time Platform Controls**
- **Capacity Limits**: Control daily orders, active users, concurrent operations
- **Risk Management**: Credit limits, fraud detection, approval workflows
- **Feature Flags**: Enable/disable features instantly across the platform
- **Emergency Controls**: Immediate system-wide stops and maintenance modes

### **Live Dashboard**
- **Real-time Metrics**: Current utilization vs. limits with visual indicators
- **Risk Scoring**: Automated risk assessment based on multiple factors
- **Quick Presets**: One-click configurations for different launch phases
- **Alert System**: Proactive notifications when thresholds are approached

### **Audit & Compliance**
- **Change History**: Complete audit trail of all flag modifications
- **User Attribution**: Track who made changes and when
- **Reason Logging**: Mandatory reasons for critical changes
- **Rollback Capability**: Quick restoration of previous configurations

## 🛠️ Architecture

### **Backend Components**
```
src/config/launch-control.config.js     # Core configuration management
src/services/launch-control.service.js  # Business logic integration
src/controllers/launch-control.controller.js  # API endpoints
src/routes/launch-control.routes.js     # Route definitions
src/middleware/launch-control.middleware.js   # Request validation
```

### **Frontend Components**
```
frontend/src/pages/LaunchControlDashboard.jsx  # Main dashboard
frontend/src/components/ui/                     # UI components
```

### **Database Schema**
```
launch_control_flags         # Flag storage with versioning
launch_control_flag_history  # Complete change audit trail
system_metrics              # Real-time system metrics
launch_control_alerts       # Alert management
```

## 🚦 Launch Control Flags

### **Capacity Limits**
| Flag | Default | Description |
|------|---------|-------------|
| `MAX_DAILY_ORDERS` | 100 | Maximum orders allowed per day |
| `MAX_CREDIT_PER_RETAILER` | 50,000 | Maximum credit limit per retailer |
| `MAX_ACTIVE_RETAILERS` | 50 | Maximum number of active retailers |
| `MAX_ACTIVE_VENDORS` | 20 | Maximum number of active vendors |
| `MAX_ORDER_VALUE` | 100,000 | Maximum value per single order |
| `MAX_ORDERS_PER_RETAILER_DAILY` | 10 | Daily order limit per retailer |
| `MAX_CONCURRENT_ORDERS` | 200 | Maximum concurrent active orders |

### **Risk Controls**
| Flag | Default | Description |
|------|---------|-------------|
| `ADMIN_APPROVAL_REQUIRED` | false | Require admin approval for operations |
| `MAX_CREDIT_UTILIZATION_PERCENT` | 80 | Maximum credit utilization percentage |
| `REQUIRE_PHONE_VERIFICATION` | true | Require phone verification for new users |
| `ENABLE_FRAUD_DETECTION` | true | Enable fraud detection system |

### **Feature Flags**
| Flag | Default | Description |
|------|---------|-------------|
| `ENABLE_NEW_RETAILER_SIGNUP` | true | Allow new retailer registrations |
| `ENABLE_NEW_VENDOR_SIGNUP` | true | Allow new vendor registrations |
| `ENABLE_CREDIT_SYSTEM` | true | Enable credit-based ordering |
| `ENABLE_VENDOR_BIDDING` | true | Enable vendor bidding system |

### **Emergency Controls**
| Flag | Default | Description |
|------|---------|-------------|
| `EMERGENCY_STOP` | false | Stop all platform operations immediately |
| `MAINTENANCE_MODE` | false | Enable maintenance mode |
| `READONLY_MODE` | false | Disable all write operations |

## 📊 Dashboard Features

### **Real-time Metrics**
- **Risk Score**: Calculated based on current utilization across all limits
- **Capacity Utilization**: Visual progress bars showing current vs. maximum
- **System Health**: Overall platform status with color-coded indicators
- **Alert Summary**: Active alerts requiring attention

### **Control Panels**
1. **Limits & Controls**: Adjust numerical limits in real-time
2. **Feature Flags**: Toggle platform features on/off
3. **Emergency Controls**: Critical system controls with confirmation
4. **Quick Presets**: Pre-configured settings for different phases

### **Launch Phase Presets**
- **Soft Launch**: Conservative limits for initial rollout
- **Beta Phase**: Moderate limits for expanded testing
- **Full Launch**: Production-ready limits for scale

### **Risk Level Presets**
- **Conservative**: Maximum safety with strict controls
- **Moderate**: Balanced approach with reasonable limits
- **Aggressive**: Minimal restrictions for rapid growth

## 🔧 API Endpoints

### **Flag Management**
```
GET    /api/v1/launch-control/flags           # Get all flags
GET    /api/v1/launch-control/flags/:key      # Get specific flag
PUT    /api/v1/launch-control/flags/:key      # Update single flag
PUT    /api/v1/launch-control/flags           # Bulk update flags
GET    /api/v1/launch-control/flags/:key/history  # Flag change history
```

### **System Metrics**
```
GET    /api/v1/launch-control/metrics         # Current system metrics
GET    /api/v1/launch-control/dashboard       # Complete dashboard data
GET    /api/v1/launch-control/health          # System health check
```

### **Emergency Controls**
```
POST   /api/v1/launch-control/emergency-stop     # Activate emergency stop
POST   /api/v1/launch-control/resume-operations  # Resume normal operations
```

### **Presets**
```
POST   /api/v1/launch-control/presets/launch-phase  # Apply launch phase preset
POST   /api/v1/launch-control/presets/risk-level    # Apply risk level preset
```

## 🚨 Emergency Procedures

### **Emergency Stop**
1. **Activation**: Immediately stops all new operations
2. **Effects**: 
   - Blocks new orders, registrations, and transactions
   - Enables read-only mode
   - Activates maintenance mode
   - Sends critical alerts
3. **Recovery**: Requires manual resume with reason logging

### **Maintenance Mode**
- Displays maintenance message to users
- Blocks all write operations
- Allows read operations to continue
- Can be scheduled or activated immediately

### **Read-only Mode**
- Prevents all data modifications
- Allows viewing and monitoring
- Useful for database maintenance or investigations

## 📈 Monitoring & Alerts

### **Automatic Alerts**
- **High Order Volume**: When daily orders exceed threshold
- **Credit Exposure**: When total credit exposure is high
- **Capacity Critical**: When user limits are nearly reached
- **System Degradation**: When multiple metrics show stress

### **Alert Severities**
- **LOW**: Informational, no immediate action required
- **MEDIUM**: Monitor closely, consider adjustments
- **HIGH**: Action recommended within hours
- **CRITICAL**: Immediate action required

## 🔒 Security & Permissions

### **Access Control**
- **ADMIN**: Can view and modify most flags
- **SUPER_ADMIN**: Can access emergency controls
- **Audit Trail**: All changes logged with user attribution

### **Change Validation**
- **Reason Required**: All flag changes must include reason
- **Confirmation**: Critical changes require double confirmation
- **Rate Limiting**: Prevents rapid successive changes

## 🚀 Deployment & Setup

### **1. Database Migration**
```bash
# Run the launch control migration
psql -d your_database -f migrations/002_launch_control_migration.sql
```

### **2. Environment Variables**
```bash
# Add to your .env file
MAX_DAILY_ORDERS=100
MAX_CREDIT_PER_RETAILER=50000
MAX_ACTIVE_RETAILERS=50
MAX_ACTIVE_VENDORS=20
ADMIN_APPROVAL_REQUIRED=false
# ... (see .env.production for complete list)
```

### **3. Backend Integration**
```javascript
// Add to your app.js
app.use('/api/v1/launch-control', require('./routes/launch-control.routes'));
```

### **4. Frontend Access**
```
# Access the dashboard at:
https://your-domain.com/launch-control
```

## 🧪 Testing

### **Run Tests**
```bash
# Test the launch control system
node test-launch-control.js
```

### **Test Coverage**
- Flag CRUD operations
- System metrics calculation
- Emergency controls
- Limit validation
- Service integration

## 📋 Usage Examples

### **Scaling for High Traffic**
```javascript
// Increase limits for expected traffic spike
const scaleUpFlags = {
  MAX_DAILY_ORDERS: 500,
  MAX_ACTIVE_RETAILERS: 200,
  MAX_CONCURRENT_ORDERS: 1000
};

await launchControl.updateFlags(scaleUpFlags, 'traffic-spike-preparation');
```

### **Risk Mitigation**
```javascript
// Tighten controls during suspicious activity
const riskMitigationFlags = {
  ADMIN_APPROVAL_REQUIRED: true,
  ENABLE_FRAUD_DETECTION: true,
  MAX_CREDIT_UTILIZATION_PERCENT: 60
};

await launchControl.updateFlags(riskMitigationFlags, 'fraud-prevention');
```

### **Feature Rollout**
```javascript
// Gradually enable new features
await launchControl.updateFlag('ENABLE_VENDOR_BIDDING', true, 'feature-rollout-phase-1');
```

## 🔍 Troubleshooting

### **Common Issues**

1. **Dashboard Not Loading**
   - Check API endpoint accessibility
   - Verify authentication tokens
   - Check browser console for errors

2. **Flags Not Updating**
   - Verify user permissions
   - Check database connectivity
   - Review audit logs for errors

3. **Metrics Not Showing**
   - Ensure database has data
   - Check Prisma connection
   - Verify metric calculation queries

### **Debug Commands**
```bash
# Test database connection
node -e "require('./src/config/launch-control.config').testConnection()"

# Check current flags
node -e "require('./src/config/launch-control.config').getFlags().then(console.log)"

# Validate system health
node -e "require('./src/services/launch-control.service').getSystemHealth().then(console.log)"
```

## 📞 Support

### **Documentation**
- API Reference: `/api/v1/launch-control` endpoints
- Database Schema: `migrations/002_launch_control_migration.sql`
- Test Suite: `test-launch-control.js`

### **Monitoring**
- Dashboard: Real-time system status
- Logs: Structured logging for all operations
- Alerts: Proactive notifications for issues

---

## 🎯 Best Practices

1. **Gradual Changes**: Make incremental adjustments rather than large jumps
2. **Monitor Impact**: Watch metrics after each change
3. **Document Reasons**: Always provide clear reasons for changes
4. **Test First**: Use staging environment for major changes
5. **Emergency Preparedness**: Know how to quickly revert changes
6. **Regular Reviews**: Periodically assess and adjust limits
7. **Team Communication**: Coordinate changes with relevant teams

The Launch Control System provides the foundation for safe, controlled platform growth while maintaining operational excellence and risk management.