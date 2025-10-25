# Migration Copilot - Clean MVP Specification

## 🎯 Goal
A polished, production-ready migration tool that agencies will love using. Clean UI, seamless overrides, bulk editing.

---

## ✨ Core Features

### 1. **Modern Upload Experience**
- Drag & drop or click to browse
- File validation (CSV only, max 10MB)
- Upload progress indicator
- Instant preview of first 10 rows

### 2. **Smart AI Mapping**
- Automatic field detection (WooCommerce/BigCommerce/Custom)
- Visual mapping review before transform
- Confidence indicators
- One-click "Use AI Suggestions" or manual adjustments

### 3. **Seamless Transformation**
- One-click transform
- Real-time progress updates
- Success/warning notifications
- Preview transformed products

### 4. **Intelligent Override System**
- Automatic detection of products with >3 attributes
- Clean card-based UI for each product
- Drag-to-reorder attribute priority
- Bulk edit: Select multiple products → Apply same choices
- Visual diff: See what will overflow to body/metafields
- Save & re-run instantly

### 5. **Clean Results & Download**
- Success summary (X products transformed)
- Warning summary (Y products need attention)
- One-click download Shopify CSV
- "Start New Migration" button

### 6. **Session Persistence**
- Auto-save progress to database
- Refresh page without losing work
- View recent migrations
- Re-download previous CSVs

---

## 🎨 UI/UX Design Principles

