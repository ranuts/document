"""Verify main CPU Worker controls; not all-pthread/device/security acceptance."""
import json
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / "2026-10-03-cpu-worker-csp.json").read_text())
assert r["status"] == "completed" and not r["errors"] and not r["visibleErrors"]
assert "CPU" in r["engine"] and "0.6B" in r["engine"] and r["shell"]["isolated"]
main = [row for row in r["shell"]["code"] if row["mainLlama"]]
assert len(main) == 1 and main[0]["url"] == r["mainWorker"]["url"]
assert sum(t["title"] == "em-pthread" for t in r["targets"]) == 4
assert r["evalControl"]["blocked"] and r["evalControl"]["name"] == "EvalError"
script = next(x.strip() for x in r["shell"]["csp"].split(";") if x.strip().startswith("script-src "))
assert script in r["evalControl"]["message"]
assert r["moduleControl"]["blocked"] and r["moduleControl"]["name"] == "TypeError"
assert r["baselineMeta"] is None and r["baselineEval"]["value"] == 2 and r["baselineModule"]["value"] == 42
assert not r["baselineEval"]["blocked"] and not r["baselineModule"]["blocked"]
assert r["reply"].strip().lower().rstrip(".") == "hello"
print("Actual CPU main blob Worker, parent-policy eval rejection, module rejection, positive controls and native reply verified")
