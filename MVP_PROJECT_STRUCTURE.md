# Migration Copilot MVP - Project Structure

## Directory Layout
```
migration-copilot-mvp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── models.py            # Data models (Pydantic)
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── csv_parser.py    # CSV parsing logic
│   │   │   ├── ai_mapper.py     # AI field mapping with Gemini
│   │   │   ├── transformer.py   # WooCommerce → Shopify transformation
│   │   │   └── override_handler.py  # Handle >3 attribute logic
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py        # Upload CSV endpoint
│   │   │   ├── transform.py     # Transform & download endpoints
│   │   │   └── overrides.py     # Override management
│   │   └── database.py          # SQLite setup
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main React app
│   │   ├── components/
│   │   │   ├── FileUpload.jsx
│   │   │   ├── ProductPreview.jsx
│   │   │   ├── OverridePanel.jsx
│   │   │   └── DownloadButton.jsx
│   │   ├── api/
│   │   │   └── client.js        # API client
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
├── README.md
└── docker-compose.yml           # Optional: for easy deployment
```

## Technology Choices

### Backend: FastAPI (Python)
**Why?**
- Fastest Python framework (async)
- Auto-generates API docs (Swagger UI)
- Type safety with Pydantic
- Easy to deploy
- You already know Python from Streamlit work

### Frontend: React + Vite
**Why?**
- Vite = instant hot reload (much faster than Create React App)
- Component reusability
- Easy to iterate with Cursor AI
- Can upgrade to Next.js later for SSR if needed

### AI: Google Gemini
**Why?**
- You already have it working in n8n
- Fast and cheap for pilot
- Good at structured JSON output

### Database: SQLite → Postgres
**Why SQLite for pilot?**
- Zero setup
- File-based (easy to backup)
- Perfect for 1-5 agencies

**Why Postgres later?**
- Multi-user
- Better performance at scale
- Required for production deployment

## Deployment Strategy

### Pilot (Week 1-2):
- **Backend**: Railway.app or Render.com (free tier)
- **Frontend**: Vercel or Netlify (free tier)
- **Database**: SQLite file on backend server

### Production (After pilot validation):
- **Backend**: Railway/Render/AWS (paid tier)
- **Frontend**: Vercel Pro
- **Database**: Managed Postgres (Railway/Supabase)
- **File Storage**: S3 or Cloudflare R2

## Development Workflow with Cursor

1. **Create project folder**
2. **Open in Cursor**
3. **Use Cursor AI to:**
   - Generate boilerplate code
   - Fix bugs as you go
   - Add features iteratively
   - Refactor and optimize

4. **Cursor Commands you'll use:**
   - `Cmd/Ctrl + K`: Edit code with AI
   - `Cmd/Ctrl + L`: Chat with AI about your code
   - `Cmd/Ctrl + I`: AI writes code for you

## MVP Feature Roadmap

### Phase 1: Core Transformation (Week 1)
- [ ] CSV upload
- [ ] AI field mapping
- [ ] Basic transformation (no overrides yet)
- [ ] Download Shopify CSV

### Phase 2: Override System (Week 1-2)
- [ ] Detect products with >3 attributes
- [ ] Show override UI
- [ ] Apply overrides
- [ ] Re-transform with overrides

### Phase 3: Polish for Pilot (Week 2)
- [ ] Session management
- [ ] Error handling
- [ ] Loading states
- [ ] Deploy to production

### Phase 4: Pilot with 5 Agencies (Week 3-4)
- [ ] Collect feedback
- [ ] Fix bugs
- [ ] Track usage metrics

## Next Steps

1. I'll generate the complete starter code
2. You create a new folder and open it in Cursor
3. Copy the code I provide
4. Use Cursor AI to iterate and build features
5. Deploy and test with your first agency
