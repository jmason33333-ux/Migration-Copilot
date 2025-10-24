# Migration Copilot MVP - Complete Setup Guide

Your complete, production-ready MVP is ready to build!
**Time to production: 2-3 weeks**

---

## 📋 What You Have

**✅ Complete Backend** (FastAPI + Postgres)
- API routes for upload, mapping, transform, download
- AI-powered mapping with Gemini
- Product transformation logic (ready for your n8n port)
- Bulk override system
- Database models and persistence

**✅ Complete Frontend** (React + Vite + Tailwind)
- Modern drag & drop upload
- AI mapping review
- Seamless transformation flow
- Bulk override modal with checkboxes
- Clean, agency-ready UI

**✅ Database Schema** (Postgres)
- Migrations table
- Products table with override support
- Session management

---

## 🚀 Quick Start (10 Minutes)

### Prerequisites
- Python 3.9+ (for backend)
- Node.js 18+ (for frontend)
- Postgres database
- Gemini API key

### Step 1: Clone & Setup Folders
```bash
# Create project folder
mkdir migration-copilot-mvp
cd migration-copilot-mvp

# Create backend and frontend folders
mkdir backend frontend
```

### Step 2: Setup Backend
```bash
cd backend

# Create folder structure
mkdir -p app/routes app/services
touch app/__init__.py app/routes/__init__.py app/services/__init__.py

# Copy all backend files from:
# - COMPLETE_BACKEND_CODE.md
# - COMPLETE_BACKEND_SERVICES.md

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env and add:
#   - GEMINI_API_KEY
#   - DATABASE_URL (postgres://user:pass@localhost:5432/migration_copilot)

# Create database
createdb migration_copilot

# Initialize database
python -c "from app.database import init_db; init_db()"

# Run backend
uvicorn app.main:app --reload
```

Backend should now be running at http://localhost:8000

### Step 3: Setup Frontend
```bash
# In new terminal
cd frontend

# Create folder structure
mkdir -p src/components src/hooks src/api

# Copy all frontend files from:
# - COMPLETE_FRONTEND_CODE.md
# - COMPLETE_FRONTEND_COMPONENTS.md

# Install dependencies
npm install

# Run frontend
npm run dev
```

Frontend should now be running at http://localhost:5173

### Step 4: Test It!
1. Open http://localhost:5173
2. Drop a CSV file
3. Watch the magic happen!

---

## 🔧 Customizing in Cursor

Now that you have the foundation running, open the project in Cursor to customize:

### 1. Port Your n8n Transformation Logic

**File:** `backend/app/services/transformer.py`

**Cursor Prompt:**
```
I have JavaScript transformation code from n8n that converts WooCommerce
products to Shopify format. Here's the code:

[Paste your n8n Transform & QA node code]

Please convert this to Python and integrate it into the transform() method
of the ProductTransformer class. Preserve all the logic for:
- Product grouping
- Attribute analysis
- Option selection (3 max)
- Overflow handling
- QA checks
```

### 2. Improve the UI

**Cursor Prompts:**
```
"Add drag-and-drop reordering to the attribute checkboxes in BulkEditModal"
"Make the upload zone show a preview thumbnail of the CSV"
"Add a progress bar showing transformation steps"
"Improve the mobile responsive design"
```

### 3. Add Features

**Cursor Prompts:**
```
"Add a 'Recent Migrations' sidebar showing upload history"
"Create a mapping library that auto-applies saved mappings"
"Add CSV diff view to show before/after changes"
"Implement undo/redo for override changes"
```

### 4. Polish & Deploy

**Cursor Prompts:**
```
"Add error boundary components for better error handling"
"Optimize the database queries for faster performance"
"Add loading skeletons for better perceived performance"
"Create a Docker Compose file for easy deployment"
```

---

## 📁 Project Structure Reference

```
migration-copilot-mvp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI app
│   │   ├── database.py                # Postgres connection
│   │   ├── models.py                  # SQLAlchemy models
│   │   ├── schemas.py                 # Pydantic schemas
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py              # Upload CSV
│   │   │   ├── migrations.py          # List migrations
│   │   │   └── transform.py           # Transform & download
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── csv_service.py         # CSV parsing
│   │       ├── ai_mapper.py           # Gemini AI mapping
│   │       ├── transformer.py         # 🎯 Port n8n logic here
│   │       ├── attribute_analyzer.py  # Detect >3 attributes
│   │       └── override_handler.py    # Bulk override logic
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── App.jsx                    # Main app
    │   ├── main.jsx
    │   ├── index.css
    │   ├── components/
    │   │   ├── UploadZone.jsx         # Drag & drop upload
    │   │   ├── MappingReview.jsx      # Review AI mappings
    │   │   ├── OverridePanel.jsx      # Override products
    │   │   ├── BulkEditModal.jsx      # 🎯 Bulk edit UI
    │   │   ├── ProductCard.jsx        # Product display
    │   │   └── ResultsSummary.jsx     # Success & download
    │   ├── hooks/
    │   │   └── useMigration.js        # State management
    │   └── api/
    │       └── client.js              # API calls
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    └── index.html
```

