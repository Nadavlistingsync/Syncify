# Syncify - AI Context Synchronization Platform

Syncify is a comprehensive platform that synchronizes your AI context across all LLMs and websites you use. Never lose your conversation history or repeat yourself again.

## 🚀 Features

### Core Features
- **Universal LLM Support**: Works with ChatGPT, Claude, Gemini, and any other AI platform
- **Real-time Context Sync**: Instant synchronization across all connected LLMs
- **Smart Memory Management**: Persistent conversation history and context compression
- **Cross-Platform Access**: Web dashboard, Chrome extension, and API
- **Advanced Search**: Semantic search across all your AI conversations
- **Privacy First**: Your data is encrypted and you control what gets shared

### Advanced Features
- **Context Compression**: Intelligent summarization to manage token limits
- **Conflict Resolution**: Smart handling of concurrent updates
- **Custom Memory Types**: Code snippets, preferences, knowledge bases
- **Context Versioning**: Track changes over time
- **Chunked Data Export**: Download large datasets in small, manageable chunks with progress tracking
- **Team Collaboration**: Shared contexts and permissions (coming soon)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API    │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js)      │◄──►│   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │                        ▼                        │
         │              ┌──────────────────┐               │
         │              │   Chrome Ext     │               │
         │              │  ┌──────────────┐│               │
         │              │  │  Universal   ││               │
         │              │  │  Site Support││               │
         │              │  └──────────────┘│               │
         │              └──────────────────┘               │
         │                                                 │
         ▼                                                 ▼
┌─────────────────┐                              ┌─────────────────┐
│   Real-time     │                              │   Vector DB     │
│   Sync Engine   │                              │   (Chroma)      │
└─────────────────┘                              └─────────────────┘
```

## 🛠️ Tech Stack

### Backend
- **Framework**: Next.js 14 with App Router
- **Database**: Supabase (PostgreSQL + Auth + Realtime)
- **Authentication**: Supabase Auth with JWT
- **API**: RESTful endpoints with TypeScript
- **Validation**: Zod schemas

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: Zustand + React Query
- **Forms**: React Hook Form with validation

### Chrome Extension
- **Manifest**: V3 with service worker
- **Content Scripts**: Universal site detection and injection
- **Background**: Message handling and API communication
- **Storage**: Chrome storage API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Chrome browser (for extension)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/syncify.git
cd syncify
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → API to get your project URL and anon key
3. Run the SQL migrations in the `supabase/migrations/` folder:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_seed_data.sql`

### 3. Configure Environment Variables

Create `.env.local` in the `web/` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Secret for additional security
JWT_SECRET=your_jwt_secret_key

# Optional: Provider API Keys (for server-side utilities)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_API_KEY=your_google_api_key

# Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Install Dependencies and Start

```bash
# Install web app dependencies
cd web
npm install

# Start the development server
npm run dev
```

The web app will be available at `http://localhost:3000`

### 5. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder
4. The Syncify extension should appear in your extensions list

## 📖 Usage

### Web App

1. **Sign Up/Login**: Create an account or sign in
2. **Add Your Context**: Go to "Your Context" to add memories, facts, and preferences
3. **Configure Sites**: In "Resources", add websites where you want context sync
4. **Monitor Activity**: Use the "Dashboard" to see sync activity and statistics

### Chrome Extension

1. **Connect Account**: Click the extension icon and connect your Syncify account
2. **Visit AI Sites**: Go to ChatGPT, Claude, Gemini, or any AI website
3. **Automatic Sync**: The extension will automatically capture and inject context
4. **Manage Settings**: Right-click the extension icon → Options for advanced settings

### API Usage

```bash
# Get context profile for injection
GET /api/context/profile?site=chat.openai.com&provider=openai

# Capture conversation context
POST /api/events
{
  "kind": "capture",
  "payload": {
    "site": "chat.openai.com",
    "messages": [...]
  }
}

# Get user memories
GET /api/memories?type=fact&limit=10
```

## 📤 Data Export & Privacy

### Chunked Export System

Syncify includes a sophisticated chunked export system that allows you to download large datasets without timeouts or memory issues:

#### Features
- **Progressive Download**: Data is downloaded in small chunks (50 records per chunk)
- **Progress Tracking**: Real-time progress updates with detailed status
- **Multiple Formats**: Export as JSON (complete) or CSV (summary)
- **Privacy Controls**: Choose between safe (redacted) or full exports
- **Cancellation**: Stop long-running exports at any time

#### How It Works

