# Open retry reporting

A recoverable conversion failure could briefly report that a document was corrupt
even though rebuilding the editor successfully reopened it. The conversion guard
now claims its own rejection before the vendor reports the same error. Final document
failures still report through the SDK; unrelated errors and failed exports retain their
existing reporting paths.

Tests cover actual event ordering and real editor retry, memory failure, font readiness
and corrupt-document reporting.
