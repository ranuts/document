"""Check actual IM integration evidence under response-local vendor policy."""
import json
from pathlib import Path
r=json.loads((Path(__file__).parent/"2026-10-03-vendor-csp-im-tools.json").read_text())
assert r["passed"] and not r["errors"] and not r.get("error")
assert [x["kind"] for x in r["rows"]]==["docx","xlsx","pptx"]
for row in r["rows"]:
    assert row["candidateEntry"]["stylesheetHandlerRemoved"]
    assert row["status"]=="completed" and "WebGPU" in row["engine"] and "1.7B" in row["engine"]
    assert not row["visibleErrors"] and row["previewCount"]==0
    assert row["afterUndo"]==row["before"] and row["afterRedo"]==row["after"]==row["reopened"]
    assert row["nativeSave"]["bytes"]>0 and row["nativeSave"]["failure"] is None
    if row["kind"]=="pptx": assert row["after"]==row["before"]+1
    else: assert "Hello tools" in row["after"]
assert len(r["entries"])>=6
assert len(r["responses"])>=6
for response in r["responses"]:
    assert not response["fromServiceWorker"] and response["policy"]
    assert any(e["url"]==response["url"] and e["policy"]==response["policy"] for e in r["entries"])
for entry in r["entries"]:
    assert entry["stylesheetHandlerRemoved"]
    assert "script-src-attr 'none'" in entry["policy"] and "'unsafe-eval'" in entry["policy"]
    script=next(x.strip() for x in entry["policy"].split(';') if x.strip().startswith('script-src '))
    assert "'self'" in script and "'sha256-" in script and "'unsafe-inline'" not in script
print("Actual GPU IM actions, native Undo/Redo/Save/reopen and zero preview cards verified; PPT coverage is slide count, not complex layout fidelity")
