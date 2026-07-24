# NextarpSDK — Summary of Changes Made

A plain-language record of everything fixed and added in the ID scanning app during this round of work.

## 1. Scanning and verification fixes

- Fixed the Turkey (and Spain) back-side scanning problem: the app was incorrectly checking the back of the ID for a face photo and for matching country text, even though the back of a driving licence never has a photo and often has no printed country name at all. These two checks now only run on the front side, so the back side no longer shows false "No ID photo detected" or "Doesn't match Turkey/Spain" errors.
- Fixed a false "No glare / overexposure" warning that was triggering on normal, clear photos just because the ID card's background is naturally light or white. The check now only flags real light reflections/hotspots, not a plain light-coloured document.
- Improved face detection reliability: the app now gives a scan a second, different detection pass before deciding "no face found" — this helps in cases like a watermark ("SPECIMEN"/"ESPECIMEN") crossing over the photo, which had been causing a valid ID photo to be missed.
- Fixed a timing issue where a scan could start before the app had fully loaded your saved nationality preference, which could cause a document to be tagged with the wrong country by mistake.

## 2. Review screen and scanning flow

- The front-side Review screen now only ever shows two buttons: **Next** (or "Continue anyway" if a check failed) and **Retake** — the Retake button only appears when something is flagged red; it's hidden when every check passes.
- Removed the "Save anyway" override on both the front and back review screens — if a check is flagged red, the only option now is to Retake the photo, rather than being able to push through with a flagged issue.
- The warning pop-up on the front Review screen now appears for *any* red-flagged issue (blurry, glare, low resolution, wrong orientation, missing photo, or wrong country) — not just for the face or nationality checks.
- Added a dedicated **Back Side** screen: tapping "Next" on the front review now takes you to its own capture-and-review screen for the back of the document, instead of immediately relaunching the camera.
- Renamed the Success screen's "Done" button to **Save**, and made it full width instead of a small button.

## 3. Navigation and document management

- The Home screen's Recent Scans list is now clickable — tapping any scan (or "View all") takes you straight to the Documents tab.
- Opening any saved ID from the Documents tab now shows a full-page viewer with both the front and back photos, styled like flipping through the pages of a document, instead of just a small thumbnail.
- Added swipe-to-delete on the Home screen: swiping left on any Recent Scan reveals a Delete button — tapping it removes that document from both the Recent Scans list and the Documents tab, and deletes its photos from the device.

## 4. Custom naming

- Tapping "Save" on the Success screen now opens a prompt asking you to name the document (it starts pre-filled with the document type, e.g. "Driving licence", which you can overwrite). The name you choose then appears everywhere that document is listed — Home's Recent Scans and the Documents tab.
- Added a rename option inside the document detail viewer: a small pencil icon next to the document's name lets you edit it on the spot; tapping the checkmark that appears saves the new name.

## 5. Data reliability fix

- Fixed a serious bug where scanning more than one driving licence on the same day could cause the photos to be saved into the exact same file location, meaning a later scan could silently overwrite an earlier one's saved photos. Each scan session now gets its own unique save location, so this can no longer happen going forward.
