"""Check experimental controls and native mechanics; never infer semantic quality."""
import hashlib
import json
import re
from pathlib import Path
root = Path(__file__).parent
probe_hash = hashlib.sha256((root / "probe-gpu-summary-focused.mjs").read_bytes()).hexdigest()
fixtures = json.loads((root / "2026-10-03-summary-focused-cases.json").read_text())
count = 0
original_bundle_hash = None
for suffix, model in [("", "Qwen3-1.7B-q4f16_1-MLC"), ("-4b", "Qwen3-4B-q4f16_1-MLC"),
                      ("-2b", "Qwen3.5-2B-q4f16_1-MLC"), ("-0_8", "Qwen3.5-0.8B-q4f16_1-MLC")]:
    r = json.loads((root / f"2026-10-03-gpu-summary-focused{suffix}.json").read_text())
    assert r["status"] == "completed" and r["modelId"] == model
    assert r["cases"] == fixtures and len(r["results"]) == len(fixtures) * 2
    assert r["probeSHA256"] == probe_hash and r["bundleBytesUnchanged"]
    assert not r["errors"] and not r["externalRequests"]
    if original_bundle_hash is None:
        original_bundle_hash = r["bundleHashes"]["plugin"]
    assert r["bundleHashes"]["plugin"] == original_bundle_hash
    for case in fixtures:
        pair = [x for x in r["results"] if x["id"] == case["id"]]
        assert [x["variant"] for x in pair] == ["current", "summary"]
        parameters = []
        for x in pair:
            assert x["previewCount"] == 0 and x["isolated"]
            assert x["selected"].removesuffix("\r\n") == case["source"]
            assert len(x["raw"]) == len(x["inputs"]) == 1
            worker = x["inputs"][0]
            assert worker["modelId"] == [model]
            request = dict(worker["request"])
            messages = request.pop("messages")
            assert request["temperature"] == 0 and request["response_format"]["schema"]
            assert [m["role"] for m in messages] == ["system", "user"]
            data = json.loads(messages[-1]["content"].split("\n")[-1])
            assert data["text"] == x["selected"].replace("\r\n", "\n")
            assert data["instruction"] == case["instruction"] and data["task"] == "summarize"
            if x["variant"] == "summary":
                assert messages[0]["content"].startswith("Summarize the source according to the instruction")
            if x["documentUnchanged"]:
                assert x["output"] == x["selected"] and x["errors"]
            else:
                assert not x["errors"] and x["undoExact"] and x["redoExact"]
                body = json.loads(re.sub(r"^\s*<think>\s*</think>\s*", "", x["raw"][0]["text"]))["text"]
                assert x["output"].removesuffix("\r\n") == body
            parameters.append(request)
            count += 1
        assert parameters[0] == parameters[1]
print(f"{count} actual inference rows verified; same source/instruction and non-message parameters, exact native history. Semantic review is separate.")
