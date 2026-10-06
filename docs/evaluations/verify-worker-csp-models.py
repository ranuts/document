"""Verify archived Worker CSP compatibility; not a complete security audit."""
import json
from pathlib import Path
root = Path(__file__).parent
# Executed probe at commit 1c080b8; the current probe adds hosted-header checks.
probe_hash = "f7a7b55b015a14913f121282da5a54d3a0ffd41f3bbf00864198b1c4889a515a"
reports = []
for suffix, model in (("08", "Qwen3.5-0.8B"), ("2b", "Qwen3.5-2B"), ("4b", "Qwen3-4B"), ("17", "Qwen3-1.7B")):
    r = json.loads((root / f"2026-10-03-worker-csp-{suffix}.json").read_text())
    assert r["status"] == "completed" and r["modelId"] == model + "-q4f16_1-MLC"
    assert r["probeSHA256"] == probe_hash and r["workerBytesUnchanged"] and not r["baseline"]
    assert r["modelId"] in r["engine"] and "WebGPU" in r["engine"]
    assert r["workerControls"]["isolated"] and r["workerControls"]["eval"]["blocked"]
    assert r["workerControls"]["eval"]["name"] == "EvalError" and "Content Security Policy" in r["workerControls"]["eval"]["message"]
    assert r["workerControls"]["foreign"]["blocked"] and r["foreignModuleRequests"] == 0
    assert not r["errors"] and not r["consoleErrors"] and r["errorCountAfterRecovery"] == 0
    assert r["nextReply"].strip().lower().rstrip(".") == "hello"
    assert len(r["workerResponses"]) == 1 and r["workerResponses"][0]["policy"] == r["policy"]
    reports.append(r)
assert len({r["workerResponses"][0]["originalSHA256"] for r in reports}) == 1
assert len({r["workerResponses"][0]["diagnosticSHA256"] for r in reports}) == 1
baseline = json.loads((root / "2026-10-03-gpu-worker-csp-baseline.json").read_text())
assert baseline["status"] == "completed" and baseline["baseline"]
assert baseline["workerControls"]["eval"]["value"] == 2 and baseline["workerControls"]["foreign"]["value"] == 42
assert baseline["foreignModuleRequests"] == 1
print("Four actual cached GPU models verified under identical Worker policy/diagnostic bytes; earlier successful no-header controls retained")
