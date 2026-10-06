"""Check failed upgrade evidence without turning diagnostic failure into success."""
import json
from pathlib import Path
root=Path(__file__).parent
for name in ["policy-checkpoint-diagnostic","revalidated-checkpoint"]:
    r=json.loads((root/f"2026-10-03-vendor-csp-cache-upgrade-{name}.json").read_text())
    assert not r["passed"] and r["error"]=="Error: Effective post-upgrade iframe policy checkpoint failed"
    assert r["vendor"]!=r["candidateVendor"] and len(r["upgrade"])==1
    assert r["upgrade"][0]["oldEntries"] and all(x["policy"] is None and x["asyncStyle"] for x in r["upgrade"][0]["oldEntries"])
    assert f'document-editor-runtime-{r["candidateVendor"]}' in r["upgrade"][0]["newCaches"]
    c=r["checkpoints"][0]
    assert c["loaded"] and c["fullApi"] and c["controls"]["inlineExecuted"]
    assert c["responses"] and all(x["fromServiceWorker"] and x["policy"] is None for x in c["responses"])
    if name=="revalidated-checkpoint":
        assert r["revalidatedPrecache"]
        assert c["currentVersion"]["vendorVersion"]==r["vendor"] and c["currentVersion"]["cacheVersion"]==r["oldCore"]
        assert len(c["candidateCachedEntries"])==3
        assert all(x["policy"] and not x["asyncStyle"] for x in c["candidateCachedEntries"])
print("Historical failures preserved; their asynchronous readiness check did not establish candidate takeover. See corrected polling analysis.")
