"""Verify archived experiment mechanics; semantic quality requires review."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
reports = [json.loads((root / name).read_text()) for name in (
    "2026-10-03-gpu-17b-fidelity.json",
    "2026-10-03-gpu-4b-fidelity.json",
)]
assert reports[0]["cases"] == reports[1]["cases"]
assert reports[0]["bundleHashes"] == reports[1]["bundleHashes"]
probe_hash = hashlib.sha256((root / "probe-gpu-writing-sampling.mjs").read_bytes()).hexdigest()
for report in reports:
    assert report["status"] == "completed" and len(report["results"]) == 6
    assert report["bundleBytesUnchanged"] and report["probeSHA256"] == probe_hash
    assert not report["errors"] and not report["externalRequests"]
    for row in report["results"]:
        assert row["previewCount"] == 0 and row["isolated"]
        assert len(row["raw"]) == len(row["inputs"]) == 1
        message = row["inputs"][0]
        assert report["modelId"] in message["modelId"]
        assert message["request"]["temperature"] == 0
        if row["documentUnchanged"]:
            assert row["errors"] and row["output"] == row["selected"]
        else:
            assert not row["errors"] and row["undoExact"] and row["redoExact"]
for left, right in zip(reports[0]["results"], reports[1]["results"]):
    assert left["id"] == right["id"] and left["selected"] == right["selected"]
    assert left["inputs"][0]["request"] == right["inputs"][0]["request"]
print("12 actual-model rows verified: identical requests, correct models, preserved rejection or exact native history; no semantic pass claim")
