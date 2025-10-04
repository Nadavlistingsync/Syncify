-- User context storage table
CREATE TABLE user_context (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    site TEXT NOT NULL,
    provider TEXT NOT NULL,
    context_type TEXT NOT NULL CHECK (context_type IN ('conversation', 'preference', 'fact', 'skill', 'note')) DEFAULT 'conversation',
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    pii BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure we don't duplicate conversations
    UNIQUE(user_id, conversation_id)
);

-- Indexes for performance
CREATE INDEX idx_user_context_user_id ON user_context(user_id);
CREATE INDEX idx_user_context_site ON user_context(site);
CREATE INDEX idx_user_context_provider ON user_context(provider);
CREATE INDEX idx_user_context_type ON user_context(context_type);
CREATE INDEX idx_user_context_importance ON user_context(importance DESC);
CREATE INDEX idx_user_context_created_at ON user_context(created_at DESC);
CREATE INDEX idx_user_context_conversation_id ON user_context(conversation_id);

-- Updated_at trigger
CREATE TRIGGER update_user_context_updated_at BEFORE UPDATE ON user_context
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own context" ON user_context
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own context" ON user_context
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own context" ON user_context
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own context" ON user_context
    FOR DELETE USING (auth.uid() = user_id);

-- Function to store user context from captured conversations
CREATE OR REPLACE FUNCTION public.store_user_context(
    p_user_id UUID,
    p_conversation_id UUID,
    p_site TEXT,
    p_provider TEXT,
    p_title TEXT,
    p_content TEXT,
    p_context_type TEXT DEFAULT 'conversation',
    p_importance INTEGER DEFAULT 5,
    p_pii BOOLEAN DEFAULT FALSE,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    context_id UUID;
BEGIN
    -- Insert or update user context
    INSERT INTO user_context (
        user_id, conversation_id, site, provider, context_type, 
        title, content, importance, pii, metadata
    )
    VALUES (
        p_user_id, p_conversation_id, p_site, p_provider, p_context_type,
        p_title, p_content, p_importance, p_pii, p_metadata
    )
    ON CONFLICT (user_id, conversation_id) 
    DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        importance = EXCLUDED.importance,
        pii = EXCLUDED.pii,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    RETURNING id INTO context_id;
    
    RETURN context_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to get context profile with conversation history
CREATE OR REPLACE FUNCTION public.get_enhanced_context_profile(
    p_user_id UUID,
    p_site TEXT,
    p_provider TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    profile_record RECORD;
    memory_record RECORD;
    context_record RECORD;
    memories JSONB := '[]'::JSONB;
    context_history JSONB := '[]'::JSONB;
    result JSONB;
BEGIN
    -- Get site policy and profile
    SELECT sp.profile_id, p.name, p.scope, p.redaction_rules, p.token_budget
    INTO profile_record
    FROM site_policies sp
    JOIN profiles p ON p.id = sp.profile_id
    WHERE sp.user_id = p_user_id 
    AND sp.origin = p_site 
    AND sp.enabled = TRUE 
    AND sp.inject = TRUE;
    
    -- Return empty if no policy found
    IF profile_record IS NULL THEN
        RETURN '{"system_prompt": "", "hints": [], "facts": [], "conversation_history": [], "estimated_tokens": 0}'::JSONB;
    END IF;
    
    -- Get relevant memories (existing functionality)
    FOR memory_record IN
        SELECT content, importance, pii, type
        FROM memories
        WHERE user_id = p_user_id
        AND (profile_record.redaction_rules->>'hide_pii' = 'false' OR pii = FALSE)
        ORDER BY importance DESC, created_at DESC
        LIMIT 15
    LOOP
        memories := memories || jsonb_build_object(
            'content', memory_record.content,
            'importance', memory_record.importance,
            'pii', memory_record.pii,
            'type', memory_record.type
        );
    END LOOP;
    
    -- Get recent conversation context
    FOR context_record IN
        SELECT title, content, importance, context_type, created_at
        FROM user_context
        WHERE user_id = p_user_id
        AND site = p_site
        AND (profile_record.redaction_rules->>'hide_pii' = 'false' OR pii = FALSE)
        ORDER BY importance DESC, created_at DESC
        LIMIT 10
    LOOP
        context_history := context_history || jsonb_build_object(
            'title', context_record.title,
            'content', context_record.content,
            'importance', context_record.importance,
            'type', context_record.context_type,
            'date', context_record.created_at
        );
    END LOOP;
    
    -- Build enhanced result
    result := jsonb_build_object(
        'system_prompt', 'You are an AI assistant with access to the user''s context, preferences, and conversation history.',
        'hints', ARRAY[
            'Use the user''s preferences and context when responding',
            'Be consistent with previous conversations',
            'Remember important facts about the user',
            'Reference relevant conversation history when appropriate'
        ],
        'facts', memories,
        'conversation_history', context_history,
        'estimated_tokens', LEAST(profile_record.token_budget, 800),
        'profile_name', profile_record.name,
        'profile_scope', profile_record.scope
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to extract and store context from conversation messages
CREATE OR REPLACE FUNCTION public.extract_context_from_conversation(
    p_conversation_id UUID,
    p_user_id UUID,
    p_site TEXT,
    p_provider TEXT
)
RETURNS UUID AS $$
DECLARE
    context_id UUID;
    conversation_title TEXT;
    conversation_content TEXT;
    message_count INTEGER;
BEGIN
    -- Get conversation details
    SELECT c.title, COUNT(m.id)
    INTO conversation_title, message_count
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE c.id = p_conversation_id AND c.user_id = p_user_id
    GROUP BY c.id, c.title;
    
    -- Build conversation content from recent messages
    SELECT STRING_AGG(
        CASE 
            WHEN m.role = 'user' THEN 'User: ' || m.content
            WHEN m.role = 'assistant' THEN 'Assistant: ' || m.content
            ELSE m.role || ': ' || m.content
        END, 
        E'\n'
    )
    INTO conversation_content
    FROM messages m
    WHERE m.conversation_id = p_conversation_id
    ORDER BY m.ts DESC
    LIMIT 10;
    
    -- Store as user context
    SELECT public.store_user_context(
        p_user_id,
        p_conversation_id,
        p_site,
        p_provider,
        conversation_title,
        conversation_content,
        'conversation',
        CASE 
            WHEN message_count > 20 THEN 8
            WHEN message_count > 10 THEN 6
            ELSE 5
        END,
        FALSE,
        jsonb_build_object(
            'message_count', message_count,
            'provider', p_provider,
            'site', p_site
        )
    ) INTO context_id;
    
    RETURN context_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
