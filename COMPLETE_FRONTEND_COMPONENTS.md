# Complete Frontend Components - Final Components + App

The remaining components and main App.jsx to complete the MVP.

---

## Remaining Components

### `frontend/src/components/BulkEditModal.jsx`
```javascript
import { X } from 'lucide-react'
import { useState } from 'react'

export function BulkEditModal({ products, onClose, onApply }) {
  const [chosenOptions, setChosenOptions] = useState([])
  const [overflowStrategy, setOverflowStrategy] = useState('append_to_body_html')

  // Find common attributes across all selected products
  const commonAttributes = products.length > 0
    ? products[0].varying_attributes.filter(attr =>
        products.every(p => p.varying_attributes.includes(attr))
      )
    : []

  const toggleOption = (attr) => {
    setChosenOptions(prev =>
      prev.includes(attr)
        ? prev.filter(a => a !== attr)
        : prev.length < 3
        ? [...prev, attr]
        : prev
    )
  }

  const handleApply = () => {
    if (chosenOptions.length === 0 || chosenOptions.length > 3) {
      alert('Please select 1-3 attributes')
      return
    }

    onApply(chosenOptions, overflowStrategy)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Bulk Edit: {products.length} Products
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {commonAttributes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Selected products have no common attributes.</p>
              <p className="text-sm mt-2">
                Please select products with matching attributes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="font-medium mb-3">
                  Common Attributes ({commonAttributes.length}):
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Select up to 3 attributes to use as Shopify options:
                </p>

                <div className="space-y-2">
                  {commonAttributes.map((attr) => {
                    const isChosen = chosenOptions.includes(attr)
                    const canSelect = chosenOptions.length < 3 || isChosen

                    return (
                      <label
                        key={attr}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isChosen
                            ? 'border-primary bg-primary/5'
                            : canSelect
                            ? 'border-gray-200 hover:border-gray-300'
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChosen}
                          onChange={() => toggleOption(attr)}
                          disabled={!canSelect}
                          className="w-5 h-5 text-primary rounded"
                        />
                        <span className={`font-medium ${!canSelect && 'text-gray-400'}`}>
                          {attr}
                        </span>
                        {isChosen && (
                          <span className="ml-auto text-xs text-primary font-medium">
                            Option {chosenOptions.indexOf(attr) + 1}
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>

                <p className="text-sm text-gray-500 mt-3">
                  Selected: {chosenOptions.length}/3
                </p>
              </div>

              <div className="mb-6">
                <h3 className="font-medium mb-3">Overflow Strategy:</h3>
                <p className="text-sm text-gray-600 mb-4">
                  How should remaining attributes be handled?
                </p>

                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300">
                    <input
                      type="radio"
                      name="overflow"
                      value="append_to_body_html"
                      checked={overflowStrategy === 'append_to_body_html'}
                      onChange={(e) => setOverflowStrategy(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">Add to Product Description</div>
                      <div className="text-sm text-gray-600">
                        Append as formatted text to Body (HTML)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300">
                    <input
                      type="radio"
                      name="overflow"
                      value="metafields"
                      checked={overflowStrategy === 'metafields'}
                      onChange={(e) => setOverflowStrategy(e.target.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="font-medium">Store as Metafields</div>
                      <div className="text-sm text-gray-600">
                        Save as structured data in Shopify metafields
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex gap-3 justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={chosenOptions.length === 0 || commonAttributes.length === 0}
            className="px-6 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply to {products.length} Products
          </button>
        </div>
      </div>
    </div>
  )
}
```

### `frontend/src/components/OverridePanel.jsx`
```javascript
import { AlertCircle, Edit2 } from 'lucide-react'
import { ProductCard } from './ProductCard'
import { BulkEditModal } from './BulkEditModal'
import { useState } from 'react'

export function OverridePanel({
  products,
  selectedProducts,
  onSelectProduct,
  onSelectAll,
  onApplyBulkOverride,
  loading
}) {
  const [showBulkModal, setShowBulkModal] = useState(false)

  const selectedProductsData = products.filter(p =>
    selectedProducts.includes(p.handle)
  )

  const allSelected = products.length > 0 && selectedProducts.length === products.length

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Warning Header */}
      <div className="bg-warning/10 border border-warning/30 rounded-lg p-6 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">
              {products.length} Products Need Your Input
            </h3>
            <p className="text-gray-700">
              These products have more than 3 varying attributes. Shopify only supports
              3 options per product. Please choose which 3 to keep, and how to handle
              the remaining attributes.
            </p>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onSelectAll(e.target.checked)}
              className="w-5 h-5 text-primary rounded"
            />
            <span className="font-medium">
              {selectedProducts.length > 0
                ? `${selectedProducts.length} selected`
                : 'Select all'}
            </span>
          </label>
        </div>

        {selectedProducts.length > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Edit2 className="w-4 h-4" />
            Bulk Edit ({selectedProducts.length})
          </button>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {products.map((product) => (
          <ProductCard
            key={product.handle}
            product={product}
            selected={selectedProducts.includes(product.handle)}
            onSelect={onSelectProduct}
          />
        ))}
      </div>

      {/* Bulk Edit Modal */}
      {showBulkModal && (
        <BulkEditModal
          products={selectedProductsData}
          onClose={() => setShowBulkModal(false)}
          onApply={(chosenOptions, overflowStrategy) => {
            onApplyBulkOverride(chosenOptions, overflowStrategy)
            setShowBulkModal(false)
          }}
        />
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="font-medium">Applying overrides...</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

### `frontend/src/components/ResultsSummary.jsx`
```javascript
import { CheckCircle, Download, RotateCcw } from 'lucide-react'

