# Transparent logo

The owner supplied `logo.png` on 30 October 2026. Its white background was opaque.
At the owner's request the built-in imagegen tool produced a transparent cutout
for `public/aarogya-logo-transparent.png`. The original owner file is unchanged.
The application uses the full-color cutout for MFA and browser/install icons.
Its PNG alpha channel is retained when generating browser/install icons with
`node scripts/generate-icons.mjs`.

The new asset filenames avoid stale white-background images in older service
worker caches. The current PWA precaches the transparent variants.

## Final edit prompt

Use case: background-extraction. Edit target: the supplied Aarogya Drishti logo.
Remove only the plain white page/background and turn it into genuine transparent
alpha for a website PNG logo. Preserve the existing logo artwork, original colors
and gradients, the eye/head/oral magnifying glass/ribbon/leaves/swooshes, exact
lettering and original layout and proportions. Keep the white teeth and purposeful
white details within the illustrated mouth and magnifying glass; do not erase
those. Remove white background/negative-space around and between the wordmark
letters and separate design elements so a dark green webpage shows through there.
No new design, no altered or corrected spelling, no extra text, no recoloring, no
shadow, no white rectangular tile, no checkerboard baked into pixels. Output a
clean transparent PNG cutout of the same full logo.

## Dark background variant

At the owner's request, a second built-in imagegen edit created
`public/aarogya-logo-light.png` for the dark green sign-in panel and sidebar. The
first wordmark line is ivory and the second is pale mint. The colorful illustration
retains its existing design. The `.brand-logo-light` CSS class clips this generated
color layer with the original transparent PNG's alpha, preserving the original
contours and removing generated fringe outside the lettering. Keep both PNGs
available together. The PWA precaches both. White-background MFA and install icons
continue to use the full-color version for contrast.

The production build, desktop/mobile sign-in browser check, and intercepted
desktop/mobile sidebar layout checks passed on 30 October 2026. Both layouts were
visually reviewed on the dark green background. No hosted records were changed.

### Final selected edit prompt

Use case: precise-object-edit. Edit target: the supplied transparent Aarogya Drishti
logo. Create a polished, readable version for a dark green (#123f39) app sidebar.
Change ONLY the two wordmark lines: recolor the first blue lettering to bright
warm ivory (#F5FBF7) and the second green lettering to pale mint (#CDECC9), with
the same existing letter shapes and layout. Preserve the exact lettering/spelling
from the image: do not rewrite, add, omit or correct any letters. Preserve the
original eye outline, head silhouette, oral magnifying glass, red mouth, white
teeth, orange awareness ribbon, small green leaves inside the letter, swooshes,
colorful gradients and all their proportions. Keep the illustration colorful,
crisp and recognizable. Clean tiny stray edge speckles while preserving contours.
Maintain genuine transparent alpha around and between all elements, including
letter counters. No background rectangle, no colored backdrop, no checkerboard
baked in, no badge, no new border, no shadow, no new slogan. Keep the same square
canvas and full logo framing.
