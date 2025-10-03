-- Enhanced telemetry and analytics functions

-- Function to cleanup old events
CREATE OR REPLACE FUNCTION public.cleanup_old_events(
    p_user_id UUID,
    p_keep_count INTEGER DEFAULT 1000
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old events, keeping only the most recent ones
    WITH old_events AS (
        SELECT id
        FROM events
        WHERE user_id = p_user_id
        ORDER BY ts DESC
        OFFSET p_keep_count
    )
    DELETE FROM events
    WHERE id IN (SELECT id FROM old_events);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get telemetry summary
CREATE OR REPLACE FUNCTION public.get_telemetry_summary(
    p_user_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    from_date TIMESTAMPTZ;
    result JSONB;
BEGIN
    from_date := NOW() - (p_days || ' days')::INTERVAL;
    
    SELECT jsonb_build_object(
        'total_events', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date
        ),
        'events_by_kind', (
            SELECT jsonb_object_agg(kind, count)
            FROM (
                SELECT kind, COUNT(*) as count
                FROM events
                WHERE user_id = p_user_id AND ts >= from_date
                GROUP BY kind
            ) t
        ),
        'events_by_site', (
            SELECT jsonb_object_agg(
                COALESCE(payload->>'site', 'unknown'), 
                count
            )
            FROM (
                SELECT payload->>'site' as site, COUNT(*) as count
                FROM events
                WHERE user_id = p_user_id AND ts >= from_date
                GROUP BY payload->>'site'
            ) t
            WHERE site IS NOT NULL
        ),
        'success_rate', (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE (COUNT(*) FILTER (WHERE payload->>'success' = 'true')::FLOAT / COUNT(*) * 100)
            END
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'inject'
        ),
        'error_rate', (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE (COUNT(*) FILTER (WHERE kind = 'error')::FLOAT / COUNT(*) * 100)
            END
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date
        ),
        'top_errors', (
            SELECT jsonb_agg(
                jsonb_build_object('error', error, 'count', count)
                ORDER BY count DESC
            )
            FROM (
                SELECT payload->>'error' as error, COUNT(*) as count
                FROM events
                WHERE user_id = p_user_id AND ts >= from_date AND kind = 'error'
                GROUP BY payload->>'error'
                ORDER BY count DESC
                LIMIT 10
            ) t
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get analytics data
CREATE OR REPLACE FUNCTION public.get_analytics_data(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
    from_date TIMESTAMPTZ;
    result JSONB;
BEGIN
    from_date := NOW() - (p_days || ' days')::INTERVAL;
    
    SELECT jsonb_build_object(
        'summary', jsonb_build_object(
            'total_memories', (
                SELECT COUNT(*) FROM memories 
                WHERE user_id = p_user_id
            ),
            'total_conversations', (
                SELECT COUNT(*) FROM conversations 
                WHERE user_id = p_user_id AND created_at >= from_date
            ),
            'total_events', (
                SELECT COUNT(*) FROM events 
                WHERE user_id = p_user_id AND ts >= from_date
            ),
            'active_sites', (
                SELECT COUNT(*) FROM site_policies 
                WHERE user_id = p_user_id AND enabled = true
            )
        ),
        'trends', jsonb_build_object(
            'memories_by_day', (
                SELECT jsonb_agg(
                    jsonb_build_object('date', date, 'count', count)
                    ORDER BY date
                )
                FROM (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as count
                    FROM memories
                    WHERE user_id = p_user_id AND created_at >= from_date
                    GROUP BY DATE(created_at)
                ) t
            ),
            'conversations_by_day', (
                SELECT jsonb_agg(
                    jsonb_build_object('date', date, 'count', count)
                    ORDER BY date
                )
                FROM (
                    SELECT 
                        DATE(created_at) as date,
                        COUNT(*) as count
                    FROM conversations
                    WHERE user_id = p_user_id AND created_at >= from_date
                    GROUP BY DATE(created_at)
                ) t
            ),
            'events_by_day', (
                SELECT jsonb_agg(
                    jsonb_build_object('date', date, 'count', count)
                    ORDER BY date
                )
                FROM (
                    SELECT 
                        DATE(ts) as date,
                        COUNT(*) as count
                    FROM events
                    WHERE user_id = p_user_id AND ts >= from_date
                    GROUP BY DATE(ts)
                ) t
            )
        ),
        'top_sites', (
            SELECT jsonb_agg(
                jsonb_build_object('site', site, 'count', count)
                ORDER BY count DESC
            )
            FROM (
                SELECT site, COUNT(*) as count
                FROM conversations
                WHERE user_id = p_user_id AND created_at >= from_date
                GROUP BY site
                ORDER BY count DESC
                LIMIT 10
            ) t
        ),
        'top_providers', (
            SELECT jsonb_agg(
                jsonb_build_object('provider', provider, 'count', count)
                ORDER BY count DESC
            )
            FROM (
                SELECT provider, COUNT(*) as count
                FROM conversations
                WHERE user_id = p_user_id AND created_at >= from_date
                GROUP BY provider
                ORDER BY count DESC
                LIMIT 10
            ) t
        ),
        'memory_breakdown', (
            SELECT jsonb_agg(
                jsonb_build_object('type', type, 'count', count)
            )
            FROM (
                SELECT type, COUNT(*) as count
                FROM memories
                WHERE user_id = p_user_id
                GROUP BY type
            ) t
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sync health metrics
CREATE OR REPLACE FUNCTION public.get_sync_health(
    p_user_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    from_date TIMESTAMPTZ;
    result JSONB;
BEGIN
    from_date := NOW() - (p_days || ' days')::INTERVAL;
    
    SELECT jsonb_build_object(
        'total_captures', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'capture'
        ),
        'total_injections', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'inject'
        ),
        'successful_injections', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date 
            AND kind = 'inject' AND payload->>'success' = 'true'
        ),
        'failed_injections', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date 
            AND kind = 'inject' AND payload->>'success' = 'false'
        ),
        'total_errors', (
            SELECT COUNT(*) FROM events 
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'error'
        ),
        'success_rate', (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE (COUNT(*) FILTER (WHERE payload->>'success' = 'true')::FLOAT / COUNT(*) * 100)
            END
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'inject'
        ),
        'error_rate', (
            SELECT CASE 
                WHEN COUNT(*) = 0 THEN 0
                ELSE (COUNT(*) FILTER (WHERE kind = 'error')::FLOAT / COUNT(*) * 100)
            END
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date
        ),
        'avg_response_time', (
            SELECT AVG((payload->>'response_time')::NUMERIC)
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date 
            AND kind = 'inject' AND payload->>'response_time' IS NOT NULL
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get error analysis
CREATE OR REPLACE FUNCTION public.get_error_analysis(
    p_user_id UUID,
    p_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    from_date TIMESTAMPTZ;
    result JSONB;
BEGIN
    from_date := NOW() - (p_days || ' days')::INTERVAL;
    
    SELECT jsonb_build_object(
        'top_errors', (
            SELECT jsonb_agg(
                jsonb_build_object('error', error, 'count', count)
                ORDER BY count DESC
            )
            FROM (
                SELECT payload->>'error' as error, COUNT(*) as count
                FROM events
                WHERE user_id = p_user_id AND ts >= from_date AND kind = 'error'
                GROUP BY payload->>'error'
                ORDER BY count DESC
                LIMIT 10
            ) t
        ),
        'errors_by_site', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'site', site, 
                    'total_errors', total_errors,
                    'errors', errors
                )
                ORDER BY total_errors DESC
            )
            FROM (
                SELECT 
                    payload->>'site' as site,
                    COUNT(*) as total_errors,
                    jsonb_agg(
                        jsonb_build_object('error', payload->>'error', 'count', 1)
                    ) as errors
                FROM events
                WHERE user_id = p_user_id AND ts >= from_date AND kind = 'error'
                GROUP BY payload->>'site'
                ORDER BY COUNT(*) DESC
                LIMIT 10
            ) t
            WHERE site IS NOT NULL
        ),
        'total_unique_errors', (
            SELECT COUNT(DISTINCT payload->>'error')
            FROM events
            WHERE user_id = p_user_id AND ts >= from_date AND kind = 'error'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_user_ts_kind ON events(user_id, ts DESC, kind);
CREATE INDEX IF NOT EXISTS idx_events_payload_site ON events USING GIN ((payload->>'site'));
CREATE INDEX IF NOT EXISTS idx_events_payload_provider ON events USING GIN ((payload->>'provider'));
CREATE INDEX IF NOT EXISTS idx_events_payload_error ON events USING GIN ((payload->>'error'));

-- Add response_time to events payload for performance tracking
-- This is handled in the application code, but we can add a comment
COMMENT ON COLUMN events.payload IS 'JSON payload containing event-specific data, including response_time for performance tracking';
