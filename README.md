# Ryme Notes

A desktop notes, task board and weekly planner app by Ryan James Lim.

Open https://rjlim0619-dev.github.io/ryme-notes/ in Chrome or Edge and click the Install icon in the address bar.

## Security
- Notes are encrypted on your device with AES-256-GCM. The key comes from your password via PBKDF2-SHA256 (600,000 rounds). The password itself is never stored.
- Wrong-password lockout: after 5 wrong tries you have to wait, and the wait doubles with each extra try (up to 1 hour). The app warns you about failed tries at your next login.
- Auto-lock after idle time, plus an optional lock when you leave the window for 1 minute.
- Backups are encrypted with your password.
- A strict Content Security Policy is in place, no third-party scripts or fonts are loaded, the app refuses to run inside someone else's frame, and all stored data is sanitized before it is shown.
