# Curated review assets

These are fictional Demo Mode screenshots, not proof of production integration.

- `crm-desktop.png`: retained to review the desktop lead table and navigation.
- `crm-v2-mobile.png`: retained to review the mobile card layout.
- `team-mobile.png`: retained to review the local permission inspector on mobile.

The former Today desktop/mobile and Posted desktop captures were redundant with the retained responsive examples and browser coverage, so they are excluded from the first commit. No product asset was removed. The app uses `src/app/icon.svg`; screenshots are not imported by product code.

Browser tests write fresh captures to ignored `test-results/` using Playwright output paths. They never overwrite these curated files. Refresh documentation images only during an intentional visual review.
