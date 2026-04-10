# Worker Spawn Protocol

Each worker must run in a fresh context.
Each worker reads only:
- one role file or role card
- one work order
- the explicitly listed inputs for that stage

The Director must not inline the worker's output.
The worker writes one artifact and one receipt.
If fresh worker sessions are unavailable, mark the run blocked rather than simulating them inside the Director.
