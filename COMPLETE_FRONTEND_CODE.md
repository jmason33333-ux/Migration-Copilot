# Complete Frontend Code - Migration Copilot MVP

All frontend files ready to copy-paste! Modern React + Tailwind UI.

---

## Setup Files

### `frontend/package.json`
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
    "axios": "^1.6.2",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "tailwindcss": "^3.3.6",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}
```

### `frontend/tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
        },
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
  },
  plugins: [],
}
```

### `frontend/postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `frontend/vite.config.js`
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
      }
    }
  }
})
```

### `frontend/index.html`
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

### `frontend/src/main.jsx`
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

### `frontend/src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

## API Client

### `frontend/src/api/client.js`
```javascript
import axios from 'axios'

const API_BASE = '/api'

export const api = {
  // Upload CSV
  async uploadCSV(file) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await axios.post(`${API_BASE}/upload/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    return response.data
  },

  // Generate AI mapping
  async generateMapping(sessionId) {
    const response = await axios.post(`${API_BASE}/transform/mapping/${sessionId}`)
    return response.data
  },

  // Execute transformation
  async executeTransform(sessionId, mapping, overrides = null) {
    const response = await axios.post(`${API_BASE}/transform/execute`, {
      migration_id: sessionId,
      mapping,
      overrides,
    })

    return response.data
  },

  // Apply bulk override
  async applyBulkOverride(sessionId, productHandles, chosenOptions, overflowStrategy) {
    const response = await axios.post(`${API_BASE}/transform/bulk-override`, {
      migration_id: sessionId,
      product_handles: productHandles,
      chosen_options: chosenOptions,
      overflow_strategy: overflowStrategy,
    })

    return response.data
  },

  // Download CSV
  async downloadCSV(sessionId) {
    const response = await axios.get(`${API_BASE}/transform/download/${sessionId}`, {
      responseType: 'blob',
    })

    return response.data
  },

  // List migrations
  async listMigrations() {
    const response = await axios.get(`${API_BASE}/migrations/`)
    return response.data
  },
}
```

---

## Custom Hook

### `frontend/src/hooks/useMigration.js`
```javascript
import { useState } from 'react'
import { api } from '../api/client'

