# Syncify API Documentation

## Backend APIs Overview

### Authentication
All APIs require authentication via Supabase JWT tokens.

---

## Core APIs

### 1. Conversations API
**Base URL:** `/api/conversations`

#### GET `/api/conversations`
- **Purpose:** Retrieve user's conversations
- **Query Parameters:**
  - `provider` (optional): Filter by AI provider
  - `site` (optional): Filter by website
  - `limit` (default: 20): Number of results
  - `offset` (default: 0): Pagination offset
- **Response:** Array of conversations with messages

#### POST `/api/conversations`
- **Purpose:** Create a new conversation
- **Body:**
  ```json
  {
    "title": "string",
    "provider": "string",
    "site": "string",
    "messages": [
      {
        "role": "user|assistant|system",
        "content": "string",
        "provider": "string"
      }
    ]
  }
  ```

#### GET `/api/conversations/[id]`
- **Purpose:** Get specific conversation with messages
- **Response:** Single conversation object

#### PUT `/api/conversations/[id]`
- **Purpose:** Update conversation title
- **Body:** `{ "title": "string" }`

#### DELETE `/api/conversations/[id]`
- **Purpose:** Delete conversation and all messages

---

### 2. Memories API
**Base URL:** `/api/memories`

#### GET `/api/memories`
- **Purpose:** Retrieve user's memories
- **Query Parameters:**
  - `type` (optional): Filter by type (fact, preference, skill, project, note)
  - `limit` (default: 50): Number of results
  - `offset` (default: 0): Pagination offset
- **Response:** Array of memories sorted by importance

#### POST `/api/memories`
- **Purpose:** Create a new memory
- **Body:**
  ```json
  {
    "type": "fact|preference|skill|project|note",
    "content": "string",
    "importance": 1-10 (default: 5),
    "pii": boolean (default: false)
  }
  ```

#### GET `/api/memories/[id]`
- **Purpose:** Get specific memory
- **Response:** Single memory object

#### PUT `/api/memories/[id]`
- **Purpose:** Update memory
- **Body:** Same as POST

#### DELETE `/api/memories/[id]`
- **Purpose:** Delete memory

---

### 3. Profiles API
**Base URL:** `/api/profiles`

#### GET `/api/profiles`
- **Purpose:** Get user's profiles (Personal, Work, Custom)
- **Response:** Array of profiles

#### POST `/api/profiles`
- **Purpose:** Create a new profile
- **Body:**
  ```json
  {
    "name": "string",
    "scope": "personal|work|custom",
    "redaction_rules": {},
    "token_budget": number (default: 1000),
    "default_for_sites": ["string"]
  }
  ```

#### GET `/api/profiles/[id]`
- **Purpose:** Get specific profile
- **Response:** Single profile object

#### PUT `/api/profiles/[id]`
- **Purpose:** Update profile
- **Body:** Same as POST

#### DELETE `/api/profiles/[id]`
- **Purpose:** Delete profile

---

### 4. Site Policies API
**Base URL:** `/api/site-policies`

#### GET `/api/site-policies`
- **Purpose:** Get site-specific policies
- **Query Parameters:**
  - `origin` (optional): Filter by website origin
- **Response:** Array of policies with profile info

#### POST `/api/site-policies`
- **Purpose:** Create/update site policy
- **Body:**
  ```json
  {
    "origin": "string (website URL)",
    "profile_id": "uuid",
    "enabled": boolean (default: true),
    "capture": boolean (default: true),
    "inject": boolean (default: true)
  }
  ```

#### GET `/api/site-policies/[id]`
- **Purpose:** Get specific policy
- **Response:** Single policy object

#### PUT `/api/site-policies/[id]`
- **Purpose:** Update policy
- **Body:** Same as POST

#### DELETE `/api/site-policies/[id]`
- **Purpose:** Delete policy

---

### 5. Context Profile API
**Base URL:** `/api/context/profile`

#### GET `/api/context/profile`
- **Purpose:** Get context profile for AI injection
- **Query Parameters:**
  - `site` (required): Website URL
  - `provider` (optional): AI provider
- **Response:**
  ```json
  {
    "system_prompt": "string",
    "hints": ["string"],
    "facts": [
      {
        "content": "string",
        "importance": number,
        "pii": boolean,
        "type": "string"
      }
    ],
    "conversation_history": [
      {
        "title": "string",
        "content": "string",
        "importance": number,
        "type": "string",
        "date": "string"
      }
    ],
    "estimated_tokens": number,
    "profile_name": "string",
    "profile_scope": "string"
  }
  ```

---

### 6. User Context API
**Base URL:** `/api/user-context`

#### GET `/api/user-context`
- **Purpose:** Get stored user context
- **Query Parameters:**
  - `site` (optional): Filter by website
  - `provider` (optional): Filter by AI provider
  - `type` (optional): Filter by context type
  - `limit` (default: 20): Number of results
  - `offset` (default: 0): Pagination offset