1. **Export Manifest**: The system first creates a manifest showing total chunks needed
2. **Chunked Download**: Data is downloaded in small batches to prevent timeouts
3. **Progress Updates**: Real-time progress is shown to the user
4. **Data Assembly**: All chunks are combined into a single export file
5. **Download**: The complete export file is downloaded to your device

#### API Endpoints

```bash
# Get export manifest (shows total chunks needed)
POST /api/export/chunked
{
  "format": "json",
  "includeRedacted": false,
  "chunkSize": 50
}

# Download individual chunk
GET /api/export/chunked?dataType=memories&chunk=0&chunkSize=50

# Legacy single-file export (for small datasets)
GET /api/export?format=json&includeRedacted=false
```

#### Privacy Levels

- **Safe Export**: Automatically redacts sensitive information (emails, phone numbers, API keys)
- **Full Export**: Includes all data (use only if you understand the privacy implications)

#### Usage in Web App

1. Go to "Resources" → "Data Management"
2. Choose export format (JSON or CSV)
3. Select privacy level (Safe or Full)
4. Click "Export Safe JSON" or "Export CSV"
5. Watch the progress dialog as data downloads in chunks
6. Cancel anytime if needed

## 🔧 Configuration

### Site Policies

Configure which sites can capture and inject your context:

```json
{
  "origin": "chat.openai.com",
  "enabled": true,
  "capture": true,
  "inject": true,
  "profile_id": "uuid-of-profile"
}
```

### Context Profiles

Create different context profiles for different use cases:

- **Personal**: General facts and preferences
- **Work**: Professional context and project information
- **Custom**: Specific use cases with custom token budgets

### Privacy Settings

- **PII Protection**: Mark sensitive memories as private
- **Site Allowlist**: Only sync on authorized domains
- **Token Budgets**: Limit context size per injection
- **Data Export**: Download all your data at any time

## 🔒 Privacy & Security

### Data Protection
- **Encryption**: All data encrypted in transit and at rest
- **Access Control**: Row-level security with Supabase RLS
- **Authentication**: JWT tokens with automatic rotation
- **Privacy Controls**: Granular control over what gets shared

### Compliance
- **GDPR Ready**: Full data export and deletion capabilities
- **Transparent**: Clear privacy policy and data usage
- **User Control**: You decide what gets shared with each AI
- **Audit Trail**: Complete activity logging

## 🧪 Development

### Project Structure

```
syncify/
├── web/                    # Next.js web application
│   ├── app/               # App Router pages and API routes
│   ├── components/        # React components
│   ├── lib/              # Utilities and configurations
│   └── public/           # Static assets
├── extension/            # Chrome extension
│   ├── background.js     # Service worker
│   ├── content.js        # Content script
│   ├── popup.js          # Extension popup
│   └── options.js        # Options page
├── supabase/            # Database migrations
│   └── migrations/      # SQL migration files
└── docs/               # Documentation
```

### Available Scripts

```bash
# Web app
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler

# Extension (manual testing)
# Load extension in Chrome developer mode
```

### Environment Setup

1. **Database**: Use Supabase for development and production
2. **API Keys**: Get keys from OpenAI, Anthropic, Google for advanced features
3. **Domain**: Configure your domain for production deployment
4. **SSL**: Ensure HTTPS for production (required for Chrome extensions)

## 🚀 Deployment

### Web App (Vercel)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Chrome Extension

1. Build the extension: `npm run build:extension`
2. Create a Chrome Web Store developer account
3. Upload the built extension for review

### Database (Supabase)

1. Create production Supabase project
2. Run migrations in production
3. Configure production environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Use conventional commit messages
- Update documentation for API changes
- Ensure accessibility compliance

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📧 Email: support@syncify.ai
- 💬 Discord: [Join our community](https://discord.gg/syncify)
- 📖 Docs: [docs.syncify.ai](https://docs.syncify.ai)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/syncify/issues)

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Core web application
- [x] Chrome extension
- [x] Universal site support
- [x] Basic context sync

### Phase 2 (Next)
- [ ] Mobile app (React Native)
- [ ] Desktop app (Electron)
- [ ] Advanced AI features
- [ ] Team collaboration

### Phase 3 (Future)
- [ ] Enterprise SSO
- [ ] Custom model support
- [ ] API marketplace
- [ ] Advanced analytics

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [Supabase](https://supabase.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Lucide](https://lucide.dev/)

---

**Made with ❤️ by the Syncify team**

*Never lose your AI context again.*

