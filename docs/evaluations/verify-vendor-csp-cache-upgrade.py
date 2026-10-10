"""Validate corrected simulation evidence without broadening its scope."""
import json
from pathlib import Path
root = Path(__file__).parent
control = json.loads((root / "2026-10-03-playwright-async-predicate-control.json").read_text())
assert control["returnedValue"] is False and control["explicitPollingRejectedFalse"]
r = json.loads((root / "2026-10-03-vendor-csp-cache-upgrade.json").read_text())
assert r["passed"] and not r["errors"]
for section in ["upgrade", "cold", "offline"]:
    assert len(r[section]) == 3
    assert {x["type"] for x in r[section]} == {"docx", "xlsx", "pptx"}
    assert all(x["isolated"] and x["iframeIsolated"] and x["fullApi"] and x["loaded"] for x in r[section])
for x in r["upgrade"]:
    assert x["newControllerVersion"]["vendorVersion"] == r["candidateVendor"]
    assert len(x["oldEntries"]) == 3
    assert all(y["policy"] is None and y["asyncStyle"] for y in x["oldEntries"])
for x in r["cold"]:
    assert x["vendorResponse"]["fromServiceWorker"] and x["vendorResponse"]["policy"]
    assert x["edited"] == x["redone"] and x["edited"] != x["undone"]
    assert x["nativeSave"]["bytes"] > 0 and x["nativeSave"]["failure"] is None and x["reopenExact"]
for x in r["offline"]:
    assert not x["online"] and x["networkRejected"] and x["upstreamResponses"] == 0 and x["foreignRequests"] == 0
    assert x["vendorResponses"] and all(y["fromServiceWorker"] and y["policy"] for y in x["vendorResponses"])
    c = x["controls"]
    assert c["inline"] is False and c["event"] is False and c["foreign"] is False and c["evalValue"] == 2
    assert c["save"]["hit"] and c["stylesheets"]
    assert all(y["media"] in ["", "all"] and y["onload"] is None for y in c["stylesheets"])
    assert any(y["href"].endswith("/resources/css/app.css") and y["media"] == "all" for y in c["stylesheets"])
print("Corrected synthetic upgrade: three native round trips and same-context offline policy controls verified")
