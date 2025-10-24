# Complete Backend Services - Migration Copilot MVP

Remaining backend services for transformation, attribute analysis, and override handling.

---

## `backend/app/services/transformer.py`

```python
"""
Product Transformer - Core transformation logic
Port your n8n Transform & QA logic here!
"""
import pandas as pd
from typing import Dict, List, Any, Optional

class ProductTransformer:
    """Transform WooCommerce/Custom CSV to Shopify format"""

    def __init__(self):
        self.shopify_columns = [
            "Handle", "Title", "Body (HTML)", "Vendor", "Tags",
            "Option1 Name", "Option1 Value",
            "Option2 Name", "Option2 Value",
            "Option3 Name", "Option3 Value",
            "Variant SKU", "Variant Price", "Variant Compare At Price",
            "Variant Inventory Qty", "Variant Image", "Image Src",
            "Image Position", "Metafields"
        ]

    def transform(
        self,
        rows: List[Dict[str, Any]],
        mapping: Dict[str, str],
        overrides: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main transformation logic

        Args:
            rows: Product data from CSV
            mapping: Field mapping (source → shopify)
            overrides: Per-product attribute overrides

        Returns:
            {
                "csv_output": "...",
                "products_transformed": 120,
                "products_with_overflow": [...],
                "decision_log": {...},
                "warnings": [...]
            }
        """

        # TODO: Port your n8n Transform & QA logic here
        # For now, basic transformation

        transformed_products = []
        products_with_overflow = []
        warnings = []

        for row in rows:
            # Create handle
            title = row.get('Name') or row.get('Product Name') or row.get('Title', 'Untitled')
            handle = self._create_handle(title)

            # Check if product has >3 varying attributes
            attributes = self._extract_attributes(row)

            if len(attributes) > 3:
                # Need override
                products_with_overflow.append({
                    "handle": handle,
                    "title": title,
                    "varying_attributes": [attr['name'] for attr in attributes],
                    "suggested_three": [attr['name'] for attr in attributes[:3]]
                })

            # Apply mapping
            shopify_row = self._map_row(row, mapping, handle)

            # Apply overrides if provided
            if overrides and handle in overrides.get('per_product', {}):
                product_override = overrides['per_product'][handle]
                shopify_row = self._apply_override(shopify_row, attributes, product_override)

            transformed_products.append(shopify_row)

        # Build CSV
        csv_output = self._build_csv(transformed_products)

        return {
            "csv_output": csv_output,
            "products_transformed": len(transformed_products),
            "products_with_overflow": products_with_overflow,
            "decision_log": self._build_decision_log(transformed_products, overrides),
            "warnings": warnings
        }

    def _create_handle(self, title: str) -> str:
        """Convert title to Shopify handle (kebab-case)"""
        return title.lower()\
            .replace(' ', '-')\
            .replace('&', 'and')\
            .replace('/', '-')\
            .replace('_', '-')

    def _extract_attributes(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract product attributes from row"""
        attributes = []

        # WooCommerce style: Attribute 1 name, Attribute 1 value(s)
        for i in range(1, 10):  # Check up to 10 attributes
            name_key = f'Attribute {i} name'
            value_key = f'Attribute {i} value(s)'

            if name_key in row and value_key in row:
                name = row[name_key]
                values = row[value_key]

                if name and values:
                    # Split pipe-delimited values
                    value_list = str(values).split('|') if '|' in str(values) else [str(values)]

                    attributes.append({
                        "name": name,
                        "values": value_list,
                        "distinct_count": len(set(value_list))
                    })

        return attributes

    def _map_row(
        self,
        row: Dict[str, Any],
        mapping: Dict[str, str],
        handle: str
    ) -> Dict[str, Any]:
        """Map source fields to Shopify fields"""
        shopify_row = {
            "Handle": handle
        }

        # Apply mapping
        for source_field, shopify_field in mapping.items():
            if source_field in row:
                shopify_row[shopify_field] = row[source_field]

        return shopify_row

    def _apply_override(
        self,
        shopify_row: Dict[str, Any],
        attributes: List[Dict[str, Any]],
        override: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply per-product attribute override"""
        chosen = override.get('chosen_options', [])
        overflow_to = override.get('overflow_to', 'append_to_body_html')

        # Set chosen options
        for i, attr_name in enumerate(chosen[:3], 1):
            matching_attr = next((a for a in attributes if a['name'] == attr_name), None)

            if matching_attr:
                shopify_row[f'Option{i} Name'] = attr_name
                shopify_row[f'Option{i} Value'] = matching_attr['values'][0]

        # Handle overflow
        overflow_attrs = [a for a in attributes if a['name'] not in chosen]

        if overflow_attrs and overflow_to == 'append_to_body_html':
            overflow_html = self._build_overflow_html(overflow_attrs)
            current_body = shopify_row.get('Body (HTML)', '')
            shopify_row['Body (HTML)'] = current_body + overflow_html

        elif overflow_attrs and overflow_to == 'metafields':
            metafields = {attr['name']: attr['values'] for attr in overflow_attrs}
            shopify_row['Metafields'] = json.dumps(metafields)

        return shopify_row

    def _build_overflow_html(self, attributes: List[Dict[str, Any]]) -> str:
        """Build HTML for overflow attributes"""
        html_parts = []

        for attr in attributes:
            values_str = ', '.join(attr['values'])
            html_parts.append(f"{attr['name']}: {values_str}")

        return f"\n<p><em>• {' • '.join(html_parts)}</em></p>"

    def _build_csv(self, products: List[Dict[str, Any]]) -> str:
        """Build Shopify CSV from transformed products"""
        if not products:
            return ""

        df = pd.DataFrame(products)

        # Ensure all Shopify columns exist
        for col in self.shopify_columns:
            if col not in df.columns:
                df[col] = ""

        # Reorder columns
        df = df[self.shopify_columns]

        return df.to_csv(index=False)

    def _build_decision_log(
        self,
        products: List[Dict[str, Any]],
        overrides: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build decision log for audit trail"""
        return {
            "products_count": len(products),
            "overrides_applied": len(overrides.get('per_product', {})) if overrides else 0,
            "timestamp": pd.Timestamp.now().isoformat()
        }
```

