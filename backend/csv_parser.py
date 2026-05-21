import io
from typing import Any
import pandas as pd


def parse_and_compute(csv_bytes: bytes) -> dict[str, Any]:
    df = pd.read_csv(io.BytesIO(csv_bytes))

    kpis: dict[str, Any] = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            kpis[col] = {
                "type": "numeric",
                "count": int(df[col].count()),
                "sum": float(df[col].sum()),
                "mean": float(df[col].mean()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
            }
        else:
            kpis[col] = {
                "type": "categorical",
                "count": int(df[col].count()),
                "unique_count": int(df[col].nunique()),
                "value_counts": {
                    str(k): int(v)
                    for k, v in df[col].value_counts().head(10).items()
                },
            }

    return {
        "kpis": kpis,
        "rows": df.to_dict(orient="records"),
        "columns": list(df.columns),
        "row_count": len(df),
    }
