"""Check actual SW iframe response policies and offline execution controls."""
import json
from pathlib import Path
root=Path(__file__).parent
r=json.loads((root/"2026-10-03-vendor-csp-offline-policy.json").read_text())
assert r["passed"] and not r["errors"]
assert r["experiment"]["staticStylesheet"] and not r["experiment"]["baseline"]
assert [x["type"] for x in r["offline"]]==["docx","xlsx","pptx"]
for row in r["cold"]:
    assert row["reopenExact"] and row["redone"]==row["edited"]==row["reopenedText"]
    assert row["nativeSave"]["bytes"]>0 and row["nativeSave"]["failure"] is None
for row in r["offline"]:
    assert not row["online"] and row["networkRejected"] and row["upstreamResponses"]==0
    assert row["isolated"] and row["iframeIsolated"] and row["loaded"] and row["fullApi"]
    responses=row["vendorResponses"]
    assert responses and all(x["fromServiceWorker"] and x["policy"] for x in responses)
    assert all(x["policy"] in {e["candidatePolicy"] for e in r["candidateEntries"]} for x in responses)
    c=row["controls"]
    assert not c["inline"] and not c["event"] and not c["foreign"] and row["foreignRequests"]==0
    assert c["evalValue"]==2 and c["save"]["hit"]
    assert any(x["media"]=="all" and x["onload"] is None for x in c["stylesheets"])
    assert any(x["directive"]=="script-src-attr" for x in c["violations"])
    assert any(x["directive"]=="script-src-elem" and x["blocked"]=="inline" for x in c["violations"])
    assert any(x["directive"]=="script-src-elem" and x["blocked"]=="https://controlled-script.example/probe.js" for x in c["violations"])
print("Three effective SW iframe policies, offline script restrictions and style hit targets verified; no old-cache upgrade, browser-process cold start or IM dispatch claim")
