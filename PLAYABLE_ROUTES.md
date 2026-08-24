# Playable route sources

## Zhiyin

- Source: `LittleNuB/Douyin-SubfuncDesign-Zhiyin`
- Source commit: `7fe1091`
- Runtime route: `/zhiyin/`
- Build command: `npm run build -- --base=/zhiyin/`
- Integration changes: scope media URLs to `/zhiyin/assets/` and add the personal-site return control.
- Public boundary: local mock data and deterministic snapshots only; no real AI, account data, reminder delivery, or external service.

The personal-site route is generated locally and ignored by Git. It keeps only assets needed by the interactive demo; the presentation-only background music is excluded.

## Body Inc.

- Source: `LittleNuB/body-inc-next-set-reconsidered`
- Source commit: `4cae0da`
- Runtime route: `/body-inc/`
- Runtime source: the shared deterministic mobile slice plus its validated Pixi office renderer.
- Integration changes: use route-relative runtime paths, add the personal-site return control, and let unavailable AI requests fall back to local copy.
- Public boundary: this is a playable experiment with technical validation, not an accepted product direction or a training/safety advisor.

The personal-site route is generated locally and ignored by Git. It contains no API key, server proxy, real training record, source concept board, test output, or local log.
