"""
app.core.registries
-------------------
Public surface — import from here, not from sub-modules directly.

    from app.core.registries import ACTION_REGISTRY, RESPONSE_REGISTRY
"""

from app.core.registries.action_registry import ACTION_REGISTRY
from app.core.registries.response_registry import RESPONSE_REGISTRY

# Backward-compatible alias — existing code can still do:
#   from app.core.registries import ERROR_REGISTRY
from app.core.registries.response_registry import RESPONSE_REGISTRY as ERROR_REGISTRY

__all__ = ["ACTION_REGISTRY", "RESPONSE_REGISTRY", "ERROR_REGISTRY"]
