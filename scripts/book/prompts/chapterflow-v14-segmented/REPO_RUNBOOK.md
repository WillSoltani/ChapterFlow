# Repo runbook

## A. Inputs
The only required user inputs are:
- title
- author

The orchestrator may ask one concise question only if edition or translation ambiguity materially changes chapter structure or meaning.

## B. Core pipeline sequence
1. preflight and manifest lock
2. source discovery and edition lock
3. source freeze
4. memory compilation
5. whole-book skeleton
6. Chapter 1 and Chapter 2 automatic quality sentries
7. remaining chapters in waves
8. release assembly from validated chapters only
9. core pipeline release gate

## C. Absolute bans
- no bulk content generators
- no one-pass synthesis of remaining chapters
- no release builder that authors content
- no manual approval pause in the middle of the core pipeline

## D. Post-pipeline integration
Run only after core success.
This is where app registration, cover work, build fixing, and UI verification happen.

## E. Cleanup
Run only after integration success and build pass.
