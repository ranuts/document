# Initial device-loss probe setup failure

Process exit 1: the model loaded, but the probe waited 180000 ms for `.cui-msg-assistant`, which does not exist in the product. Real assistant messages use role agent and `.cui-msg-agent`. No device destruction was reached, so this is a probe setup failure, not a product GPU-loss verdict. Browser context closure and the original raw error are preserved. The separately named corrected driver targets an active streaming row and includes explicit reload/retry checks.
