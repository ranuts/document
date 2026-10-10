"""Check observed startup evidence and its current SDK source correlation."""
import json
from pathlib import Path
root = Path(__file__).resolve().parent
repo = root.parent.parent
report = json.loads((root / "2026-10-03-vendor-function-dependencies.json").read_text())
assert report["passed"]
assert [r["type"] for r in report["rows"]] == ["docx", "xlsx", "pptx"]
for row, name, line in zip(report["rows"], ["word", "cell", "slide"], [2194, 2346, 2226]):
    assert row["status"] == "completed" and not row["errors"]
    calls = row["functions"]
    assert calls["count"] > 0 and 0 < len(calls["sites"]) <= 40
    site = calls["sites"][0]
    assert site["bodyLength"] == 42
    assert f"sdkjs/{name}/sdk-all-min.js:{line}:" in site["stack"]
    source = (repo / f"public/sdkjs/{name}/sdk-all-min.js").read_text().splitlines()[line - 1]
    assert "new Function(" in source and "return eval(" in source
    assert "CDocumentMacros" in source and "safePluginEval" in source
    assert any(".template" in s["stack"] for s in calls["sites"])
print("Three observed native startups and non-template SDK constructor dependency verified; no macro execution or full CSP acceptance claim")
