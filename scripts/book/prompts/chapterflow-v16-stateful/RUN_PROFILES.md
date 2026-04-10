
# Run Profiles

## serial_stateful (default)
- safest option
- one chapter ticket at a time
- no parallel chapter generation
- best for long books and drift resistance

## balanced_stateful
- still one chapter ticket at a time
- lighter internal patch loops when critic issues are clearly local
- slightly faster than serial_stateful

## apex_stateful
- highest quality budget
- extra critic scrutiny on morally dense or rhetorically difficult chapters
- use for flagship books

v16 defaults to `serial_stateful` because stability is more important than throughput.
