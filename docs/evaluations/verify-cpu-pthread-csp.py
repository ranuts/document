"""Verify startup-instrumented native pool evidence, not debugger-timeout success."""
import json
from pathlib import Path
root = Path(__file__).parent
diagnostic = json.loads((root / "2026-10-03-cpu-pthread-csp.json").read_text())
assert diagnostic["status"] == "incomplete" and diagnostic["pthreads"][0]["error"] == "Error: Worker eval control timeout"
assert diagnostic["reply"].strip().lower().rstrip(".") == "hello"
r = json.loads((root / "2026-10-03-cpu-pthread-startup-csp.json").read_text())
assert r["status"] == "completed" and not r["errors"] and not r["visibleErrors"]
assert "CPU" in r["engine"] and "0.6B" in r["engine"] and r["shell"]["isolated"]
assert len(r["controls"]) == len(r["threads"]) == 4
assert {x["url"] for x in r["controls"]} == {x["url"] for x in r["threads"]}
assert all(t["title"] == "em-pthread" for t in r["threads"])
script = next(x.strip() for x in r["shell"]["csp"].split(";") if x.strip().startswith("script-src "))
for control in r["controls"]:
    assert control["name"] == "em-pthread"
    assert control["eval"]["blocked"] and control["eval"]["name"] == "EvalError"
    assert script in control["eval"]["message"]
    assert control["module"]["blocked"] and control["module"]["name"] == "TypeError"
assert r["baselineMeta"] is None
assert any(x["eval"].get("value") == 2 and x["module"].get("value") == 42 for x in r["baseline"])
assert r["reply"].strip().lower().rstrip(".") == "hello"
print("Four startup-instrumented native pthread controls, unmodified parent policy, positive baseline and CPU reply verified; direct debugger timeout remains incomplete")
