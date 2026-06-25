## QC loop rule

No more than one repair loop may run without `qc-diagnose <bookId> --round <roundId>`.
After repair changes chapter content, do not resume the old QC round for publishability;
start a fresh `qc-auto "<bookId>" --pass` round.
