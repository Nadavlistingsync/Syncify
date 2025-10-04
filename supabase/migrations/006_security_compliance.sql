-- Security Compliance Migration - SOC 2 Type II, SOC 1, GDPR
-- This migration adds all necessary tables and functions for compliance

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Audit Logs Table (SOC 2 Type II requirement)
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Consent Table (GDPR requirement)
CREATE TABLE user_consent (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('data_processing', 'analytics', 'marketing', 'third_party')),
    granted BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, consent_type)
);

-- Retention Policies Table (SOC 1/SOC 2 requirement)
CREATE TABLE retention_policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    policy_type TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT
);

-- Data Deletion Requests Table (GDPR requirement)
CREATE TABLE data_deletion_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deletion_reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles Table (Access Control)
CREATE TABLE user_roles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'admin', 'auditor', 'compliance_officer')),
    granted_by UUID REFERENCES auth.users(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role)
);

-- Security Events Table (SOC 2 monitoring)
CREATE TABLE security_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PII Detection Log Table
CREATE TABLE pii_detection_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    pii_types TEXT[] NOT NULL,
    detection_method TEXT NOT NULL,
    action_taken TEXT NOT NULL CHECK (action_taken IN ('redacted', 'blocked', 'flagged', 'allowed')),
    confidence_score DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource);

CREATE INDEX idx_user_consent_user_id ON user_consent(user_id);
CREATE INDEX idx_user_consent_type ON user_consent(consent_type);
CREATE INDEX idx_user_consent_granted ON user_consent(granted);

CREATE INDEX idx_data_deletion_requests_user_id ON data_deletion_requests(user_id);
CREATE INDEX idx_data_deletion_requests_status ON data_deletion_requests(status);
CREATE INDEX idx_data_deletion_requests_requested_at ON data_deletion_requests(requested_at DESC);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_resolved ON security_events(resolved);

CREATE INDEX idx_pii_detection_log_user_id ON pii_detection_log(user_id);
CREATE INDEX idx_pii_detection_log_created_at ON pii_detection_log(created_at DESC);
CREATE INDEX idx_pii_detection_log_action_taken ON pii_detection_log(action_taken);

-- Updated_at triggers
CREATE TRIGGER update_user_consent_updated_at BEFORE UPDATE ON user_consent
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pii_detection_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Audit Logs RLS
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all audit logs" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'auditor')
        )
    );

-- User Consent RLS
CREATE POLICY "Users can manage their own consent" ON user_consent
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consent" ON user_consent
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'compliance_officer')
        )
    );

-- Retention Policies RLS
CREATE POLICY "Admins can manage retention policies" ON retention_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'compliance_officer')
        )
    );

-- Data Deletion Requests RLS
CREATE POLICY "Users can manage their own deletion requests" ON data_deletion_requests
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deletion requests" ON data_deletion_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'compliance_officer')
        )
    );

-- User Roles RLS
CREATE POLICY "Users can view their own roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" ON user_roles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin')
        )
    );

-- Security Events RLS
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (auth.uid() = COALESCE(user_id, auth.uid()));

CREATE POLICY "Admins can view all security events" ON security_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'auditor')
        )
    );

-- PII Detection Log RLS
CREATE POLICY "Users can view their own PII detection logs" ON pii_detection_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all PII detection logs" ON pii_detection_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_roles.user_id = auth.uid() 
            AND user_roles.role IN ('admin', 'compliance_officer')
        )
    );

-- Compliance Functions

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_user_id UUID,
    p_event TEXT,
    p_resource TEXT,
    p_action TEXT,
    p_details JSONB DEFAULT '{}',
    p_severity TEXT DEFAULT 'low',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, event, resource, action, details, severity, ip_address, user_agent
    )
    VALUES (
        p_user_id, p_event, p_resource, p_action, p_details, p_severity, p_ip_address, p_user_agent
    )
    RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions
CREATE OR REPLACE FUNCTION public.check_user_permission(
    p_user_id UUID,
    p_resource TEXT,
    p_action TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Check if user has admin role
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id 
        AND role = 'admin'
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO has_permission;
    
    IF has_permission THEN
        RETURN TRUE;
    END IF;
    
    -- Check resource-specific permissions
    CASE p_resource
        WHEN 'audit_logs' THEN
            SELECT EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = p_user_id 
                AND role IN ('admin', 'auditor')
                AND (expires_at IS NULL OR expires_at > NOW())
            ) INTO has_permission;
            
        WHEN 'data_retention' THEN
            SELECT EXISTS (
                SELECT 1 FROM user_roles 
                WHERE user_id = p_user_id 
                AND role IN ('admin', 'compliance_officer')
                AND (expires_at IS NULL OR expires_at > NOW())
            ) INTO has_permission;
            
        ELSE
            has_permission := TRUE; -- Default allow for other resources
    END CASE;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect and log PII
