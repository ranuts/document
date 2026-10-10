"""Verify local NLI evidence/provenance and report errors, never certify safety."""
import hashlib
import json
import math
from pathlib import Path
root = Path(__file__).parent
sha = hashlib.sha256((root / "probe-local-nli.mjs").read_bytes()).hexdigest()
manifest = json.loads((root / "2026-10-03-local-nli-model-assets.json").read_text())
for suffix, dtype, fixture in [("", "q8", "cases"), ("-calibration", "q8", "calibration-cases"), ("-fp32", "fp32", "cases"), ("-fp32-calibration", "fp32", "calibration-cases")]:
    r = json.loads((root / f"2026-10-03-local-nli{suffix}.json").read_text())
    c = json.loads((root / f"2026-10-03-local-nli-{fixture}.json").read_text())
    assert r["status"] == "completed" and r["probeSHA256"] == sha and r["dtype"] == dtype
    assert r["model"] == manifest and r["sdkVersion"] == "3.8.1"
    assert r["cases"] == c["cases"] and r["decision"] == c["decision"]
    assert r["runtime"]["isolated"] and r["runtime"]["configuredThreads"] == 4
    assert len(r["runtime"]["spawned"]) == 3
    assert r["runtime"]["labels"] == {"0":"entailment","1":"neutral","2":"contradiction"}
    assert not r["errors"] and not r["externalRequests"] and not r["violations"]
    assert all(x["method"] == "GET" and x["bodyBytes"] == 0 for x in r["requests"])
    weight = "model_quantized.onnx" if dtype == "q8" else "model.onnx"
    assert any(x["url"].endswith("/onnx/" + weight) for x in r["requests"])
    assert len(r["rows"]) == len(c["cases"])
    for case, row in zip(c["cases"], r["rows"]):
        assert row["id"] == case["id"] and 0 < row["tokens"] <= 512 and row["encoded"]
        assert len(row["logits"]) == 3 and all(math.isfinite(x) for x in row["logits"])
        scale = max(row["logits"])
        values = [math.exp(x - scale) for x in row["logits"]]
        probabilities = dict(zip(["entailment", "neutral", "contradiction"], [x/sum(values) for x in values]))
        assert all(abs(probabilities[k] - row["probabilities"][k]) < 1e-9 for k in probabilities)
        assert row["topLabel"] == max(probabilities, key=probabilities.get)
        assert row["supported"] == (row["topLabel"] == "entailment" and probabilities["entailment"] >= .8)
        if case.get("archive"):
            p = root / case["archive"]
            assert hashlib.sha256(p.read_bytes()).hexdigest() == case["archiveSHA256"]
            prior = json.loads(p.read_text())
            sample = next(x for x in prior["results"] if x["id"] == case["archiveCase"] and x["variant"] == case["archiveVariant"])
            assert sample["output"].removesuffix("\r\n") == case["hypothesis"] and sample["source"] == case["premise"]
    positives = sum(x["expectedSupport"] for x in c["cases"])
    retained = sum(x["expectedSupport"] and y["supported"] for x,y in zip(c["cases"], r["rows"]))
    false_accepts = sum(not x["expectedSupport"] and y["supported"] for x,y in zip(c["cases"], r["rows"]))
    print(f"{dtype} {fixture}: {retained}/{positives} supported controls retained, {false_accepts} unsupported cases accepted; NOT a safety pass")
for suffix in ["sdk-entry-diagnostic", "decode-diagnostic"]:
    r = json.loads((root / f"2026-10-03-local-nli-{suffix}.json").read_text())
    assert r["status"] == "failed" and not r["rows"] and r["error"]