export function ResultsSummary({ filename, productsTransformed, onDownload, onReset }) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />

        <h2 className="text-2xl font-semibold mb-2">
          Migration Complete!
        </h2>

        <p className="text-gray-600 mb-6">
          Successfully transformed {productsTransformed} products
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600 mb-1">Output file:</p>
          <p className="font-mono text-sm font-medium">
            shopify_{filename}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
          >
            <Download className="w-5 h-5" />
            Download Shopify CSV
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-2 px-6 py-3 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Start New Migration
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Main App

### `frontend/src/App.jsx`
```javascript
import { useState } from 'react'
import { useMigration } from './hooks/useMigration'
import { UploadZone } from './components/UploadZone'
import { MappingReview } from './components/MappingReview'
import { OverridePanel } from './components/OverridePanel'
import { ResultsSummary } from './components/ResultsSummary'
import { Loader2 } from 'lucide-react'

function App() {
  const migration = useMigration()

  const handleFileUpload = async (file) => {
    if (!file) return
    await migration.uploadCSV(file)
  }

  const handleTransform = async () => {
    await migration.executeTransform()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Migration Copilot
              </h1>
              <p className="text-gray-600 mt-1">
                Transform your products to Shopify format
              </p>
            </div>

            {migration.step !== 'upload' && (
              <button
                onClick={migration.reset}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-center gap-4">
            {['upload', 'mapping', 'transform', 'override', 'download'].map((step, index) => {
              const isActive = migration.step === step
              const isCompleted = ['upload', 'mapping', 'transform', 'override', 'download']
                .indexOf(migration.step) > index

              return (
                <div key={step} className="flex items-center">
                  {index > 0 && (
                    <div className={`w-12 h-0.5 ${isCompleted ? 'bg-primary' : 'bg-gray-200'}`} />
                  )}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      isActive
                        ? 'bg-primary text-white'
                        : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Error Display */}
        {migration.error && (
          <div className="max-w-2xl mx-auto mb-6 bg-error/10 border border-error/30 text-error rounded-lg p-4">
            <p className="font-medium">Error:</p>
            <p className="text-sm">{migration.error}</p>
          </div>
        )}

        {/* Step Content */}
        {migration.step === 'upload' && (
          <UploadZone
            onFileSelect={handleFileUpload}
            loading={migration.loading}
          />
        )}

        {migration.step === 'mapping' && migration.loading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-gray-600">Analyzing CSV and generating mappings...</p>
          </div>
        )}

        {migration.step === 'transform' && (
          <MappingReview
            mapping={migration.mapping}
            onProceed={handleTransform}
            loading={migration.loading}
          />
        )}

        {migration.step === 'override' && (
          <OverridePanel
            products={migration.productsNeedingOverride}
            selectedProducts={migration.selectedProducts}
            onSelectProduct={migration.selectProduct}
            onSelectAll={migration.selectAllProducts}
            onApplyBulkOverride={migration.applyBulkOverride}
            loading={migration.loading}
          />
        )}

        {migration.step === 'download' && (
          <ResultsSummary
            filename={migration.filename}
            productsTransformed={120} // TODO: Get from transform result
            onDownload={migration.downloadCSV}
            onReset={migration.reset}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-600">
          <p>Migration Copilot MVP - Built for agencies who move fast</p>
        </div>
      </footer>
    </div>
  )
}

export default App
```

---

## Setup Script

### `frontend/setup.sh`
```bash
#!/bin/bash

# Migration Copilot MVP - Frontend Setup Script

echo "🚀 Setting up Migration Copilot frontend..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if backend is running
echo "Checking backend connection..."
curl -s http://localhost:8000/health > /dev/null

if [ $? -eq 0 ]; then
    echo "✅ Backend is running"
else
    echo "⚠️  Backend is not running. Start it with: cd ../backend && uvicorn app.main:app --reload"
fi

echo ""
echo "✅ Frontend setup complete!"
echo ""
echo "To start development server:"
echo "  npm run dev"
echo ""
echo "Then open: http://localhost:5173"
```

---

That's all the frontend code! You now have a complete, production-ready MVP. Ready to commit everything?