CREATE OR REPLACE FUNCTION public.detect_and_log_pii(
    p_user_id UUID,
    p_content TEXT,
    p_detection_method TEXT DEFAULT 'pattern_matching'
)
RETURNS JSONB AS $$
DECLARE
    pii_types TEXT[] := '{}';
    has_pii BOOLEAN := FALSE;
    action_taken TEXT := 'allowed';
    confidence_score DECIMAL(3,2) := 0.00;
    content_hash TEXT;
BEGIN
    -- Create content hash for deduplication
    content_hash := encode(digest(p_content, 'sha256'), 'hex');
    
    -- Check for email patterns
    IF p_content ~* '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b' THEN
        pii_types := array_append(pii_types, 'email');
        has_pii := TRUE;
        confidence_score := GREATEST(confidence_score, 0.85);
    END IF;
    
    -- Check for phone patterns
    IF p_content ~* '\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b' THEN
        pii_types := array_append(pii_types, 'phone');
        has_pii := TRUE;
        confidence_score := GREATEST(confidence_score, 0.75);
    END IF;
    
    -- Check for SSN patterns
    IF p_content ~* '\b\d{3}-\d{2}-\d{4}\b' THEN
        pii_types := array_append(pii_types, 'ssn');
        has_pii := TRUE;
        confidence_score := GREATEST(confidence_score, 0.90);
        action_taken := 'blocked';
    END IF;
    
    -- Check for credit card patterns
    IF p_content ~* '\b(?:\d{4}[-\s]?){3}\d{4}\b' THEN
        pii_types := array_append(pii_types, 'credit_card');
        has_pii := TRUE;
        confidence_score := GREATEST(confidence_score, 0.80);
        action_taken := 'blocked';
    END IF;
    
    -- Log PII detection
    INSERT INTO pii_detection_log (
        user_id, content_hash, pii_types, detection_method, action_taken, confidence_score
    )
    VALUES (
        p_user_id, content_hash, pii_types, p_detection_method, action_taken, confidence_score
    );
    
    -- Create security event if high confidence PII detected
    IF has_pii AND confidence_score >= 0.80 THEN
        INSERT INTO security_events (
            user_id, event_type, severity, description, metadata
        )
        VALUES (
            p_user_id, 'pii_detected', 'high', 
            'High confidence PII detected in user content',
            jsonb_build_object('pii_types', pii_types, 'confidence', confidence_score, 'action', action_taken)
        );
    END IF;
    
    RETURN jsonb_build_object(
        'has_pii', has_pii,
        'pii_types', pii_types,
        'action_taken', action_taken,
        'confidence_score', confidence_score
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup expired data (SOC 1/SOC 2 compliance)
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS JSONB AS $$
DECLARE
    now_date TIMESTAMPTZ := NOW();
    conversations_cutoff TIMESTAMPTZ := now_date - INTERVAL '3 years';
    events_cutoff TIMESTAMPTZ := now_date - INTERVAL '1 year';
    audit_cutoff TIMESTAMPTZ := now_date - INTERVAL '7 years';
    context_cutoff TIMESTAMPTZ := now_date - INTERVAL '3 years';
    
    conversations_deleted INTEGER := 0;
    events_deleted INTEGER := 0;
    audit_deleted INTEGER := 0;
    context_deleted INTEGER := 0;
BEGIN
    -- Delete expired conversations
    DELETE FROM conversations WHERE created_at < conversations_cutoff;
    GET DIAGNOSTICS conversations_deleted = ROW_COUNT;
    
    -- Delete expired events
    DELETE FROM events WHERE ts < events_cutoff;
    GET DIAGNOSTICS events_deleted = ROW_COUNT;
    
    -- Delete expired audit logs (keep for 7 years per SOC 1)
    DELETE FROM audit_logs WHERE timestamp < audit_cutoff;
    GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    
    -- Delete expired user context
    DELETE FROM user_context WHERE created_at < context_cutoff;
    GET DIAGNOSTICS context_deleted = ROW_COUNT;
    
    -- Log the cleanup operation
    INSERT INTO audit_logs (
        user_id, event, resource, action, details, severity
    )
    VALUES (
        NULL, 'data_cleanup', 'data_retention', 'execute',
        jsonb_build_object(
            'conversations_deleted', conversations_deleted,
            'events_deleted', events_deleted,
            'audit_deleted', audit_deleted,
            'context_deleted', context_deleted,
            'cutoff_dates', jsonb_build_object(
                'conversations', conversations_cutoff,
                'events', events_cutoff,
                'audit', audit_cutoff,
                'context', context_cutoff
            )
        ),
        'medium'
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'conversations_deleted', conversations_deleted,
        'events_deleted', events_deleted,
        'audit_deleted', audit_deleted,
        'context_deleted', context_deleted,
        'total_deleted', conversations_deleted + events_deleted + audit_deleted + context_deleted
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle GDPR data deletion
CREATE OR REPLACE FUNCTION public.process_gdpr_deletion(
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    deletion_id UUID;
    conversations_deleted INTEGER := 0;
    memories_deleted INTEGER := 0;
    events_deleted INTEGER := 0;
    context_deleted INTEGER := 0;
BEGIN
    -- Create deletion request record
    INSERT INTO data_deletion_requests (
        user_id, deletion_reason, status
    )
    VALUES (
        p_user_id, p_reason, 'processing'
    )
    RETURNING id INTO deletion_id;
    
    -- Delete user conversations
    DELETE FROM conversations WHERE user_id = p_user_id;
    GET DIAGNOSTICS conversations_deleted = ROW_COUNT;
    
    -- Delete user memories
    DELETE FROM memories WHERE user_id = p_user_id;
    GET DIAGNOSTICS memories_deleted = ROW_COUNT;
    
    -- Delete user events
    DELETE FROM events WHERE user_id = p_user_id;
    GET DIAGNOSTICS events_deleted = ROW_COUNT;
    
    -- Delete user context
    DELETE FROM user_context WHERE user_id = p_user_id;
    GET DIAGNOSTICS context_deleted = ROW_COUNT;
    
    -- Delete user profiles
    DELETE FROM profiles WHERE user_id = p_user_id;
    
    -- Delete site policies
    DELETE FROM site_policies WHERE user_id = p_user_id;
    
    -- Delete user roles
    DELETE FROM user_roles WHERE user_id = p_user_id;
    
    -- Delete user consent
    DELETE FROM user_consent WHERE user_id = p_user_id;
    
    -- Update deletion request status
    UPDATE data_deletion_requests 
    SET 
        status = 'completed',
        completed_at = NOW()
    WHERE id = deletion_id;
    
    -- Log the deletion
    INSERT INTO audit_logs (
        user_id, event, resource, action, details, severity
    )
    VALUES (
        p_user_id, 'gdpr_deletion', 'user_data', 'delete',
        jsonb_build_object(
            'deletion_id', deletion_id,
            'conversations_deleted', conversations_deleted,
            'memories_deleted', memories_deleted,
            'events_deleted', events_deleted,
            'context_deleted', context_deleted,
            'reason', p_reason
        ),
        'high'
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'deletion_id', deletion_id,
        'conversations_deleted', conversations_deleted,
        'memories_deleted', memories_deleted,
        'events_deleted', events_deleted,
        'context_deleted', context_deleted,
        'total_deleted', conversations_deleted + memories_deleted + events_deleted + context_deleted
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default retention policies
INSERT INTO retention_policies (policy_type, retention_days, description, reason) VALUES
('conversations', 1095, 'User conversations and messages', 'SOC 2 compliance - 3 years operational data'),
('events', 365, 'System events and telemetry', 'Operational monitoring - 1 year'),
('audit_logs', 2555, 'Audit trail and compliance logs', 'SOC 1 compliance - 7 years financial audit trail'),
('user_context', 1095, 'User context and preferences', 'SOC 2 compliance - 3 years operational data'),
('memories', 2555, 'User memories and facts', 'SOC 1 compliance - 7 years for financial context'),
('site_policies', 2555, 'Site-specific policies', 'SOC 1 compliance - 7 years for audit trail')
ON CONFLICT (policy_type) DO NOTHING;

-- Insert default admin role for system
INSERT INTO user_roles (user_id, role, granted_by)
SELECT id, 'admin', id
FROM auth.users
WHERE email = 'admin@syncify.app'
ON CONFLICT (user_id, role) DO NOTHING;

-- Create indexes for compliance queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance ON audit_logs(severity, timestamp DESC) WHERE severity IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON security_events(created_at DESC) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_pii_detection_high_confidence ON pii_detection_log(created_at DESC) WHERE confidence_score >= 0.80;

-- Comments for documentation
COMMENT ON TABLE audit_logs IS 'SOC 2 Type II audit trail - logs all user actions and system events';
COMMENT ON TABLE user_consent IS 'GDPR compliance - tracks user consent for data processing';
COMMENT ON TABLE retention_policies IS 'SOC 1/SOC 2 compliance - defines data retention periods';
COMMENT ON TABLE data_deletion_requests IS 'GDPR compliance - tracks user data deletion requests';
COMMENT ON TABLE user_roles IS 'Access control - role-based permissions for compliance functions';
COMMENT ON TABLE security_events IS 'SOC 2 monitoring - security events and incident tracking';
COMMENT ON TABLE pii_detection_log IS 'PII detection and protection - logs all PII detection events';

COMMENT ON FUNCTION public.create_audit_log IS 'Creates audit log entries for compliance tracking';
COMMENT ON FUNCTION public.check_user_permission IS 'Checks user permissions for resource access';
COMMENT ON FUNCTION public.detect_and_log_pii IS 'Detects PII in content and logs detection events';
COMMENT ON FUNCTION public.cleanup_expired_data IS 'SOC 1/SOC 2 compliance - removes expired data';
COMMENT ON FUNCTION public.process_gdpr_deletion IS 'GDPR compliance - processes user data deletion requests';