export function useMigration() {
  const [state, setState] = useState({
    sessionId: null,
    filename: null,
    preview: null,
    headers: null,
    mapping: null,
    productsNeedingOverride: [],
    selectedProducts: [],
    loading: false,
    error: null,
    step: 'upload', // upload, mapping, transform, override, download
  })

  const setLoading = (loading, error = null) => {
    setState(prev => ({ ...prev, loading, error }))
  }

  const setStep = (step) => {
    setState(prev => ({ ...prev, step }))
  }

  const uploadCSV = async (file) => {
    setLoading(true)

    try {
      const result = await api.uploadCSV(file)

      setState(prev => ({
        ...prev,
        sessionId: result.session_id,
        filename: result.filename,
        preview: result.preview,
        headers: result.headers,
        loading: false,
        step: 'mapping',
      }))

      // Auto-generate mapping
      await generateMapping(result.session_id)

    } catch (error) {
      setLoading(false, error.response?.data?.detail || 'Failed to upload CSV')
    }
  }

  const generateMapping = async (sessionId = state.sessionId) => {
    setLoading(true)

    try {
      const mapping = await api.generateMapping(sessionId)

      setState(prev => ({
        ...prev,
        mapping,
        loading: false,
        step: 'transform',
      }))

    } catch (error) {
      setLoading(false, error.response?.data?.detail || 'Failed to generate mapping')
    }
  }

  const executeTransform = async (overrides = null) => {
    setLoading(true)

    try {
      const result = await api.executeTransform(state.sessionId, state.mapping, overrides)

      setState(prev => ({
        ...prev,
        productsNeedingOverride: result.products_needing_override,
        loading: false,
        step: result.products_needing_override.length > 0 ? 'override' : 'download',
      }))

    } catch (error) {
      setLoading(false, error.response?.data?.detail || 'Failed to transform')
    }
  }

  const selectProduct = (handle) => {
    setState(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(handle)
        ? prev.selectedProducts.filter(h => h !== handle)
        : [...prev.selectedProducts, handle],
    }))
  }

  const selectAllProducts = (select) => {
    setState(prev => ({
      ...prev,
      selectedProducts: select
        ? prev.productsNeedingOverride.map(p => p.handle)
        : [],
    }))
  }

  const applyBulkOverride = async (chosenOptions, overflowStrategy) => {
    setLoading(true)

    try {
      await api.applyBulkOverride(
        state.sessionId,
        state.selectedProducts,
        chosenOptions,
        overflowStrategy
      )

      // Re-transform
      await executeTransform()

      // Clear selection
      setState(prev => ({ ...prev, selectedProducts: [] }))

    } catch (error) {
      setLoading(false, error.response?.data?.detail || 'Failed to apply override')
    }
  }

  const downloadCSV = async () => {
    try {
      const blob = await api.downloadCSV(state.sessionId)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `shopify_${state.filename}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const reset = () => {
    setState({
      sessionId: null,
      filename: null,
      preview: null,
      headers: null,
      mapping: null,
      productsNeedingOverride: [],
      selectedProducts: [],
      loading: false,
      error: null,
      step: 'upload',
    })
  }

  return {
    ...state,
    uploadCSV,
    generateMapping,
    executeTransform,
    selectProduct,
    selectAllProducts,
    applyBulkOverride,
    downloadCSV,
    setStep,
    reset,
  }
}
```

---

## Components

### `frontend/src/components/UploadZone.jsx`
```javascript
import { Upload } from 'lucide-react'
import { useRef } from 'react'

export function UploadZone({ onFileSelect, loading }) {
  const fileInputRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      onFileSelect(file)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => onFileSelect(e.target.files[0])}
          className="hidden"
        />

        <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />

        <h3 className="text-xl font-semibold mb-2">
          Drop CSV file here or click to browse
        </h3>

        <p className="text-gray-600 mb-4">
          Maximum file size: 10MB
        </p>

        {loading && (
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Uploading and analyzing...</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

### `frontend/src/components/MappingReview.jsx`
```javascript
import { CheckCircle, AlertCircle } from 'lucide-react'

export function MappingReview({ mapping, onProceed, loading }) {
  if (!mapping) return null

  const { source, mapping: fieldMappings } = mapping

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-6 h-6 text-success" />
          <div>
            <h3 className="text-lg font-semibold">
              Platform Detected: {source.type}
            </h3>
            <p className="text-sm text-gray-600">
              Confidence: {Math.round(source.confidence * 100)}%
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-medium mb-3">Field Mappings:</h4>

          <div className="space-y-2">
            {fieldMappings.map((field, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded"
              >
                <span className="font-mono text-sm">{field.source}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{field.shopify}</span>
                <span className="text-sm text-gray-500">
                  {Math.round(field.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onProceed}
          disabled={loading}
          className="w-full bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Transforming...' : 'Transform Products'}
        </button>
      </div>
    </div>
  )
}
```

### `frontend/src/components/ProductCard.jsx`
```javascript
import { Check } from 'lucide-react'

export function ProductCard({ product, selected, onSelect }) {
  return (
    <div
      className={`border rounded-lg p-4 cursor-pointer transition-all ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onSelect(product.handle)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-medium text-lg">{product.title}</h4>
          <p className="text-sm text-gray-500 font-mono">{product.handle}</p>
        </div>

        {selected && (
          <div className="flex-shrink-0">
            <Check className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>

      <div className="mb-3">
        <p className="text-sm text-gray-600 mb-2">
          Varying Attributes ({product.varying_attributes.length}):
        </p>
        <div className="flex flex-wrap gap-2">
          {product.varying_attributes.map((attr, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
            >
              {attr}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-gray-600 mb-2">Suggested (top 3):</p>
        <div className="flex flex-wrap gap-2">
          {product.suggested_three.map((attr, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-medium"
            >
              {attr}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
```

I'll continue with the remaining components in the next message. This is coming together nicely!

Would you like me to continue with BulkEditModal, OverridePanel, ResultsSummary, and the main App.jsx?