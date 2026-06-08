# Changelog

All notable changes to the Centre AllBall website will be documented in this file.

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
