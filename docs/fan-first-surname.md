# First surname fan view

Base: da19b33dacac50139ce7f25167a37324206091c7 (semantic-zoom-labels).

The existing Surname mode remains available. Two opt-in modes are added:
First surname, and First surname (Tevar / Tebar). The latter assigns the
same visual group to these two exact spellings. Person labels retain the
recorded spelling. No name, person or Gramps database record is changed.

Grouping uses the first surname entry of the primary name. For older
records that store several surnames in that entry, it takes the first word,
except particle-led and internal-particle compounds. This is a display
heuristic, not a universal surname parser. Spelling and accents remain
significant. Missing surnames are shown separately.

Up to 18 groups receive opaque colors. Groups are ranked by sum of visible
angular spans, then name, to favor readable inner generations. Remaining
groups are shown as Other surnames. Legend counts are drawn positions,
including repeated ancestors, not distinct people. The text/fill pairs
have a tested contrast ratio of at least 4.5:1. These colors are not a
claim that all 18 groups are distinguishable by color alone.

The count legend is outside the SVG on screen, right on desktop and below
on narrow screens, with an independently scrollable panel. SVG export
includes its own count legend. Existing semantic zoom and deep-label
visibility behavior remain in place.

## Validation

- TZ=UTC npx vitest run: 85 files, 1444 tests pass.
- Focused fan chart/export/surname tests: 48 pass.
- ESLint and Prettier on changed JavaScript files.
- Real component preview inspected at desktop and mobile widths using a
  private exported layout. No private layout or preview bundle is included.
- The untouched base has a timezone-sensitive DNA clade test in local
  time; UTC makes both base and changed suites pass. No DNA code changed.
- Final production build could not be completed in the available memory:
  process exit 137 during minification, including with one minifier worker;
  a 384 MB heap retry reports heap exhaustion. CI must run npm ci and
  npm run build successfully before merge or deployment. A successful
  earlier build is not validation of this final revision.

## Release gate

Publish a PR against the fork from the stated base, review the exact head,
and require green CI. Preserve a backup of the current static assets and
rollback route before deployment. The test images show the real modified
component with a local harness, not an already-deployed production page.