---

## `backend/app/services/attribute_analyzer.py`

```python
"""
Attribute Analyzer - Detect products with >3 varying attributes
"""
from typing import List, Dict, Any
from collections import defaultdict

class AttributeAnalyzer:
    """Analyze product attributes to detect which need overrides"""

    PRIORITY_ATTRIBUTES = [
        "Color", "Size", "Material", "Style", "Length",
        "Width", "Height", "Flavor", "Capacity", "Gender"
    ]

    def analyze_products(
        self,
        rows: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze all products to find those with >3 varying attributes

        Returns:
            {
                "products_needing_override": [
                    {
                        "handle": "...",
                        "title": "...",
                        "varying_attributes": [...],
                        "suggested_three": [...]
                    }
                ],
                "total_products": 120,
                "needs_override_count": 12
            }
        """

        # Group products by handle
        product_groups = self._group_by_product(rows)

        products_needing_override = []

        for handle, product_rows in product_groups.items():
            varying = self._find_varying_attributes(product_rows)

            if len(varying) > 3:
                # This product needs override
                title = product_rows[0].get('Name') or product_rows[0].get('Title', 'Untitled')

                suggested = self._suggest_top_three(varying)

                products_needing_override.append({
                    "handle": handle,
                    "title": title,
                    "varying_attributes": [v['name'] for v in varying],
                    "suggested_three": suggested,
                    "attribute_details": varying
                })

        return {
            "products_needing_override": products_needing_override,
            "total_products": len(product_groups),
            "needs_override_count": len(products_needing_override)
        }

    def _group_by_product(
        self,
        rows: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group rows by product handle"""
        groups = defaultdict(list)

        for row in rows:
            title = row.get('Name') or row.get('Title', 'Untitled')
            handle = self._create_handle(title)
            groups[handle].append(row)

        return dict(groups)

    def _find_varying_attributes(
        self,
        product_rows: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Find attributes that vary across product variants"""
        attribute_values = defaultdict(set)

        # Extract all attribute values
        for row in product_rows:
            for i in range(1, 10):
                name_key = f'Attribute {i} name'
                value_key = f'Attribute {i} value(s)'

                if name_key in row and value_key in row:
                    attr_name = row[name_key]
                    attr_value = row[value_key]

                    if attr_name and attr_value:
                        # Handle pipe-delimited values
                        values = str(attr_value).split('|') if '|' in str(attr_value) else [str(attr_value)]
                        attribute_values[attr_name].update(values)

        # Find varying attributes (>1 distinct value)
        varying = []

        for name, values in attribute_values.items():
            if len(values) > 1:
                varying.append({
                    "name": name,
                    "distinct_count": len(values),
                    "values": list(values)
                })

        # Sort by distinct count (most varying first)
        varying.sort(key=lambda x: x['distinct_count'], reverse=True)

        return varying

    def _suggest_top_three(
        self,
        varying_attributes: List[Dict[str, Any]]
    ) -> List[str]:
        """Suggest top 3 attributes based on priority + distinctness"""
        scored = []

        for attr in varying_attributes:
            # Priority score (0-10)
            priority_score = 0
            if attr['name'] in self.PRIORITY_ATTRIBUTES:
                priority_score = 10 - self.PRIORITY_ATTRIBUTES.index(attr['name'])

            # Distinctness score
            distinct_score = min(attr['distinct_count'], 10)

            total_score = priority_score + distinct_score

            scored.append({
                "name": attr['name'],
                "score": total_score
            })

        # Sort by score
        scored.sort(key=lambda x: x['score'], reverse=True)

        # Return top 3
        return [item['name'] for item in scored[:3]]

    def _create_handle(self, title: str) -> str:
        """Convert title to handle"""
        return title.lower()\
            .replace(' ', '-')\
            .replace('&', 'and')\
            .replace('/', '-')\
            .replace('_', '-')
```

