-- =============================================================================
-- LAUNCH CONTROL SYSTEM MIGRATION
-- Growth & Risk Engineering - Database Schema
-- =============================================================================

-- Create launch control flags table
CREATE TABLE IF NOT EXISTS launch_control_flags (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE NOT NULL,
    
    -- Support different value types
    boolean_value BOOLEAN,
    integer_value INTEGER,
    string_value TEXT,
    value_type TEXT NOT NULL CHECK (value_type IN ('boolean', 'integer', 'string')),
    
    -- Metadata
    description TEXT,
    category TEXT CHECK (category IN ('limits', 'features', 'emergency', 'monitoring')),
    
    -- Audit trail
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT DEFAULT 'system',
    updated_by TEXT
);

-- Create launch control flag history table
CREATE TABLE IF NOT EXISTS launch_control_flag_history (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    flag_id TEXT NOT NULL REFERENCES launch_control_flags(id) ON DELETE CASCADE,
    
    -- Previous and new values
    previous_boolean_value BOOLEAN,
    previous_integer_value INTEGER,
    previous_string_value TEXT,
    
    new_boolean_value BOOLEAN,
    new_integer_value INTEGER,
    new_string_value TEXT,
    
    -- Change metadata
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by TEXT NOT NULL,
    reason TEXT,
    ip_address TEXT,
    user_agent TEXT
);

-- Create system metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    
    -- Dimensions/tags (JSON)
    tags JSONB,
    
    -- Timestamp
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create launch control alerts table
CREATE TABLE IF NOT EXISTS launch_control_alerts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    
    -- Status
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED')),
    acknowledged_by TEXT,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_launch_control_flags_key ON launch_control_flags(key);
CREATE INDEX IF NOT EXISTS idx_launch_control_flags_category ON launch_control_flags(category);
CREATE INDEX IF NOT EXISTS idx_launch_control_flag_history_flag_id ON launch_control_flag_history(flag_id);
CREATE INDEX IF NOT EXISTS idx_launch_control_flag_history_changed_at ON launch_control_flag_history(changed_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_launch_control_alerts_type_status ON launch_control_alerts(alert_type, status, created_at);

-- Insert default launch control flags
INSERT INTO launch_control_flags (key, integer_value, value_type, description, category, created_by) VALUES
    ('MAX_DAILY_ORDERS', 100, 'integer', 'Maximum orders allowed per day', 'limits', 'system'),
    ('MAX_CREDIT_PER_RETAILER', 50000, 'integer', 'Maximum credit limit per retailer', 'limits', 'system'),
    ('MAX_ACTIVE_RETAILERS', 50, 'integer', 'Maximum number of active retailers', 'limits', 'system'),
    ('MAX_ACTIVE_VENDORS', 20, 'integer', 'Maximum number of active vendors', 'limits', 'system'),
    ('MAX_ORDER_VALUE', 100000, 'integer', 'Maximum value per order', 'limits', 'system'),
    ('MAX_ORDERS_PER_RETAILER_DAILY', 10, 'integer', 'Maximum orders per retailer per day', 'limits', 'system'),
    ('MAX_CREDIT_UTILIZATION_PERCENT', 80, 'integer', 'Maximum credit utilization percentage', 'limits', 'system'),
    ('MAX_CONCURRENT_ORDERS', 200, 'integer', 'Maximum concurrent active orders', 'limits', 'system'),
    ('MAX_WEBHOOK_RATE_PER_MINUTE', 1000, 'integer', 'Maximum webhook requests per minute', 'limits', 'system')
ON CONFLICT (key) DO NOTHING;

INSERT INTO launch_control_flags (key, boolean_value, value_type, description, category, created_by) VALUES
    ('ADMIN_APPROVAL_REQUIRED', false, 'boolean', 'Require admin approval for new operations', 'features', 'system'),
    ('REQUIRE_PHONE_VERIFICATION', true, 'boolean', 'Require phone verification for new users', 'features', 'system'),
    ('ENABLE_FRAUD_DETECTION', true, 'boolean', 'Enable fraud detection system', 'features', 'system'),
    ('ENABLE_NEW_RETAILER_SIGNUP', true, 'boolean', 'Allow new retailer registrations', 'features', 'system'),
    ('ENABLE_NEW_VENDOR_SIGNUP', true, 'boolean', 'Allow new vendor registrations', 'features', 'system'),
    ('ENABLE_CREDIT_SYSTEM', true, 'boolean', 'Enable credit-based ordering', 'features', 'system'),
    ('ENABLE_VENDOR_BIDDING', true, 'boolean', 'Enable vendor bidding system', 'features', 'system'),
    ('EMERGENCY_STOP', false, 'boolean', 'Emergency stop all operations', 'emergency', 'system'),
    ('MAINTENANCE_MODE', false, 'boolean', 'System maintenance mode', 'emergency', 'system'),
    ('READONLY_MODE', false, 'boolean', 'Read-only mode (no writes)', 'emergency', 'system'),
    ('ALERT_ON_HIGH_ORDER_VOLUME', true, 'boolean', 'Alert when order volume is high', 'monitoring', 'system')
ON CONFLICT (key) DO NOTHING;

INSERT INTO launch_control_flags (key, integer_value, value_type, description, category, created_by) VALUES
    ('HIGH_ORDER_VOLUME_THRESHOLD', 80, 'integer', 'Threshold for high order volume alerts (%)', 'monitoring', 'system')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_launch_control_flags_updated_at 
    BEFORE UPDATE ON launch_control_flags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_launch_control_alerts_updated_at 
    BEFORE UPDATE ON launch_control_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger to log flag changes
CREATE OR REPLACE FUNCTION log_flag_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO launch_control_flag_history (
        flag_id,
        previous_boolean_value,
        previous_integer_value,
        previous_string_value,
        new_boolean_value,
        new_integer_value,
        new_string_value,
        changed_by,
        reason
    ) VALUES (
        NEW.id,
        OLD.boolean_value,
        OLD.integer_value,
        OLD.string_value,
        NEW.boolean_value,
        NEW.integer_value,
        NEW.string_value,
        NEW.updated_by,
        'Flag updated via system'
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_launch_control_flag_changes
    AFTER UPDATE ON launch_control_flags
    FOR EACH ROW EXECUTE FUNCTION log_flag_changes();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON launch_control_flags TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON launch_control_flag_history TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON system_metrics TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON launch_control_alerts TO your_app_user;