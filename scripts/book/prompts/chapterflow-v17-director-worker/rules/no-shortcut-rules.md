# No Shortcut Rules

These are hard failures:

- generating later chapters from seed objects instead of the chapter loop
- writing chapter prose in JS/Python helper functions
- assembling release from in-memory generated chapters instead of validated files
- using a bulk generator to emit chapters 3+ in one pass
- letting the Director draft chapter prose inline

If any of these occur, stop the run and reroute through the real worker loop.
