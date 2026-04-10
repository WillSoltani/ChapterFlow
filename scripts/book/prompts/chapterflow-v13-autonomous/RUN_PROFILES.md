# Run Profiles

## balanced_flagship
Default profile.
- premium writer/editor/critic for Chapters 1 and 2
- standard premium routing for the rest
- automatic chapter gates
- wave size 2 by default

## apex_flagship
Use for books where quality ceiling matters more than speed.
- premium routing for all chapters
- more solo waves for dense or morally sharp chapters
- stricter quality decay threshold

## fast_flagship
Use only after at least one successful balanced run.
- premium routing for Chapters 1 and 2
- cheaper routing for straightforward later chapters
- stronger stop conditions if quality drops

## auto_if_clear edition mode
Edition is auto-locked when one dominant option exists.
If translations or editions materially change structure, the user is asked once.
