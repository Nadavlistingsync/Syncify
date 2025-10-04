# Supabase Setup Guide for Syncify

## Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with email: `nadav.benedek@xeinst.com`
4. Verify your email address

## Step 2: Create New Project
1. Click "New Project"
2. **Project Name**: `syncify`
3. **Organization**: Select your personal organization
4. **Database Password**: Generate a strong password and save it securely
5. **Region**: Choose closest to your location
6. Click "Create new project"
7. Wait 2-3 minutes for provisioning

## Step 3: Run Database Migrations

### Migration 1: Initial Schema
Copy and paste this into the SQL Editor and run:

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table
CREATE TABLE profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('personal', 'work', 'custom')) DEFAULT 'personal',
    redaction_rules JSONB DEFAULT '{}',
    token_budget INTEGER DEFAULT 1000,
    default_for_sites TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memories table
CREATE TABLE memories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'skill', 'project', 'note')) DEFAULT 'note',
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    pii BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    provider TEXT NOT NULL,
    site TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    ts TIMESTAMPTZ DEFAULT NOW(),
    provider TEXT NOT NULL
);

-- Site policies table
CREATE TABLE site_policies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    capture BOOLEAN DEFAULT TRUE,
    inject BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, origin)
);

-- Events table for telemetry
CREATE TABLE events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('capture', 'inject', 'error')),
    payload JSONB DEFAULT '{}',
    ts TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_importance ON memories(importance DESC);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_provider ON conversations(provider);
CREATE INDEX idx_conversations_site ON conversations(site);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_ts ON messages(ts DESC);
CREATE INDEX idx_site_policies_user_id ON site_policies(user_id);
CREATE INDEX idx_site_policies_origin ON site_policies(origin);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_kind ON events(kind);
CREATE INDEX idx_events_ts ON events(ts DESC);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memories_updated_at BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_site_policies_updated_at BEFORE UPDATE ON site_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 2: RLS Policies
```sql
-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profiles" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profiles" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profiles" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Memories RLS policies
CREATE POLICY "Users can view their own memories" ON memories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memories" ON memories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memories" ON memories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memories" ON memories
    FOR DELETE USING (auth.uid() = user_id);

-- Conversations RLS policies
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON conversations
    FOR DELETE USING (auth.uid() = user_id);

-- Messages RLS policies (inherited from conversations)
CREATE POLICY "Users can view messages from their conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to their conversations" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update messages in their conversations" ON messages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages from their conversations" ON messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM conversations 
            WHERE conversations.id = messages.conversation_id 
            AND conversations.user_id = auth.uid()
        )
    );

-- Site policies RLS policies
CREATE POLICY "Users can view their own site policies" ON site_policies
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own site policies" ON site_policies
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own site policies" ON site_policies
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own site policies" ON site_policies
    FOR DELETE USING (auth.uid() = user_id);

-- Events RLS policies
CREATE POLICY "Users can view their own events" ON events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events" ON events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events" ON events
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events" ON events
    FOR DELETE USING (auth.uid() = user_id);
```

### Migration 3: Seed Data and Functions
```sql
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
```

### Migration 4: User Context Storage
```sql
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
```

## Step 4: Get API Keys
1. Go to **Settings** → **API** in your Supabase dashboard
2. Copy the following:
   - **Project URL** (looks like: `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
   - **service_role** key (starts with `eyJ...`)

## Step 5: Configure Environment Variables
Create `.env.local` file in the `web` directory with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret for additional security
JWT_SECRET=your_random_jwt_secret_here

# Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 6: Test the Setup
1. Start the development server: `npm run dev` in the web directory
2. Check that the app loads without errors
3. Try signing up/logging in to verify authentication works

## Notes
- Save your database password securely - you'll need it for direct database access
- The service_role key has admin privileges - keep it secret
- The anon key is safe to use in client-side code
- All tables have Row Level Security enabled for user data isolation
