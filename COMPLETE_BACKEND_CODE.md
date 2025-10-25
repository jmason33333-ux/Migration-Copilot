# Complete Backend Code - Migration Copilot MVP

All backend files ready to copy-paste into your project!

---

## Backend Routes

### `backend/app/routes/__init__.py`
```python
# Empty file to make routes a package
```

### `backend/app/routes/upload.py`
```python
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
import pandas as pd
import os
import uuid
from typing import Dict, Any
import aiofiles

from ..database import get_db
from ..models import Migration, Product
from ..schemas import MigrationResponse
from ..services.csv_service import CSVService
from ..services.attribute_analyzer import AttributeAnalyzer

router = APIRouter()
csv_service = CSVService()
attribute_analyzer = AttributeAnalyzer()

MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", 10)) * 1024 * 1024  # 10MB default
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

@router.post("/", response_model=Dict[str, Any])
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and validate CSV file
    Returns: session_id, preview, row_count, headers
    """

    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Read file content
    content = await file.read()

    # Validate file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    try:
        # Parse CSV
        df = pd.read_csv(pd.io.common.BytesIO(content))

        # Validate CSV has data
        if df.empty:
            raise HTTPException(status_code=400, detail="CSV file is empty")

        # Create migration record
        migration = Migration(
            filename=file.filename,
            row_count=len(df),
            status='uploaded'
        )
        db.add(migration)
        db.commit()
        db.refresh(migration)

        # Save file to disk
        file_path = os.path.join(UPLOAD_DIR, f"{migration.id}.csv")
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)

        # Analyze CSV structure
        analysis = csv_service.analyze_csv(df)

        # Return preview and metadata
        return {
            "session_id": str(migration.id),
            "filename": file.filename,
            "row_count": len(df),
            "headers": df.columns.tolist(),
            "preview": df.head(10).to_dict('records'),
            "platform_detected": analysis.get('platform_type', 'custom'),
            "confidence": analysis.get('confidence', 0.5)
        }

    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty or invalid")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing CSV: {str(e)}")


@router.get("/{session_id}/status")
async def get_upload_status(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get upload status"""
    migration = db.query(Migration).filter(Migration.id == session_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": str(migration.id),
        "status": migration.status,
        "filename": migration.filename,
        "row_count": migration.row_count
    }
```

### `backend/app/routes/migrations.py`
```python
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from ..database import get_db
from ..models import Migration
from ..schemas import MigrationResponse

router = APIRouter()

@router.get("/", response_model=List[MigrationResponse])
async def list_migrations(
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """List recent migrations"""
    migrations = db.query(Migration)\
        .order_by(Migration.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

    return migrations


@router.get("/{migration_id}", response_model=MigrationResponse)
async def get_migration(
    migration_id: UUID,
    db: Session = Depends(get_db)
):
    """Get specific migration details"""
    migration = db.query(Migration).filter(Migration.id == migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    return migration


@router.delete("/{migration_id}")
async def delete_migration(
    migration_id: UUID,
    db: Session = Depends(get_db)
):
    """Delete a migration"""
    migration = db.query(Migration).filter(Migration.id == migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    db.delete(migration)
    db.commit()

    return {"status": "deleted", "migration_id": str(migration_id)}
```

