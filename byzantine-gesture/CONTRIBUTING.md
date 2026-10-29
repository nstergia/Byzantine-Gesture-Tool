# Contributing

Contributions are welcome — bug reports, usability feedback from classroom
use, and translations of the interface are all valuable.

1. Fork the repository and create a branch from `main`.
2. Keep `lib/core.mjs` a faithful 1:1 port of the functions in `src/index.html`
   — if you change an algorithm in one place, change it in the other and add
   or update a test in `tests/core.test.mjs`.
3. Run `npm test` before opening a pull request.
4. Describe *what musical behaviour* a change affects (e.g. "widens the
   freeze-gesture thumb tolerance") so non-technical reviewers can follow.