### Visual Design:
- **Clean & Modern**: Tailwind CSS, rounded corners, soft shadows
- **Color Palette**:
  - Primary: Blue (#3B82F6)
  - Success: Green (#10B981)
  - Warning: Yellow (#F59E0B)
  - Error: Red (#EF4444)
  - Neutral: Gray (#6B7280)
- **Typography**: Inter font, clear hierarchy
- **Spacing**: Generous whitespace, not cramped

### User Flow:
```
1. Upload CSV (drag & drop)
   ↓
2. Preview & AI Mapping (auto-detected, reviewable)
   ↓
3. Transform (one click, progress shown)
   ↓
4. Review Results:
   - If no issues → Download
   - If overrides needed → Bulk Edit UI
   ↓
5. Apply Overrides & Re-run (seamless)
   ↓
6. Download Final CSV
```

### Key UX Improvements:
- **Progressive disclosure**: Show complexity only when needed
- **Bulk actions**: Select multiple → Apply once (not one-by-one)
- **Clear feedback**: Loading states, success messages, error explanations
- **Undo/reset**: Easy to start over or revert choices
- **Smart defaults**: AI suggests best choices, user can override

---

## 🏗️ Technical Architecture

### Backend (Python + FastAPI)
```
backend/
├── app/
│   ├── main.py                    # FastAPI app
│   ├── database.py                # Postgres connection
│   ├── models.py                  # SQLAlchemy models
│   ├── schemas.py                 # Pydantic schemas
│   ├── services/
│   │   ├── csv_service.py         # CSV parsing & validation
│   │   ├── ai_mapper.py           # Gemini AI mapping
│   │   ├── transformer.py         # Core transformation logic
│   │   ├── attribute_analyzer.py  # Detect >3 attributes
│   │   └── override_handler.py    # Apply bulk overrides
│   └── routes/
│       ├── migrations.py          # CRUD for migration sessions
│       ├── upload.py              # File upload
│       ├── transform.py           # Transform & download
│       └── overrides.py           # Override management
```

### Frontend (React + Vite + Tailwind)
```
frontend/
├── src/
│   ├── App.jsx                    # Main app component
│   ├── components/
│   │   ├── UploadZone.jsx         # Drag & drop upload
│   │   ├── MappingReview.jsx      # Review AI mapping
│   │   ├── TransformProgress.jsx  # Progress indicator
│   │   ├── OverridePanel.jsx      # Override UI
│   │   ├── BulkEditModal.jsx      # Bulk edit modal
│   │   ├── ProductCard.jsx        # Single product override
│   │   ├── ResultsSummary.jsx     # Success/warning summary
│   │   └── DownloadButton.jsx     # Download CSV
│   ├── hooks/
│   │   ├── useMigration.js        # Migration state management
│   │   └── useOverrides.js        # Override logic
│   ├── api/
│   │   └── client.js              # API client (axios)
│   └── utils/
│       └── formatters.js          # Helper functions
```

### Database Schema (Postgres)
```sql
-- Migrations table
CREATE TABLE migrations (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP,
    filename VARCHAR(255),
    row_count INTEGER,
    status VARCHAR(50),  -- 'uploaded', 'mapped', 'transformed', 'completed'
    ai_mapping JSONB,
    overrides JSONB,
    transformed_csv_url TEXT,
    decision_log JSONB
);

-- Products table (for override management)
CREATE TABLE products (
    id UUID PRIMARY KEY,
    migration_id UUID REFERENCES migrations(id),
    handle VARCHAR(255),
    title VARCHAR(255),
    varying_attributes JSONB,  -- ["Color", "Size", "Material", "Style", "Length"]
    chosen_options JSONB,      -- ["Color", "Size", "Material"]
    overflow_strategy VARCHAR(50)  -- 'append_to_body_html' or 'metafields'
);
```

---

## 🚀 Feature Breakdown

### Feature 1: Upload Experience
**User sees:**
- Large drag & drop zone
- "Drop CSV here or click to browse"
- File name and size after selection
- Upload button (disabled until file selected)

**What happens:**
1. Validate file (CSV, <10MB)
2. Upload to backend
3. Parse CSV, count rows, extract headers
4. Show preview (first 10 rows)
5. Auto-detect platform (WooCommerce/BigCommerce/Custom)

### Feature 2: AI Mapping Review
**User sees:**
- "AI detected: WooCommerce (95% confidence)"
- Table showing: Source Field → Shopify Field (with confidence %)
- Edit button per mapping
- "Looks good, proceed" or "Adjust mappings"

**What happens:**
1. Gemini analyzes headers
2. Suggests mappings with confidence scores
3. User can override any mapping
4. Saves mapping for future use (by header hash)

### Feature 3: Transformation
**User sees:**
- "Transform" button
- Progress bar: "Analyzing products... 45/120"
- Then: "Transforming... 45/120"
- Success: "✓ 120 products transformed"

**What happens:**
1. Group products (handle parent/variants)
2. Analyze attributes (detect >3 varying)
3. Apply transformation logic
4. Generate Shopify CSV
5. Run QA checks
6. Return results + products needing overrides

### Feature 4: Override System (The Key Feature!)

#### 4a. Detection
**User sees:**
- "⚠️ 12 products need your input (have >3 varying attributes)"
- List of products as cards

#### 4b. Single Product Override
**User sees (per product card):**
```
┌─────────────────────────────────────────────────┐
│ Joust Duffle Bag                                │
│                                                 │
│ Varying Attributes (5):                         │
│ ☑ Material  ☑ Style  ☑ Strap  ☐ Color  ☐ Size  │
│                                                 │
│ Selected (3): Material, Style, Strap            │
│ Overflow (2): Color, Size → Body HTML           │
│                                                 │
│ [Change Selection] [Preview Shopify Format]    │
└─────────────────────────────────────────────────┘
```

#### 4c. Bulk Edit (The MVP Secret Sauce!)
**User sees:**
1. Checkboxes on product cards: "Select for bulk edit"
2. Bottom toolbar appears: "8 products selected"
3. Button: "Apply Common Attributes"

**Bulk Edit Modal:**
```
┌─────────────────────────────────────────────────┐
│ Bulk Edit: Apply to 8 Products                  │
│                                                 │
│ Common Attributes Found:                        │
│ ☑ Material                                      │
│ ☑ Style                                         │
│ ☑ Color                                         │
│ ☑ Size                                          │
│ ☐ Activity (only in 3 products)                 │
│                                                 │
│ Choose 3 to keep as Shopify Options:            │
│ [✓] Material  [✓] Style  [✓] Color              │
│                                                 │
│ Overflow strategy for remaining:                │
│ ○ Add to Body (HTML)                            │
│ ● Add to Metafields                             │
│                                                 │
│ [Cancel]  [Apply to 8 Products]                │
└─────────────────────────────────────────────────┘
```

**What happens:**
1. Find common attributes across selected products
2. Show only attributes that exist in ALL selected
3. User picks 3
4. Apply to all selected products
5. Re-transform just those products
6. Update UI instantly

### Feature 5: Download & Results
**User sees:**
- Summary card:
  ```
  ✓ 120 products transformed
  ⚠ 0 products with warnings
  ✗ 0 products with errors

  [📥 Download Shopify CSV] [🔄 Start New Migration]
  ```

**What happens:**
1. Generate final Shopify CSV
2. Save to database/S3
3. Provide download link
4. Save migration session for history

---

## 📊 Data Flow

```
1. UPLOAD
   Frontend → POST /upload (multipart/form-data)
   Backend → Parse CSV → Save to DB → Return session_id + preview

2. AI MAPPING
   Frontend → POST /mapping (session_id)
   Backend → Call Gemini → Save mapping → Return suggestions

3. TRANSFORM
   Frontend → POST /transform (session_id, mapping)
   Backend → Transform logic → Detect overrides → Return results + products_needing_override

4. BULK OVERRIDE
   Frontend → POST /overrides/bulk (session_id, product_ids[], chosen_attributes[])
   Backend → Apply overrides → Re-transform → Return updated products

5. DOWNLOAD
   Frontend → GET /download/:session_id
   Backend → Generate CSV → Stream to client
```

---

## 🎯 Success Metrics

**User Experience:**
- Upload to download: <2 minutes (no overrides) or <5 minutes (with overrides)
- Bulk edit: Apply to 10 products in <10 seconds
- Zero page refreshes required
- Clear feedback at every step

**Technical:**
- CSV parsing: <2 seconds for 1000 rows
- AI mapping: <5 seconds
- Transformation: <10 seconds for 1000 rows
- Database queries: <100ms per query
- Page load: <2 seconds

**Business:**
- Agency satisfaction: "This is easy to use"
- Reduction in migration errors
- Time saved vs manual process

---

## 🚧 Out of Scope (For Now)

These are for AFTER pilot validation:
- Multi-user auth (hardcode single org for MVP)
- Job queue (synchronous OK for <1000 rows)
- Conversational UI (structured flow is fine)
- Advanced QA packs (basic validation only)
- Agent orchestration (single transform flow)
- CSV diff view (nice-to-have)
- Mapping library UI (auto-save is enough)
- Strategy profiles UI (hardcode defaults)

---

## 📅 Build Timeline

**Week 1:**
- Day 1-2: Backend skeleton + database setup
- Day 3-4: Core transformation logic (port from n8n)
- Day 5-7: Frontend UI shell + upload flow

**Week 2:**
- Day 1-2: AI mapping integration
- Day 3-4: Override system (single + bulk)
- Day 5-6: Download & session management
- Day 7: Polish, error handling, testing

**Week 3:**
- Deploy to production
- Test with Agency #1
- Iterate based on feedback

---

## 🎨 Visual Design Reference

**Color System:**
```css
--color-primary: #3B82F6;      /* Blue */
--color-primary-dark: #2563EB;
--color-success: #10B981;      /* Green */
--color-warning: #F59E0B;      /* Yellow */
--color-error: #EF4444;        /* Red */
--color-neutral: #6B7280;      /* Gray */
--color-background: #F9FAFB;
--color-card: #FFFFFF;
```

**Component Style:**
- Border radius: 8px (cards), 6px (buttons)
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`
- Padding: 1.5rem (cards), 0.75rem (buttons)
- Font: Inter (headings 600, body 400)

---

This MVP is **agency-ready**: Clean, intuitive, professional. Let's build it!
