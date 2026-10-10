# Native English Excel read-then-write

The current production preview received `Read A1:C3, then set B2 to "00123".`
through the actual IM Operate document flow. The tool activity contained all
nine original cell values, including B2's previous value, before the verified
write. B2 retained `00123`; its surrounding eight values, formulas and formats
remained identical. One native Undo restored the original snapshot and Redo
restored the write. Native Save downloaded an XLSX, and the actual file chooser
reopened it with the same snapshot. The preserved XLSX encodes B2 as a shared
string containing `00123`, independently proving text storage and leading zeros.
No preview cards or page errors occurred. The current hashed plugin was loaded.

The first attempt was rejected with a generic IM error and no verified write.
Its raw result and exact driver are retained as `-before`. A subsequent CDP
caught-exception diagnostic completed all checks with no captured exceptions;
its exact driver/result are retained as `-diagnostic`. Removing the diagnostic
observer and repeating ordinary execution also completed all checks. The first
failure remains unexplained; these successful runs do not prove the transient
has been repaired. No product changes were made during this investigation.

These are desktop Chromium runs with a warm WebGPU model and normal preview
isolation headers. Planning this literal command is deterministic; model
outputs were not substituted. This does not establish general English model
planning quality, mobile support, all workbook operations or race immunity.
Owned browser contexts closed after each run. The verifier checks report/driver
and source hashes, native snapshots, read output, and the preserved synthetic
saved workbook. Build retains existing SDK externalization and large-chunk
warnings.
