"""Validate CPU experiment controls, not summary truth or language quality."""
import hashlib
import json
import re
from pathlib import Path
root = Path(__file__).parent
r = json.loads((root / "2026-10-03-cpu-summary-focused.json").read_text())
fixtures = json.loads((root / "2026-10-03-summary-focused-cases.json").read_text())
assert r["status"] == "completed" and len(r["results"]) == 12 and r["cases"] == fixtures
assert r["probeSHA256"] == hashlib.sha256((root / "probe-cpu-summary-focused.mjs").read_bytes()).hexdigest()
assert r["bundleBytesUnchanged"] and not r["errors"] and not r["externalRequests"]
assert "CPU" in r["engine"] and "0.6B" in r["engine"]
for case in fixtures:
    pair = [x for x in r["results"] if x["id"] == case["id"]]
    assert [x["variant"] for x in pair] == ["current", "summary"]
    inputs = []
    for x in pair:
        assert x["isolated"] and x["runtime"]["threads"] == 4 and x["runtime"]["multithread"]
        assert x["previewCount"] == 0 and x["selected"].removesuffix("\r\n") == case["source"]
        assert len(x["raw"]) == len(x["inputs"]) == 1
        data = x["inputs"][0]
        assert data["variant"] == x["variant"]
        assert [m["role"] for m in data["messages"]] == ["system", "user"]
        request = json.loads(data["messages"][-1]["content"].split("\n")[-1])
        assert request["task"] == "summarize" and request["instruction"] == case["instruction"]
        assert request["text"] == x["selected"].replace("\r\n", "\n")
        assert data["temperature"] == 0.7 and data["topP"] == 0.8 and data["maxTokens"] == 512
        assert data["schema"]["json_schema"]["strict"]
        assert data["schema"]["json_schema"]["schema"]["properties"] == {"text": {"type": "string"}}
        if x["variant"] == "summary":
            assert data["messages"][0]["content"] == r["system"]
        if x["documentUnchanged"]:
            assert x["output"] == x["selected"] and x["errors"]
        else:
            assert not x["errors"] and x["undoExact"] and x["redoExact"]
            body = json.loads(re.sub(r"^\s*<think>\s*</think>\s*", "", x["raw"][0]["text"]))["text"]
            assert x["output"].removesuffix("\r\n") == body
        inputs.append(data)
    for key in ["temperature", "topP", "maxTokens", "schema", "parameters", "request"]:
        assert inputs[0][key] == inputs[1][key]
print("12 actual four-thread CPU inferences verified; unchanged controls and native history; semantic review remains separate")
