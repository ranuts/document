# Fixed-example diagnostic failed before generation

The original process exited 1 after its 600000 ms load wait. It closed its browser context and produced zero of 21 outputs, with no load progress. This run provides no model-quality verdict. The original interception omitted production Worker response headers; the separate startup controls identify this as the next diagnostic correction. Preserve this failure and use a newly bound run for the corrected response.
