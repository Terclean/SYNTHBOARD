# Contributing to SYNTHBOARD

Thank you for contributing to SYNTHBOARD.

## Local Development

```bash
npm ci
npm run dev
```

## Verification Before Opening a Pull Request

Run the test suite and production build:

```bash
npm test
npm run build
```

All tests in `npm test` (`patchValidator.test.js`, `verify.test.js`, and `workspace.test.js`) must pass, and `npm run build` must complete without errors.

## Guidelines for Contributed Presets

- Export presets directly from SYNTHBOARD (`Datei > Exportieren (JSON)`) or validate them against `validateAndSanitizePatchState` in `src/modules/patchValidator.js`.
- Use only existing module types (`MODULES` in `src/modules/index.js`), valid parameter ranges, and existing input/output jack IDs.
- Keep output levels balanced (around `master: 0.75` to `0.85`) and avoid extreme resonance or clipping.
- Use original preset names without referencing third-party artists or copyrighted songs.
- For AI-assisted preset generation, use the **KI-Referenz (.md)** export inside the in-app manual (`H`), which reflects the exact `MODULES` definitions and `patchSystem.js` jack aliases.
