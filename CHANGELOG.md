# Changelog

All notable changes to Football Minutes Beta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Player Selection GK Bug**: Fixed issue where goalkeeper selection was unavailable after clicking "Continue to Player Selection" from Match Setup
  - GK selections now persist correctly when adding/removing players
  - Improved user feedback with clear warning message when fewer than 5 players selected
  - Enhanced accessibility with ARIA labels on all controls

### Added
- **Feature Flag System**: New utility for controlled feature rollouts
  - Environment variable support (`VITE_FEATURE_*`)
  - localStorage overrides for local testing
  - Debug utilities for troubleshooting

- **Centralized Audit Log** (In Progress):
  - New `AuditLogView` component for viewing change history
  - Enhanced audit API client with helper functions
  - Expandable event details showing before/after diffs
  - Feature-flagged for safe rollout

### Changed
- **GK Selector UX**: Now shows helpful warning instead of hiding when insufficient players
- **Test Infrastructure**: Added @testing-library/jest-dom matchers for better test assertions

### Technical
- Added comprehensive test suite for GKSelector component (16 tests, all passing)
- Improved TypeScript strict mode compliance
- Enhanced component accessibility

---

## [1.0.0] - 2024-12-04

### Added
- Initial release of Football Minutes Beta
- Match setup and player selection workflow
- Automatic lineup generation with fairness constraints
- Season statistics and player tracking
- Heat map visualization for player minutes
- Local storage and API persistence options
- Authentication system with coach/manager roles

### Features
- **Match Management**: Create matches with opponent, date, venue details
- **Player Allocation**: Fair distribution of playing time across quarters
- **GK Rotation**: Manual or automatic goalkeeper assignment
- **Statistics**: Track player minutes, games played, and performance
- **Heat Maps**: Visual representation of player participation patterns
- **Persistence**: Hybrid local storage + optional API backend

---

## Version History Notes

### Unreleased Changes
This section contains work in progress. Features may be incomplete or behind feature flags.

### Migration Notes
- No database migrations required for GK selection fix
- Audit log centralization is backward compatible (feature flagged)
- Local data (localStorage) is preserved during updates

### Upgrade Instructions
1. Pull latest code: `git pull origin main`
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Build: `npm run build`
5. Deploy to Vercel: `vercel --prod`

### Known Issues
- Audit log migration from local `editHistory` to API not yet implemented
- Date range filtering for audit log not available in MVP
- Mobile responsiveness for audit log needs testing

---

## Contributing

When adding entries to this changelog:
1. Place unreleased changes under `[Unreleased]` section
2. Use categories: Added, Changed, Deprecated, Removed, Fixed, Security
3. Write user-facing descriptions (not technical implementation details)
4. Include issue/PR numbers when available
5. Move entries to versioned section when releasing

Example:
```markdown
### Fixed
- Issue where GK selection was not saving ([#123](link-to-issue))
```