---

## 🎯 Development Workflow

### Daily Workflow:
1. **Open Cursor** (Cmd/Ctrl + Space to search files)
2. **Pick a file to work on**
3. **Use Cursor AI:**
   - `Cmd/Ctrl + K`: Edit code inline
   - `Cmd/Ctrl + L`: Chat about code
   - `Cmd/Ctrl + I`: Generate new code
4. **Test in browser**
5. **Commit when working**
6. **Repeat!**

### Common Cursor Prompts:

**For Backend:**
```
"Add validation to ensure CSV has required columns"
"Implement retry logic for failed Gemini API calls"
"Add logging for debugging transformation issues"
"Create unit tests for the transformer service"
```

**For Frontend:**
```
"Add keyboard shortcuts for common actions"
"Implement auto-save so users don't lose progress"
"Add animations for smoother transitions"
"Create a dark mode toggle"
```

**For Integration:**
```
"Add websocket support for real-time progress updates"
"Implement file chunking for large CSV uploads"
"Add background job processing with Celery"
"Create admin dashboard to monitor migrations"
```

---

## 🚢 Deployment

### Option 1: Railway (Easiest - Recommended for MVP)

**Backend + Database:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway up

# Add Postgres database in Railway dashboard
# Copy DATABASE_URL from Railway to your .env
```

**Frontend:**
```bash
cd frontend
railway up
```

### Option 2: Render

1. Push code to GitHub
2. Go to render.com
3. **Backend:**
   - New → Web Service
   - Connect repo
   - Build: `cd backend && pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. **Frontend:**
   - New → Static Site
   - Build: `cd frontend && npm install && npm run build`
   - Publish: `frontend/dist`
5. **Database:**
   - New → PostgreSQL
   - Copy connection string to backend env vars

### Option 3: Vercel + Railway

- **Frontend** → Vercel (best for React)
- **Backend + DB** → Railway (best for Python + Postgres)

Most agencies prefer this setup!

---

## 📊 Success Checklist

### Week 1 Goals:
- [ ] Backend running locally
- [ ] Frontend running locally
- [ ] Can upload CSV
- [ ] AI mapping works
- [ ] Basic transformation works
- [ ] Can download result

### Week 2 Goals:
- [ ] Override detection working
- [ ] Bulk edit modal functional
- [ ] Session persistence works
- [ ] Error handling polished
- [ ] UI looks professional

### Week 3 Goals:
- [ ] Deployed to production
- [ ] Tested with real agency data
- [ ] Performance optimized
- [ ] Ready for Agency #1

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check Python version
python --version  # Should be 3.9+

# Check Postgres is running
pg_isready

# Check environment variables
cat .env | grep GEMINI_API_KEY
```

### Frontend won't start
```bash
# Check Node version
node --version  # Should be 18+

# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database errors
```bash
# Reset database
dropdb migration_copilot
createdb migration_copilot
python -c "from app.database import init_db; init_db()"
```

### CORS errors
Make sure `FRONTEND_URL` in backend `.env` matches your frontend URL (usually `http://localhost:5173`)

---

## 💡 Next Steps After MVP

Once you validate with Agency #1, consider adding:

1. **Auth System** (Auth0 or Supabase)
2. **Job Queue** (Celery + Redis for async processing)
3. **Strategy Profiles** (Save per-org defaults)
4. **Mapping Library UI** (Visual mapping editor)
5. **CSV Diff View** (Before/after comparison)
6. **Multi-agent System** (Full agent orchestration)
7. **Analytics Dashboard** (Track usage, success rates)

But for now, **focus on the core value**: Clean CSV transformation with smart override handling!

---

## 🎓 Learning Resources

### Cursor Tips:
- https://cursor.com/docs
- Use `@filename` in chat to reference specific files
- Use `#symbol` to reference functions/classes
- Press `Cmd/Ctrl + /` for quick comments

### FastAPI:
- https://fastapi.tiangolo.com/tutorial/
- Great for: async API, auto docs, type safety

### React + Vite:
- https://vitejs.dev/guide/
- https://react.dev/learn

### Tailwind CSS:
- https://tailwindcss.com/docs
- Use their component examples for inspiration

---

## ✅ You're Ready!

You now have:
- ✅ Complete backend code
- ✅ Complete frontend code
- ✅ Database schema
- ✅ Setup instructions
- ✅ Cursor prompts to customize
- ✅ Deployment guide

**Next:**
1. Copy the code into your project
2. Get it running locally
3. Open in Cursor
4. Use Cursor AI to customize and build!

**Good luck building your MVP! 🚀**

Questions? Issues? Just ask Cursor's AI - it knows your entire codebase and can help debug, refactor, or add features instantly.