---

## `backend/app/services/override_handler.py`

```python
"""
Override Handler - Build and apply bulk overrides
"""
from typing import List, Dict, Any
from ..models import Product

class OverrideHandler:
    """Handle bulk override operations"""

    def build_overrides_from_products(
        self,
        products: List[Product]
    ) -> Dict[str, Any]:
        """
        Build overrides dict from Product models

        Returns:
            {
                "per_product": {
                    "product-handle": {
                        "chosen_options": ["Color", "Size", "Material"],
                        "overflow_to": "append_to_body_html"
                    }
                }
            }
        """
        overrides = {"per_product": {}}

        for product in products:
            if product.chosen_options:
                overrides["per_product"][product.handle] = {
                    "chosen_options": product.chosen_options,
                    "overflow_to": product.overflow_strategy
                }

        return overrides

    def find_common_attributes(
        self,
        products: List[Product]
    ) -> List[str]:
        """
        Find attributes common to all selected products

        Used for bulk editing
        """
        if not products:
            return []

        # Get attributes from first product
        common_attrs = set(products[0].varying_attributes)

        # Intersect with all other products
        for product in products[1:]:
            common_attrs &= set(product.varying_attributes)

        return sorted(list(common_attrs))

    def validate_bulk_override(
        self,
        products: List[Product],
        chosen_options: List[str]
    ) -> Dict[str, Any]:
        """
        Validate that chosen options are valid for all products

        Returns:
            {
                "valid": True/False,
                "errors": [...],
                "warnings": [...]
            }
        """
        errors = []
        warnings = []

        # Check that we have 3 or fewer options
        if len(chosen_options) > 3:
            errors.append("Cannot choose more than 3 options")

        # Check that all products have these attributes
        for product in products:
            missing = [opt for opt in chosen_options if opt not in product.varying_attributes]

            if missing:
                warnings.append(
                    f"Product '{product.title}' is missing attributes: {', '.join(missing)}"
                )

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
```

---

## Testing & Utilities

### `backend/test_services.py` (Optional - for development)

```python
"""
Quick tests for services
Run with: python -m pytest test_services.py
"""
import pytest
from app.services.transformer import ProductTransformer
from app.services.attribute_analyzer import AttributeAnalyzer

def test_create_handle():
    transformer = ProductTransformer()
    assert transformer._create_handle("Joust Duffle Bag") == "joust-duffle-bag"
    assert transformer._create_handle("Test & Product") == "test-and-product"

def test_extract_attributes():
    transformer = ProductTransformer()
    row = {
        "Attribute 1 name": "Color",
        "Attribute 1 value(s)": "Red|Blue|Green",
        "Attribute 2 name": "Size",
        "Attribute 2 value(s)": "S|M|L"
    }

    attrs = transformer._extract_attributes(row)

    assert len(attrs) == 2
    assert attrs[0]['name'] == "Color"
    assert len(attrs[0]['values']) == 3

def test_suggest_top_three():
    analyzer = AttributeAnalyzer()

    varying = [
        {"name": "Color", "distinct_count": 5, "values": []},
        {"name": "Size", "distinct_count": 4, "values": []},
        {"name": "Material", "distinct_count": 3, "values": []},
        {"name": "Style", "distinct_count": 2, "values": []},
        {"name": "Brand", "distinct_count": 1, "values": []}
    ]

    suggested = analyzer._suggest_top_three(varying)

    assert len(suggested) == 3
    assert "Color" in suggested
    assert "Size" in suggested
```

---

## Environment Setup Script

### `backend/setup.sh`

```bash
#!/bin/bash

# Migration Copilot MVP - Backend Setup Script

echo "🚀 Setting up Migration Copilot backend..."

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Copy environment file
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your GEMINI_API_KEY and DATABASE_URL"
fi

# Create uploads directory
echo "Creating uploads directory..."
mkdir -p uploads

# Initialize database (if needed)
echo "Database setup instructions:"
echo "1. Create a Postgres database: createdb migration_copilot"
echo "2. Update DATABASE_URL in .env"
echo "3. Run: python -c 'from app.database import init_db; init_db()'"

echo "✅ Backend setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Setup database"
echo "3. Run: uvicorn app.main:app --reload"
```

---

This completes all the backend services! Next, I'll create the complete frontend code with all React components, hooks, and styling. Ready?
