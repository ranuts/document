"""Verify captured mechanics; this does not grade summary semantics."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
folder = root / "docs/evaluations"
bindings = json.loads((folder / "2026-10-07-gemma4-summary-bindings.json").read_text())
receipt_path = folder / "2026-10-07-gemma4-summary-remaining.json"
assert hashlib.sha256(receipt_path.read_bytes()).hexdigest() == bindings["receiptSHA256"]
old_path = folder / "2026-10-07-gemma4-summary-historical-partial.json"
assert hashlib.sha256(old_path.read_bytes()).hexdigest() == bindings["priorReceiptSHA256"]
driver = "docs/evaluations/2026-10-07-gemma4-summary-remaining-native.mjs"
assert hashlib.sha256((root / driver).read_bytes()).hexdigest() == bindings["hashes"][driver]
assert bindings["processExitCode"] == 0 and not bindings["semanticAccepted"]
report = json.loads(receipt_path.read_text())
fixtures = json.loads((folder / "2026-10-05-summary-concise-cases.json").read_text())
assert report["browserClosed"] and len(report["cases"]) == 3
assert report["modelBytes"] == 2841481184
assert report["modelSHA256"] == "8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52"
for row, fixture in zip(report["cases"], fixtures[1:]):
    assert row["prompt"] == fixture
    assert row["finished"] and row["contextClosed"] and not row["crashed"]
    assert not row.get("error") and not row["errors"] and not row["chatErrors"]
    assert row["previewCount"] == 0
    assert row["modelStatus"] == "CPU · gemma-4-E2B-it-Q4_0.gguf"
    assert row["documentBefore"].rstrip("\r\n") == fixture["source"]
    assert row["selected"].rstrip("\r\n") == fixture["source"]
    assert len(row["sdk"]) == 1 and row["counts"]
    observation = row["sdk"][0]
    request = observation["request"]
    assert observation["originalMessages"] == request["messages"]
    assert row["counts"][-1] == request
    assert request["temperature"] == 0 and request["top_p"] == 0.8 and request["max_tokens"] == 512
    completion = observation["completion"]
    assert completion["choices"][0]["finish_reason"] == "stop"
    body = json.loads(completion["choices"][0]["message"]["content"])
    assert set(body) == {"text"}
    assert row["documentAfter"].rstrip("\r\n") == body["text"]
    assert row["afterUndo"] == row["documentBefore"]
    assert row["afterRedo"] == row["documentAfter"]
old = json.loads(old_path.read_text())
assert len(old["cases"]) == 1 and old["cases"][0]["finished"]
assert old.get("browserClosed") is not True
print("Three native results, exact requests/history, model identity and receipt bindings verified. Semantic quality remains separately rejected; historical first row is partial evidence.")
