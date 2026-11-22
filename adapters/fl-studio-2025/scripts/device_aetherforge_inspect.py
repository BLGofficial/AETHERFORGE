# name=AetherForge Qualified Inspect Controller (Read-Only)
# url=https://aetherforge.internal/docs/daws/fl-studio-2025-qualification
# AETHER FORGE — Qualified Read-Only FL Studio 2025 Python Controller Script (ADR-0009, INV-04)
# Strictly read-only inspection of FL Studio version, channel count, and transport state.
# Never performs destructive session mutations.

import json
import sys


def collect_readonly_session_snapshot(general_mod, channels_mod, transport_mod):
    """Collects read-only telemetry from FL Studio 2025 Python API modules."""
    return {
        "schemaVersion": "1.0.0",
        "dawTarget": "fl-studio-2025",
        "capabilityTier": "inspect",
        "reversibility": "reversible",
        "apiVersion": int(general_mod.getVersion()),
        "channelCount": int(channels_mod.channelCount()),
        "isPlaying": bool(transport_mod.isPlaying()),
    }


if __name__ == "__main__" and "--self-test" in sys.argv:
    class _StubGeneral:
        @staticmethod
        def getVersion():
            return 25

    class _StubChannels:
        @staticmethod
        def channelCount():
            return 8

    class _StubTransport:
        @staticmethod
        def isPlaying():
            return False

    snapshot = collect_readonly_session_snapshot(_StubGeneral, _StubChannels, _StubTransport)
    assert snapshot["dawTarget"] == "fl-studio-2025"
    assert snapshot["capabilityTier"] == "inspect"
    assert snapshot["apiVersion"] == 25
    assert snapshot["channelCount"] == 8
    print(json.dumps({"ok": True, "snapshot": snapshot}))
