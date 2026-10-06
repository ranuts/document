# Native count SDK retirement and replacement

The isolated browser test and verifier passed. Two count requests were submitted without awaiting completion, then the SDK runtime exited. Both promises settled as rejected with `Wllama worker terminated`; a later request through the saved retired proxy received the same rejection. No count result was fulfilled or replayed into the replacement instance.

A fresh runtime loaded the same model using the same native prototype, counted the greeting at 16 tokens and generated with prompt usage 16 and stop finish reason. No uncaught page errors were recorded. Both runtimes, browser and local server were closed. This tests the installed patched SDK's explicit worker retirement with the new native action.

Evidence: [raw capture](2026-10-04-cpu-native-count-retirement.json), [predeclared driver](probe-cpu-native-count-retirement.mjs), [verifier](verify-cpu-native-count-retirement.py). Driver/native patch/runtime hashes and actions are retained. The observed settlement timing is one local sample, not a latency guarantee.

The count requests were pending at the SDK boundary. This does not prove that native tokenization had already begun before termination, nor does it exercise the application's Stop button, AbortSignal queue or model-selection UI. Those remain required integration checks. Product dependencies and IM are unchanged. Next package a matching prototype runtime/client interface and verify provider cancellation before adopting exact context budgeting.

Verifier correction: its initial action-count assertion omitted the intentional late retired-proxy request. The raw trace contains three count_chat calls: two pending requests and that late request. The corrected verifier passed; raw evidence is unchanged.