### `backend/app/routes/transform.py`
```python
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import pandas as pd
import os
import io
from uuid import UUID

from ..database import get_db
from ..models import Migration, Product
from ..schemas import TransformRequest, TransformResponse, BulkOverrideRequest, ProductOverride
from ..services.ai_mapper import AIMapper
from ..services.transformer import ProductTransformer
from ..services.attribute_analyzer import AttributeAnalyzer
from ..services.override_handler import OverrideHandler

router = APIRouter()
ai_mapper = AIMapper()
transformer = ProductTransformer()
attribute_analyzer = AttributeAnalyzer()
override_handler = OverrideHandler()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.post("/mapping/{migration_id}")
async def generate_mapping(
    migration_id: UUID,
    db: Session = Depends(get_db)
):
    """Generate AI-powered field mapping"""
    migration = db.query(Migration).filter(Migration.id == migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    # Load CSV
    file_path = os.path.join(UPLOAD_DIR, f"{migration_id}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CSV file not found")

    df = pd.read_csv(file_path)
    headers = df.columns.tolist()

    # Generate mapping with AI
    mapping_result = await ai_mapper.suggest_mapping(headers)

    # Save mapping to migration
    migration.ai_mapping = mapping_result
    migration.status = 'mapped'
    db.commit()

    return mapping_result


@router.post("/execute", response_model=TransformResponse)
async def execute_transform(
    request: TransformRequest,
    db: Session = Depends(get_db)
):
    """Execute transformation with optional overrides"""
    migration = db.query(Migration).filter(Migration.id == request.migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    # Load CSV
    file_path = os.path.join(UPLOAD_DIR, f"{request.migration_id}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="CSV file not found")

    df = pd.read_csv(file_path)

    # Use AI mapping or provided mapping
    mapping = request.mapping or migration.ai_mapping.get('mapping', {})

    # Transform products
    result = transformer.transform(
        rows=df.to_dict('records'),
        mapping=mapping,
        overrides=request.overrides
    )

    # Analyze which products need overrides
    products_needing_override = []

    for product_data in result['products_with_overflow']:
        # Create or update product record
        product = db.query(Product).filter(
            Product.migration_id == migration.id,
            Product.handle == product_data['handle']
        ).first()

        if not product:
            product = Product(
                migration_id=migration.id,
                handle=product_data['handle'],
                title=product_data['title'],
                varying_attributes=product_data['varying_attributes']
            )
            db.add(product)

        products_needing_override.append(ProductOverride(
            handle=product_data['handle'],
            title=product_data['title'],
            varying_attributes=product_data['varying_attributes'],
            chosen_options=product_data.get('suggested_three', [])
        ))

    # Update migration
    migration.status = 'transformed'
    migration.overrides = request.overrides
    migration.decision_log = result.get('decision_log', {})
    db.commit()

    # Save transformed CSV
    csv_str = result['csv_output']
    csv_path = os.path.join(UPLOAD_DIR, f"{migration.id}_transformed.csv")
    with open(csv_path, 'w') as f:
        f.write(csv_str)

    migration.transformed_csv_url = csv_path
    db.commit()

    return TransformResponse(
        status="success",
        products_transformed=result['products_transformed'],
        products_needing_override=products_needing_override,
        warnings=result.get('warnings', [])
    )


@router.post("/bulk-override")
async def apply_bulk_override(
    request: BulkOverrideRequest,
    db: Session = Depends(get_db)
):
    """Apply bulk overrides to multiple products"""
    migration = db.query(Migration).filter(Migration.id == request.migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    # Update products with bulk override
    updated_count = 0
    for handle in request.product_handles:
        product = db.query(Product).filter(
            Product.migration_id == request.migration_id,
            Product.handle == handle
        ).first()

        if product:
            product.chosen_options = request.chosen_options
            product.overflow_strategy = request.overflow_strategy
            updated_count += 1

    db.commit()

    # Re-transform with new overrides
    overrides = override_handler.build_overrides_from_products(
        db.query(Product).filter(Product.migration_id == request.migration_id).all()
    )

    # Load and re-transform CSV
    file_path = os.path.join(UPLOAD_DIR, f"{request.migration_id}.csv")
    df = pd.read_csv(file_path)

    mapping = migration.ai_mapping.get('mapping', {})

    result = transformer.transform(
        rows=df.to_dict('records'),
        mapping=mapping,
        overrides=overrides
    )

    # Save re-transformed CSV
    csv_str = result['csv_output']
    csv_path = os.path.join(UPLOAD_DIR, f"{request.migration_id}_transformed.csv")
    with open(csv_path, 'w') as f:
        f.write(csv_str)

    return {
        "status": "success",
        "products_updated": updated_count,
        "products_transformed": result['products_transformed']
    }


@router.get("/download/{migration_id}")
async def download_csv(
    migration_id: UUID,
    db: Session = Depends(get_db)
):
    """Download transformed Shopify CSV"""
    migration = db.query(Migration).filter(Migration.id == migration_id).first()

    if not migration:
        raise HTTPException(status_code=404, detail="Migration not found")

    if not migration.transformed_csv_url:
        raise HTTPException(status_code=404, detail="Transformed CSV not found. Please run transformation first.")

    if not os.path.exists(migration.transformed_csv_url):
        raise HTTPException(status_code=404, detail="CSV file not found on disk")

    # Read CSV and stream to client
    with open(migration.transformed_csv_url, 'r') as f:
        csv_content = f.read()

    return StreamingResponse(
        io.BytesIO(csv_content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=shopify_import_{migration.filename}"
        }
    )
```