- **Response:** Array of context objects with conversation info

#### POST `/api/user-context`
- **Purpose:** Store user context
- **Body:**
  ```json
  {
    "conversation_id": "uuid (optional)",
    "site": "string",
    "provider": "string",
    "context_type": "conversation|preference|fact|skill|note",
    "title": "string",
    "content": "string",
    "importance": 1-10 (default: 5),
    "pii": boolean (default: false),
    "metadata": {}
  }
  ```

---

### 7. Events API
**Base URL:** `/api/events`

#### POST `/api/events`
- **Purpose:** Log extension events for analytics
- **Body:**
  ```json
  {
    "kind": "capture|inject|error",
    "payload": {
      "site": "string",
      "provider": "string",
      "success": boolean,
      "error": "string",
      "response_time": number
    }
  }
  ```

#### GET `/api/events`
- **Purpose:** Get user's events
- **Query Parameters:**
  - `kind` (optional): Filter by event type
  - `limit` (default: 50): Number of results
  - `offset` (default: 0): Pagination offset
- **Response:** Array of events

---

### 8. Analytics API
**Base URL:** `/api/analytics`

#### GET `/api/analytics`
- **Purpose:** Get comprehensive analytics data
- **Query Parameters:**
  - `timeRange` (default: "30d"): Time range for analysis
- **Response:**
  ```json
  {
    "summary": {
      "total_memories": number,
      "total_conversations": number,
      "total_events": number,
      "active_sites": number
    },
    "trends": {
      "memories_by_day": [{"date": "string", "count": number}],
      "conversations_by_day": [{"date": "string", "count": number}],
      "events_by_day": [{"date": "string", "count": number}]
    },
    "top_sites": [{"site": "string", "count": number}],
    "top_providers": [{"provider": "string", "count": number}],
    "memory_breakdown": [{"type": "string", "count": number}],
    "sync_health": {
      "total_captures": number,
      "total_injections": number,
      "successful_injections": number,
      "failed_injections": number,
      "success_rate": number,
      "error_rate": number
    },
    "error_analysis": {
      "top_errors": [{"error": "string", "count": number}],
      "errors_by_site": [{"site": "string", "total_errors": number, "errors": []}],
      "total_unique_errors": number
    }
  }
  ```

---

### 9. Export API
**Base URL:** `/api/export`

#### GET `/api/export`
- **Purpose:** Export user data
- **Query Parameters:**
  - `format` (optional): Export format (json, csv)
- **Response:** File download

#### GET `/api/export/chunked`
- **Purpose:** Chunked export for large datasets
- **Query Parameters:**
  - `chunk_size` (default: 1000): Records per chunk
- **Response:** Streaming export

---

### 10. Compactor API
**Base URL:** `/api/compactor`

#### POST `/api/compactor`
- **Purpose:** Trigger data compaction job
- **Body:** `{ "force": boolean }`

#### POST `/api/compactor/trigger`
- **Purpose:** Trigger compaction via webhook
- **Body:** `{ "user_id": "string" }`

---

### 11. Telemetry API
**Base URL:** `/api/telemetry`

#### GET `/api/telemetry`
- **Purpose:** Get telemetry summary
- **Query Parameters:**
  - `days` (default: 7): Number of days to analyze
- **Response:** Telemetry data and metrics

---

### 12. Auth Callback API
**Base URL:** `/api/auth/callback`

#### GET `/api/auth/callback`
- **Purpose:** Handle Supabase auth callbacks
- **Used for:** OAuth redirects and session management

---

## Error Responses

All APIs return consistent error responses:

```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (authentication required)
- `404`: Not Found
- `500`: Internal Server Error

---

## Database Functions Used

### RPC Functions
- `get_or_create_site_policy(user_id, origin, profile_id)`
- `get_enhanced_context_profile(user_id, site, provider)`
- `store_user_context(user_id, conversation_id, site, provider, title, content, context_type, importance, pii, metadata)`
- `extract_context_from_conversation(conversation_id, user_id, site, provider)`

### Triggers
- `handle_new_user()` - Creates default profiles for new users
- `update_updated_at_column()` - Updates timestamps on record changes

---

## Chrome Extension Integration

The Chrome extension uses these APIs:
- `POST /api/conversations` - Store captured conversations
- `GET /api/context/profile` - Get context for injection
- `POST /api/events` - Log extension events
- `POST /api/user-context` - Store context from conversations

---

## Rate Limiting

Currently no rate limiting implemented. Consider implementing for production use.

---

## CORS Configuration

APIs are configured to accept requests from:
- `http://localhost:3002` (development)
- Chrome extension origins
- Production domains (to be configured)

---

## Security Features

- Row Level Security (RLS) enabled on all tables
- JWT-based authentication
- User data isolation
- PII detection and redaction
- Input validation and sanitization
