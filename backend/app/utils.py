from typing import Any, Dict
import json


def to_json(obj: Any) -> str:
    try:
        return json.dumps(obj, default=str)
    except Exception:
        return "{}"