---

## Backend Services

### `backend/app/services/__init__.py`
```python
# Empty file to make services a package
```

### `backend/app/services/csv_service.py`
```python
import pandas as pd
from typing import Dict, List, Any

class CSVService:
    """Handle CSV parsing and validation"""

    def analyze_csv(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Analyze CSV to detect platform type

        Returns:
            {
                "platform_type": "woocommerce|bigcommerce|shopify|custom",
                "confidence": 0.0-1.0,
                "detected_fields": [...],
                "suggestions": [...]
            }
        """
        headers = df.columns.tolist()
        headers_lower = [h.lower() for h in headers]

        # Platform detection heuristics
        woo_score = 0
        big_score = 0
        shopify_score = 0

        # WooCommerce indicators
        woo_indicators = ['attribute 1 name', 'attribute 1 value(s)', 'regular price', 'type']
        for indicator in woo_indicators:
            if indicator in headers_lower:
                woo_score += 1

        # BigCommerce indicators
        big_indicators = ['product name', 'product code', 'brand name']
        for indicator in big_indicators:
            if indicator in headers_lower:
                big_score += 1

        # Shopify indicators
        shopify_indicators = ['handle', 'variant sku', 'option1 name', 'option1 value']
        for indicator in shopify_indicators:
            if indicator in headers_lower:
                shopify_score += 1

        # Determine platform
        max_score = max(woo_score, big_score, shopify_score)
        total_indicators = len(woo_indicators) + len(big_indicators) + len(shopify_indicators)

        if woo_score == max_score and woo_score > 0:
            platform = "woocommerce"
            confidence = woo_score / len(woo_indicators)
        elif big_score == max_score and big_score > 0:
            platform = "bigcommerce"
            confidence = big_score / len(big_indicators)
        elif shopify_score == max_score and shopify_score > 0:
            platform = "shopify"
            confidence = shopify_score / len(shopify_indicators)
        else:
            platform = "custom"
            confidence = 0.3

        return {
            "platform_type": platform,
            "confidence": round(confidence, 2),
            "detected_fields": headers,
            "row_count": len(df),
            "suggestions": []
        }

    def validate_csv(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Validate CSV for common issues

        Returns:
            {
                "valid": True/False,
                "errors": [],
                "warnings": []
            }
        """
        errors = []
        warnings = []

        # Check for empty DataFrame
        if df.empty:
            errors.append("CSV is empty")
            return {"valid": False, "errors": errors, "warnings": warnings}

        # Check for required fields (varies by platform)
        required_fields = ['name', 'sku', 'price']
        headers_lower = [h.lower() for h in df.columns.tolist()]

        for field in required_fields:
            if not any(field in h for h in headers_lower):
                warnings.append(f"Missing common field: {field}")

        # Check for duplicate headers
        if len(df.columns) != len(set(df.columns)):
            errors.append("CSV has duplicate column names")

        # Check for empty rows
        empty_rows = df.isnull().all(axis=1).sum()
        if empty_rows > 0:
            warnings.append(f"{empty_rows} empty rows detected")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
```

