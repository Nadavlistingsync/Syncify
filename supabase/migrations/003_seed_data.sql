-- Function to create default profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default personal profile
    INSERT INTO public.profiles (user_id, name, scope, token_budget)
    VALUES (NEW.id, 'Personal', 'personal', 1000);
    
    -- Create default work profile
    INSERT INTO public.profiles (user_id, name, scope, token_budget)
    VALUES (NEW.id, 'Work', 'work', 1000);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default profiles when user signs up
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get or create site policy
CREATE OR REPLACE FUNCTION public.get_or_create_site_policy(
    p_user_id UUID,
    p_origin TEXT,
    p_profile_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    policy_id UUID;
    default_profile_id UUID;
BEGIN
    -- Get or create default profile if none provided
    IF p_profile_id IS NULL THEN
        SELECT id INTO default_profile_id 
        FROM profiles 
        WHERE user_id = p_user_id AND scope = 'personal' 
        LIMIT 1;
        
        IF default_profile_id IS NULL THEN
            SELECT id INTO default_profile_id 
            FROM profiles 
            WHERE user_id = p_user_id 
            LIMIT 1;
        END IF;
        
        p_profile_id := default_profile_id;
    END IF;
    
    -- Get existing policy
    SELECT id INTO policy_id 
    FROM site_policies 
    WHERE user_id = p_user_id AND origin = p_origin;
    
    -- Create if doesn't exist
    IF policy_id IS NULL THEN
        INSERT INTO site_policies (user_id, origin, profile_id)
        VALUES (p_user_id, p_origin, p_profile_id)
        RETURNING id INTO policy_id;
    END IF;
    
    RETURN policy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get context profile for injection
CREATE OR REPLACE FUNCTION public.get_context_profile(
    p_user_id UUID,
    p_site TEXT,
    p_provider TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    profile_record RECORD;
    memory_record RECORD;
    memories JSONB := '[]'::JSONB;
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
        RETURN '{"system_prompt": "", "hints": [], "facts": [], "estimated_tokens": 0}'::JSONB;
    END IF;
    
    -- Get relevant memories
    FOR memory_record IN
        SELECT content, importance, pii
        FROM memories
        WHERE user_id = p_user_id
        AND (profile_record.redaction_rules->>'hide_pii' = 'false' OR pii = FALSE)
        ORDER BY importance DESC, created_at DESC
        LIMIT 20
    LOOP
        memories := memories || jsonb_build_object(
            'content', memory_record.content,
            'importance', memory_record.importance,
            'pii', memory_record.pii
        );
    END LOOP;
    
    -- Build result
    result := jsonb_build_object(
        'system_prompt', 'You are an AI assistant with access to the user''s context and preferences.',
        'hints', ARRAY[
            'Use the user''s preferences and context when responding',
            'Be consistent with previous conversations',
            'Remember important facts about the user'
        ],
        'facts', memories,
        'estimated_tokens', LEAST(profile_record.token_budget, 500),
        'profile_name', profile_record.name,
        'profile_scope', profile_record.scope
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

