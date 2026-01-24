# Learnings Log

## Git Remote Misconfiguration (2026-01-24)

- **Issue**: `git push` failed because the remote was named `-` instead of `origin`.
- **Cause**: Likely a typo during remote addition (e.g., `git remote add - <url>`).
- **Fix**: Renamed remote using `git remote rename - origin`.
- **Outcome**: Successfully pushed `mobile-perf` branch to GitHub.
