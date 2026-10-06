"""Check recorded upgrade/cold-start evidence, not physical-device reliability."""
import json
from pathlib import Path
root = Path(__file__).parent
first = json.loads((root / "2026-10-03-worker-csp-offline-controller-diagnostic.json").read_text())
r = json.loads((root / "2026-10-03-worker-csp-offline.json").read_text())
assert first["status"] == "failed" and first["error"] == "Error: Invalid offline control"
assert first["network"]["rejected"] and first["network"]["controller"].endswith("/sw.js?isolation=1")
assert first["before"] and all(x["csp"] is None for x in first["before"])
assert not any(x["url"].endswith("/assets/" + first["worker"]) for x in first["before"])
assert r["status"] == "completed" and not r["errors"] and not r["visibleErrors"]
assert r["network"]["rejected"] and r["network"]["online"] is False
assert "WebGPU" in r["engine"] and "1.7B" in r["engine"]
assert r["reply"].strip().lower().rstrip(".") == "hello"
assert r["evalControl"]["blocked"] and r["evalControl"]["name"] == "EvalError"
assert "Content Security Policy" in r["evalControl"]["message"]
assert r["actualWorker"].endswith("/assets/" + r["worker"])
for rows in [first["warm"], r["warm"], r["cold"]]:
    matches = [x for x in rows if x["url"] == r["actualWorker"]]
    assert matches and all(x["csp"] == r["fingerprint"] and x["sha256"] == r["expectedSHA256"] for x in matches)
print("Actual prior no-CSP cache, automatic new-URL policy caching, and fresh-process offline native GPU/eval restriction verified")
