# Getting Immortal Snail Chess on Steam

Everything that can be prepared without your Steam account is here: the desktop app
(`../desktop`), store text, all store/library art, screenshots, and the upload scripts.
What only you can do: sign up, pay, fill in Steamworks, upload, and press the buttons.

**The game being shipped:** chess against the computer with two immortal snails. Your green
snail hunts their king, their bronze snail hunts yours; every 3 turns both crawl one square.
A snail that reaches a king wins the game for its side (checkmate still works too). Three modes:
**Ghost Snails** (snails slide over pieces), **Hungry Snails** (snails eat enemy pieces they crawl
onto) and **Sacrifice Snails** (give up one of your pieces, your snail starts in its place).

| Path | What it is |
| --- | --- |
| `store/store-page.md` | Store text to paste: short description, About, tags, system requirements, content survey answers, price |
| `store/art/` | Every store and library graphic at Steam's exact sizes, plus community and client icons |
| `store/screenshots/` | 7 screenshots (1920x1080) from the real game: mode picker, each mode mid-game, a Hungry eat, your snail winning, their snail winning |
| `stage-content.sh` | Puts the Windows and Linux builds into `content/windows` and `content/linux` |
| `upload.sh` / `upload.ps1` | Fill in the SteamPipe scripts and run SteamCMD (`--dry-run` / `-DryRun` to check first) |
| `scripts/*.vdf.template` | The SteamPipe app and depot build scripts |
| `art/` | Generators: `npm run art` (graphics + app icons), `npm run screenshots`, `npm run verify` (sizes) |

Run `npm install` once in this folder before using the generators (they use the Chromium at
`/opt/pw-browsers/chromium`, `$CHROMIUM_PATH`, or one installed with `npx playwright-core install chromium`).

## Before you pay

- **The name.** Search "Immortal Snail Chess" on Steam, the web and a trademark database (USPTO
  TESS / EUIPO) before you commit. The game idea comes from the "Immortal Snail Chess!" YouTube
  Short by **ViperKing** (itself riffing on the immortal snail meme). Game rules and ideas
  aren't protected by copyright, but the title is identical to his video, so consider crediting
  him on the store page or, better, asking him first (he may even share it). If you'd rather
  avoid any confusion, pick a new name now, before any art is uploaded: change the product name
  in `../desktop` (`package.json`, `electron-builder.yml`, `src/main.js`) and the game's title,
  edit the title text in `art/scenes.mjs`, and re-run `npm run art`.
- **The content is original.** All code and art in this repo were made for this project: the
  snails and pieces are this game's own SVG drawings, and the two fonts used in the logo
  (Lilita One, Fredoka) are under the SIL Open Font License (`art/fonts/`). Open-source
  libraries in the game are listed in `THIRD-PARTY-NOTICES.txt` next to the exe.
- **Money and time.** Steam Direct costs US$100 per game (paid back after $1,000 of sales). A new
  developer account must wait 30 days after paying before its first release, and the store page
  must be public as "Coming Soon" for at least 2 weeks. Plan on 4-6 weeks from sign-up to launch.

## The checklist

1. **Sign up.** Create a Steamworks partner account at <https://partner.steamgames.com>, then
   complete the identity verification, bank details and tax interview, and pay the US$100 Steam
   Direct fee.

2. **Create the app.** In Steamworks you get an **App ID** (e.g. 1234560). Under
   *App Admin > SteamPipe > Depots* create two depots and note their IDs:
   - **Windows** (e.g. 1234561): Operating system *Windows*, architecture *64-bit*
   - **Linux** (e.g. 1234562): Operating system *Linux + SteamOS*, architecture *64-bit*
   - macOS: later (see "macOS" below).
   Then under *SteamPipe > Builds > Manage Branches* create a beta branch called `beta`: each
   upload in step 5 is set live there (`SET_LIVE=beta`), never straight on the default branch.
   Save, then *Publish* the changes (Steamworks changes only apply once published).

3. **Launch options.** *App Admin > Installation > General Installation > Launch Options*:
   - Windows: executable `ImmortalSnailChess.exe`, OS *Windows*, CPU *64-bit*, no arguments.
   - Linux: executable `immortal-snail-chess`, OS *Linux + SteamOS*, CPU *64-bit*, no arguments.
     This is a small launcher script next to the real binary. Steam can't install Electron's
     setuid sandbox helper, so the launcher keeps Chromium's sandbox on when the system allows
     it (user namespaces) and adds `--no-sandbox` only when it doesn't; otherwise the game would
     refuse to start on some distros. (`SNAIL_SANDBOX=off` / `on` forces either way.)
   - Linux runtime: *App Admin > Installation > Linux Runtime*: choose **Steam Linux Runtime 3.0
     (sniper)**. The Linux build is Electron (Chromium), which loads GTK 3, NSS, CUPS, GBM, ALSA
     and similar libraries from the system; sniper ships all of them, so the game starts the same
     on every distro and on Steam Deck. (Not 4.0: it has no GTK 3. If the menu item is missing,
     ask Steamworks support to enable it.)
   Publish.

