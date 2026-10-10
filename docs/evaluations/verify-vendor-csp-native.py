"""Check native snapshots and candidate stylesheet causal controls."""
from pathlib import Path
import json
root=Path(__file__).parent
load=lambda name:json.loads((root/name).read_text())
r=load("2026-10-03-vendor-csp-native.json")
assert r["passed"] and not r["errors"]
assert [x["type"] for x in r["cold"]]==["docx","xlsx","pptx"]
for row in r["cold"]:
    marker="VENDOR_CSP_"+row["type"]
    assert marker in json.dumps(row["edited"]) and marker not in json.dumps(row["undone"])
    assert row["redone"]==row["edited"]==row["reopenedText"] and row["reopenExact"]
    assert row["nativeSave"]["bytes"]>0 and row["nativeSave"]["failure"] is None
assert len(r["offline"])==3
for row in r["offline"]:
    assert row["isolated"] and row["iframeIsolated"] and row["fullApi"] and row["loaded"]
    assert not row["online"] and row["networkRejected"] and row["upstreamResponses"]==0
assert r["candidateEntries"]
assert all(x["stylesheetHandlerRemoved"] and "/main/index.html" in x["path"] for x in r["candidateEntries"])
for name in ["baseline","candidate","static-style"]:
    g=load(f"2026-10-03-vendor-csp-save-geometry-{name}.json")["cold"][0]["saveGeometry"]
    if name=="candidate": assert g["hits"][0]["id"]=="ws-canvas-outer"
    else: assert g["button"]["y"]==0 and g["hits"][0]["tag"]=="I"
    if name=="static-style": assert any(x["media"]=="all" and x["onload"] is None for x in g["stylesheets"])
print("Three native round trips and same-context offline navigation verified; stylesheet causal controls verified; IM and offline CSP enforcement remain unproven")
