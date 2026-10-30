# Transparent logo

The owner supplied `logo.png` on 30 October 2026. Its white background was opaque.
At the owner's request the built-in imagegen tool produced a transparent cutout
for `public/aarogya-logo-transparent.png`. The original owner file is unchanged.
The application uses the cutout for sign-in, the sidebar and MFA. Its PNG alpha
channel is retained when generating browser/install icons with
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
