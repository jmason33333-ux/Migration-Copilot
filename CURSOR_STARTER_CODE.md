# Migration Copilot MVP - Complete Starter Code

Copy these files into your project. Then open in Cursor and use AI to iterate!

---

## 📁 Backend Files

### 1. `backend/requirements.txt`
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
pydantic==2.5.0
python-dotenv==1.0.0
google-generativeai==0.3.1
pandas==2.1.3
sqlalchemy==2.0.23
aiosqlite==0.19.0
```

### 2. `backend/.env.example`
```env
# Copy to .env and fill in your values
GEMINI_API_KEY=your_gemini_api_key_here
FRONTEND_URL=http://localhost:5173
DATABASE_URL=sqlite:///./migration_copilot.db
```

### 3. `backend/app/main.py`
```python
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
from dotenv import load_dotenv
import pandas as pd
import io
import json

load_dotenv()

app = FastAPI(title="Migration Copilot API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage (upgrade to DB later)
sessions = {}

class TransformRequest(BaseModel):
    session_id: str
    overrides: Optional[Dict[str, Any]] = None
    strict_mode: bool = False

@app.get("/")
async def root():
    return {"message": "Migration Copilot API", "status": "running"}

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload and analyze CSV file"""
    try:
        # Read CSV
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        # Generate session ID
        import uuid
        session_id = str(uuid.uuid4())

        # Store session data
        sessions[session_id] = {
            "original_csv": df.to_dict('records'),
            "headers": df.columns.tolist(),
            "row_count": len(df)
        }

        return {
            "session_id": session_id,
            "headers": df.columns.tolist(),
            "row_count": len(df),
            "preview": df.head(5).to_dict('records')
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")

@app.post("/transform")
async def transform_csv(request: TransformRequest):
    """Transform CSV from WooCommerce to Shopify format"""

    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[request.session_id]

    # TODO: Call your transformation logic here
    # For now, returning mock data

    return {
        "status": "success",
        "products_needing_override": [
            {
                "handle": "joust-duffle-bag",
                "title": "Joust Duffle Bag",
                "varying_attributes": ["Material", "Style", "Strap", "Color", "Size"],
                "suggested_three": ["Material", "Style", "Strap"]
            }
        ],
        "transformed_count": session["row_count"]
    }

@app.post("/download")
async def download_csv(request: TransformRequest):
    """Download transformed Shopify CSV"""

    if request.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    # TODO: Generate actual Shopify CSV
    # For now, returning sample
    sample_csv = "Handle,Title,Body (HTML),Vendor,Option1 Name,Option1 Value,Variant SKU,Variant Price\n"
    sample_csv += "test-product,Test Product,Description,Vendor,Size,M,TEST-001,29.99\n"

    return StreamingResponse(
        io.BytesIO(sample_csv.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=shopify_import.csv"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 4. `backend/app/services/transformer.py`
```python
"""
WooCommerce → Shopify transformation logic
This is where you'll port your n8n Transform & QA node code
"""
import pandas as pd
from typing import Dict, List, Any, Optional

class ProductTransformer:
    """Transforms WooCommerce CSV to Shopify format"""

    def __init__(self):
        self.shopify_columns = [
            "Handle", "Title", "Body (HTML)", "Vendor", "Tags",
            "Option1 Name", "Option1 Value",
            "Option2 Name", "Option2 Value",
            "Option3 Name", "Option3 Value",
            "Variant SKU", "Variant Price", "Variant Compare At Price",
            "Variant Inventory Qty", "Image Src", "Metafields"
        ]

    def transform(
        self,
        rows: List[Dict[str, Any]],
        mapping: Dict[str, str],
        overrides: Optional[Dict[str, Any]] = None
    ) -> pd.DataFrame:
        """
        Transform WooCommerce products to Shopify format

        Args:
            rows: List of product dictionaries from CSV
            mapping: Field mapping (woo_field → shopify_field)
            overrides: Per-product attribute overrides

        Returns:
            DataFrame ready for Shopify CSV export
        """
        # TODO: Implement full transformation logic
        # This is where you port your n8n code

        transformed = []

        for row in rows:
            shopify_row = self._transform_row(row, mapping, overrides)
            transformed.append(shopify_row)

        return pd.DataFrame(transformed)

    def _transform_row(
        self,
        row: Dict[str, Any],
        mapping: Dict[str, str],
        overrides: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Transform a single product row"""

        # Extract handle
        handle = self._create_handle(row.get('Name', ''))

        # Build Shopify row
        shopify_row = {
            "Handle": handle,
            "Title": row.get('Name', ''),
            "Body (HTML)": row.get('Description', ''),
            "Vendor": row.get('Brand', ''),
            # ... add more fields
        }

        # Apply overrides if provided
        if overrides and handle in overrides.get('per_product', {}):
            product_override = overrides['per_product'][handle]
            # Apply chosen options
            chosen = product_override.get('chosen_options', [])
            # ... implement override logic

        return shopify_row

    def _create_handle(self, title: str) -> str:
        """Convert title to Shopify handle (kebab-case)"""
        return title.lower().replace(' ', '-').replace('&', 'and')

    def analyze_attributes(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze products to find those with >3 varying attributes

        Returns:
            {
                "products_needing_override": [...],
                "suggested_mappings": {...}
            }
        """
        # TODO: Implement attribute analysis
        # This detects which products have >3 varying attributes

        return {
            "products_needing_override": [],
            "suggested_mappings": {}
        }
```

### 5. `backend/app/services/ai_mapper.py`
```python
"""
AI-powered field mapping using Google Gemini
"""
import google.generativeai as genai
import os
import json
from typing import List, Dict, Any

class AIMapper:
    """Uses Gemini to intelligently map CSV fields to Shopify"""

    def __init__(self):
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')

    async def suggest_mapping(self, headers: List[str]) -> Dict[str, Any]:
        """
        Analyze CSV headers and suggest field mapping

        Args:
            headers: List of CSV column names

        Returns:
            {
                "source": {"type": "woocommerce|bigcommerce|custom", "confidence": 0.95},
                "mapping": [
                    {"source": "Name", "shopify": "Title", "confidence": 0.98},
                    ...
                ],
                "notes": ["Detected WooCommerce format", ...]
            }
        """

        prompt = f"""You are a Shopify migration expert. Analyze these CSV headers and suggest field mappings.

CSV Headers: {json.dumps(headers)}

Common mappings:
- Name/Product Name → Title
- Description/Short description → Body (HTML)
- SKU → Variant SKU
- Regular price/Price → Variant Price
- Sale price → Variant Compare At Price
- Images/Image URL → Image Src
- Attribute 1 name/value → Option1 Name/Value

Return JSON ONLY with this exact structure:
{{
    "source": {{"type": "woocommerce|bigcommerce|custom", "confidence": 0.0}},
    "mapping": [
        {{"source": "exact_header_name", "shopify": "Shopify Field", "confidence": 0.0}}
    ],
    "notes": ["observation 1", "observation 2"]
}}

Return JSON only, no markdown, no explanation."""

        try:
            response = self.model.generate_content(prompt)
            result = json.loads(response.text)
            return result
        except Exception as e:
            print(f"AI mapping error: {e}")
            # Fallback to basic mapping
            return self._fallback_mapping(headers)

    def _fallback_mapping(self, headers: List[str]) -> Dict[str, Any]:
        """Basic rule-based mapping if AI fails"""
        mapping = []

        # Simple keyword matching
        for header in headers:
            lower = header.lower()
            if 'name' in lower or 'title' in lower:
                mapping.append({"source": header, "shopify": "Title", "confidence": 0.8})
            elif 'sku' in lower:
                mapping.append({"source": header, "shopify": "Variant SKU", "confidence": 0.9})
            elif 'price' in lower and 'sale' not in lower:
                mapping.append({"source": header, "shopify": "Variant Price", "confidence": 0.9})
            # Add more rules...

        return {
            "source": {"type": "custom", "confidence": 0.5},
            "mapping": mapping,
            "notes": ["Fallback mapping used (AI unavailable)"]
        }
```

---

## 📁 Frontend Files

### 6. `frontend/package.json`
```json
{
  "name": "migration-copilot-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}
```

### 7. `frontend/vite.config.js`
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
```

### 8. `frontend/index.html`
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Migration Copilot</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

### 9. `frontend/src/main.jsx`
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### 10. `frontend/src/index.css`
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: #f5f5f5;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.card {
  background: white;
  border-radius: 8px;
  padding: 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
}

button {
  background: #5469d4;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

button:hover {
  background: #4354c0;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.upload-zone {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 3rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-zone:hover {
  border-color: #5469d4;
  background: #f9fafb;
}

.override-panel {
  background: #fff9e6;
  border: 1px solid #ffd60a;
  border-radius: 6px;
  padding: 1.5rem;
  margin: 1rem 0;
}

.product-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.loading {
  text-align: center;
  padding: 2rem;
}

.spinner {
  border: 3px solid #f3f3f3;
  border-top: 3px solid #5469d4;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### 11. `frontend/src/App.jsx`
```javascript
import { useState } from 'react'
import axios from 'axios'

const API_URL = '/api'

function App() {
  const [file, setFile] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [productsNeedingOverride, setProductsNeedingOverride] = useState([])
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('upload') // upload, preview, override, download

  const handleFileSelect = (e) => {
    setFile(e.target.files[0])
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await axios.post(`${API_URL}/upload`, formData)
      setSessionId(response.data.session_id)
      setPreview(response.data.preview)
      setStep('preview')

      // Auto-transform to check for overrides needed
      await handleTransform(response.data.session_id)
    } catch (error) {
      alert('Error uploading file: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTransform = async (sid = sessionId) => {
    setLoading(true)
    try {
      const response = await axios.post(`${API_URL}/transform`, {
        session_id: sid,
        overrides: overrides,
        strict_mode: false
      })

      if (response.data.products_needing_override.length > 0) {
        setProductsNeedingOverride(response.data.products_needing_override)
        setStep('override')
      } else {
        setStep('download')
      }
    } catch (error) {
      alert('Error transforming: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await axios.post(`${API_URL}/download`, {
        session_id: sessionId,
        overrides: overrides
      }, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'shopify_import.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Error downloading: ' + error.message)
    }
  }

  const handleOverrideChange = (handle, chosen) => {
    setOverrides({
      ...overrides,
      per_product: {
        ...overrides.per_product,
        [handle]: {
          chosen_options: chosen,
          overflow_to: 'append_to_body_html'
        }
      }
    })
  }

  return (
    <div className="container">
      <h1>🚀 Migration Copilot</h1>
      <p>Transform WooCommerce/Custom CSVs to Shopify format</p>

      {step === 'upload' && (
        <div className="card">
          <div
            className="upload-zone"
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <h2>📁 Drop CSV file here or click to browse</h2>
            {file && <p>Selected: {file.name}</p>}
          </div>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            style={{ marginTop: '1rem' }}
          >
            {loading ? 'Uploading...' : 'Upload & Transform'}
          </button>
        </div>
      )}

      {step === 'preview' && preview && (
        <div className="card">
          <h2>Preview</h2>
          <p>{preview.length} products loaded</p>
          <div className="loading">
            <div className="spinner"></div>
            <p>Analyzing products...</p>
          </div>
        </div>
      )}

      {step === 'override' && (
        <div className="card">
          <div className="override-panel">
            <h2>⚠️ Products Need Your Input</h2>
            <p>The following products have more than 3 varying attributes.
               Choose which 3 to keep as Shopify options:</p>
          </div>

          {productsNeedingOverride.map(product => (
            <div key={product.handle} className="product-card">
              <h3>{product.title}</h3>
              <p><strong>Varying attributes:</strong> {product.varying_attributes.join(', ')}</p>
              <p><strong>Suggested:</strong> {product.suggested_three.join(', ')}</p>

              {/* TODO: Add multi-select dropdown for choosing 3 attributes */}
              <select
                multiple
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, opt => opt.value)
                  if (selected.length <= 3) {
                    handleOverrideChange(product.handle, selected)
                  }
                }}
              >
                {product.varying_attributes.map(attr => (
                  <option key={attr} value={attr}>{attr}</option>
                ))}
              </select>
            </div>
          ))}

          <button onClick={() => handleTransform()}>
            Apply Overrides & Download
          </button>
        </div>
      )}

      {step === 'download' && (
        <div className="card">
          <h2>✅ Ready to Download</h2>
          <p>Your Shopify CSV is ready!</p>
          <button onClick={handleDownload}>
            📥 Download Shopify CSV
          </button>
          <button
            onClick={() => {
              setStep('upload')
              setFile(null)
              setSessionId(null)
              setPreview(null)
            }}
            style={{ marginLeft: '1rem', background: '#6c757d' }}
          >
            Start New
          </button>
        </div>
      )}
    </div>
  )
}

export default App
```

---

## 🚀 Quick Start Commands

### Backend:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
python -m app.main
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173

---

## Next: Use Cursor AI to Build

Once you have this running:

1. **Open project in Cursor**
2. **Use Cmd/Ctrl + K** to ask Cursor to:
   - "Implement the full transformation logic in transformer.py"
   - "Add better error handling"
   - "Improve the override UI with drag-and-drop"
   - etc.

3. **Iterate quickly** - Cursor will help you build features 10x faster!