4. **Get the builds.** Either
   - from GitHub: *Actions > Snail desktop builds > Run workflow* (or push a tag `snail-v1.0.0`),
     then download the `ImmortalSnailChess-windows` and `ImmortalSnailChess-linux` artifacts, and
     run `./stage-content.sh ~/Downloads/ImmortalSnailChess-windows.zip ~/Downloads/ImmortalSnailChess-linux.zip`;
   - or locally: `cd ../desktop && npm ci && npm run dist:win && npm run dist:linux`, then
     `./stage-content.sh` with no arguments.

   Either way you end up with `content/windows/ImmortalSnailChess.exe` and
   `content/linux/immortal-snail-chess`. (By hand: unzip the Windows zip into `content/windows`,
   and `tar -xzf` the Linux tarball into `content/linux` so the files sit directly inside.)

5. **Upload.** Install SteamCMD (<https://developer.valvesoftware.com/wiki/SteamCMD>), then on
   Linux, macOS or WSL:

   ```bash
   export STEAM_USER=your_account APP_ID=1234560 DEPOT_WIN=1234561 DEPOT_LINUX=1234562 SET_LIVE=beta
   ./upload.sh --dry-run    # checks the settings and content, prints the build scripts
   ./upload.sh              # SteamCMD asks for your password and Steam Guard code
   ```

   On Windows: set the same variables with `$env:NAME = "value"` and run
   `powershell -ExecutionPolicy Bypass -File upload.ps1 -DryRun`, then without `-DryRun`.
   Windows can't record Linux file permissions, so upload the Linux depot from Linux/macOS/WSL
   (or use `upload.ps1 -WindowsOnly`). Nothing stores your password; SteamCMD keeps its own login
   token in its install folder. `--preview` does a SteamPipe preview build (checks, no upload).

6. **Test, then go live.** The upload is live on the `beta` branch. In the Steam client:
   right-click the game > *Properties > Betas* > `beta`, install and play on Windows and Linux
   (and a Steam Deck if you have one: the touch screen and the trackpad-as-mouse should both
   work; check before release). Play a game of each mode, and quit and relaunch mid-game: it
   should resume where you were. When happy, in *SteamPipe > Builds* set that build live on the
   **default** branch (Steam only allows this in the website, never from SteamCMD).

7. **Store page.** *Store Admin*: paste the text from `store/store-page.md`; upload the graphics
   from `store/art/` (Store Assets: header, small, main, vertical capsules, page background;
   Library Assets: library capsule, header, hero, logo; Community icon; Client icon .ico) and at
   least 5 screenshots from `store/screenshots/`. Answer the content survey (answers in
   `store-page.md`), set the price (suggested US$2.99), and the release date.
   The screenshots show the final game (two snails, three modes; upload order in
   `store-page.md`). If the game's look changes later, re-take them with `npm run screenshots`.

8. **Valve's reviews.** Submit the store page for review (a few business days). Once approved,
   make it public as "Coming Soon": it has to be visible for at least 2 weeks before release.
   Submit the build for review (also a few days). Then press **Release** on your date.

## Updating the game later

Build again (or run the CI workflow), `./stage-content.sh ...`, `./upload.sh`, test on `beta`, set
live on default. Bump `version` in `../desktop/package.json` so builds are easy to tell apart.

## macOS (optional, later)

The CI workflow also builds an unsigned macOS app (universal, ad-hoc signed). To ship it on
Steam you need an Apple Developer account (US$99/year) to sign it with a "Developer ID
Application" certificate and notarize it: set `mac.identity` and `hardenedRuntime: true` in
`../desktop/electron-builder.yml`, add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
`APPLE_TEAM_ID` to the build environment, add a macOS depot, a third template for it, and a
launch option `Immortal Snail Chess.app`.

## Steamworks SDK

Not used: no achievements, cloud saves or overlay hooks are needed for launch, so the game has
no DRM and no Steam dependency. Saves live in the player's app data folder
(`%APPDATA%\Immortal Snail Chess` on Windows, `~/.config/Immortal Snail Chess` on Linux).
Achievements or Steam Cloud would be a later update (e.g. with the `steamworks.js` package);
Cloud would also need the game to save to a plain file rather than browser storage.