### `backend/app/services/ai_mapper.py`
```python
import google.generativeai as genai
import os
import json
from typing import List, Dict, Any

class AIMapper:
    """AI-powered field mapping using Google Gemini"""

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set in environment")

        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-exp')

    async def suggest_mapping(self, headers: List[str]) -> Dict[str, Any]:
        """
        Generate AI-powered field mapping suggestions

        Args:
            headers: List of CSV column names

        Returns:
            {
                "source": {"type": "woocommerce|bigcommerce|custom", "confidence": 0.95},
                "mapping": [
                    {"source": "Name", "shopify": "Title", "confidence": 0.98},
                    ...
                ]
            }
        """

        prompt = f"""You are a Shopify migration expert. Analyze these CSV headers and suggest the best field mappings to Shopify format.

CSV Headers: {json.dumps(headers)}

Shopify required fields:
- Title (product name)
- Handle (URL-safe product identifier)
- Body (HTML) (product description)
- Vendor
- Option1 Name, Option1 Value
- Option2 Name, Option2 Value
- Option3 Name, Option3 Value
- Variant SKU
- Variant Price
- Variant Compare At Price
- Variant Inventory Qty
- Image Src

Common source → Shopify mappings:
- Name/Product Name → Title
- Description/Short description → Body (HTML)
- SKU → Variant SKU
- Regular price/Price → Variant Price
- Sale price/Compare at price → Variant Compare At Price
- Stock/Quantity → Variant Inventory Qty
- Images/Image URL → Image Src
- Brand/Manufacturer → Vendor
- Attribute 1 name → Option1 Name
- Attribute 1 value(s) → Option1 Value

Return JSON ONLY with this exact structure (no markdown, no explanations):
{{
    "source": {{"type": "woocommerce|bigcommerce|custom", "confidence": 0.0-1.0}},
    "mapping": [
        {{"source": "exact_header_name", "shopify": "Shopify_Field_Name", "confidence": 0.0-1.0}}
    ],
    "notes": ["Brief observation about the mapping"]
}}"""

        try:
            response = self.model.generate_content(prompt)
            result = json.loads(response.text.strip())

            # Validate response structure
            if not isinstance(result, dict):
                raise ValueError("Invalid response format")

            if 'source' not in result or 'mapping' not in result:
                raise ValueError("Missing required fields in response")

            return result

        except Exception as e:
            print(f"AI mapping error: {e}")
            # Fallback to rule-based mapping
            return self._fallback_mapping(headers)

    def _fallback_mapping(self, headers: List[str]) -> Dict[str, Any]:
        """Rule-based mapping fallback"""
        mapping = []

        for header in headers:
            lower = header.lower()

            # Simple keyword matching
            if 'name' in lower or 'title' in lower:
                mapping.append({"source": header, "shopify": "Title", "confidence": 0.8})
            elif 'sku' in lower:
                mapping.append({"source": header, "shopify": "Variant SKU", "confidence": 0.9})
            elif 'price' in lower and 'sale' not in lower and 'compare' not in lower:
                mapping.append({"source": header, "shopify": "Variant Price", "confidence": 0.9})
            elif 'sale' in lower or 'compare' in lower:
                mapping.append({"source": header, "shopify": "Variant Compare At Price", "confidence": 0.8})
            elif 'description' in lower:
                mapping.append({"source": header, "shopify": "Body (HTML)", "confidence": 0.8})
            elif 'image' in lower or 'photo' in lower:
                mapping.append({"source": header, "shopify": "Image Src", "confidence": 0.8})
            elif 'brand' in lower or 'vendor' in lower:
                mapping.append({"source": header, "shopify": "Vendor", "confidence": 0.8})
            elif 'stock' in lower or 'quantity' in lower or 'inventory' in lower:
                mapping.append({"source": header, "shopify": "Variant Inventory Qty", "confidence": 0.8})

        return {
            "source": {"type": "custom", "confidence": 0.5},
            "mapping": mapping,
            "notes": ["Fallback rule-based mapping (AI unavailable)"]
        }
```

I'll continue with the transformer, attribute analyzer, and override handler services in the next section. This is getting comprehensive!

Would you like me to continue generating all the remaining backend services and then move on to the complete frontend code? Or should I pause here and let you review what I've created so far?