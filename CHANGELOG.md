# Changelog

All notable changes to the Centre AllBall website will be documented in this file.

## [1.1.2] - 2026-06-08

### Changed
- Replaced the broken background image in the hero Event Card photo section with `AllBall.jpeg`.

### Fixed
- Fixed readability issues in the Event Card by setting address and open hours details (`.ec-venue-addr`) to solid black (`var(--ink)`), ensuring full legibility against the card's light background.

## [1.1.1] - 2026-06-08

### Added
- Generated and integrated professional, high-resolution portrait headshots for Coach James (`coach-james.png`) and Coach Sarah (`coach-sarah.png`).
- Generated and integrated a vibrant, high-resolution action photograph for the birthday section (`kids-playing.png`).

### Changed
- Refactored `BALL.jpg` inside `.poster-graphic` to act as a full-bleed backdrop cover layer with hover parallax scaling transitions, while updating poster typography to high-contrast white.
- Balanced the desktop footer layout to a 2-column grid (`1.2fr 2fr`) following the newsletter removal.

### Removed
- Removed the newsletter subscription card (`.footer-newsletter`) from the footer per user request.

## [1.1.0] - 2026-06-08

### Added
- Animated gradient border ring keyframes (`gradient-shift`) for custom border animations.
- Divider (`.nav-divider`) between the brand logo and the link items in the floating pill navbar.
- Dynamic navigation highlighting on scroll using GSAP ScrollTrigger to observe section changes.
- CSS transitions for `.nav-logo` and `.profile-btn` (CTA) hover scaling and border shifts.
- Implemented hover scaling and rotation effects on the poster graphic's basketball image.

### Changed
- Replaced the broken `player-silhouette.jpg` inside the `poster-graphic` with `BALL.jpg` utilizing high-contrast grayscale blend filtering.
- Re-styled the navbar brand logo to italicized text with a shifting gradient border.
- Refactored CTA button (`.profile-btn`) to include an animated gradient border ring on hover.
- Cleared GSAP transforms on the navbar brand and CTA elements after the entrance timeline finishes to prevent override conflicts with CSS hover states.

### Fixed
- Fixed broken layout and rendering in the navigation header to match the SOP requirements.
