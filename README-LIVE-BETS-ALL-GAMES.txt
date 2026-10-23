Jiowin: Live-bet visuals across all game pages

Updated live-bets.js so all game pages use the same in-game live-player strip and animated chip overlays, modeled on the existing Dragon Tiger / 7 Up Down style.

Covered pages:
- dragon-tiger.html
- seven-up-down.html
- color.html
- slot.html
- aviator.html
- pappu.html
- e-sabong.html

Existing game logic, sounds, animations, and HTML game controls were not intentionally changed. The change is limited to the shared live-bets visualization script and this note.

Important: DEMO activity is simulated display data. REAL entries mean user-submitted bets received by the server; they are not independently verified as paid wagers. Actual cross-device live updates depend on the existing /api/live-bets endpoint and deployment configuration.

Validation performed: node --check on live-bets.js and server.js, HTML script inclusion check, and ZIP integrity test. No live Render/Firestore session was available, so production visuals and real-time multi-device sync are not claimed as verified.
