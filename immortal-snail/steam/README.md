# Snailmate Chess on Steam

Everything is ready except the parts only you can do. Do them once, then every release is one
`git push` of a tag.

## You do (about 30 minutes, once)

1. **Sign up** at <https://partner.steamgames.com>: identity, bank, tax interview, pay the US$100
   Steam Direct fee.
2. **Create the app** "Snailmate Chess" and note its **App ID**. In *App Admin > SteamPipe >
   Depots* add two depots and note their IDs: **Windows** (64-bit) and **Linux + SteamOS** (64-bit).
3. **Launch options** (*App Admin > Installation > General Installation*), 2 of them, no arguments:
   - `SnailmateChess.exe`, Operating System **Windows**, CPU **64-bit**;
   - `snailmate-chess`, Operating System **Linux + SteamOS**, CPU **64-bit**.

   Then *Installation > Linux Runtime* (it appears once there is a Linux launch option):
   **Steam Linux Runtime 3.0 (sniper)**.
4. **Beta branch**: *SteamPipe > Builds > Manage Branches* > create `beta`. Press **Publish**.
5. **Builder account**: make a new Steam account just for uploads (e.g. `snailmate-builder`). In
   *Users & Permissions* give it this app with **Edit App Metadata** and **Publish App Changes To
   Steam** only.
6. **Save its login** with [SteamCMD](https://developer.valvesoftware.com/wiki/SteamCMD):
   `steamcmd +login snailmate-builder +quit`, type the password and the Steam Guard code. Then
   copy the saved login file as one line of base64:
   - Windows (PowerShell, in the SteamCMD folder):
     `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\config\config.vdf")) | Set-Clipboard`
   - Linux: `base64 -w0 ~/Steam/config/config.vdf`
   - macOS: `base64 -i ~/Library/Application\ Support/Steam/config/config.vdf`
7. **5 GitHub secrets** (*repo > Settings > Secrets and variables > Actions > New repository secret*):

   | Secret | Value |
   | --- | --- |
   | `STEAM_USERNAME` | the builder account name |
   | `STEAM_CONFIG_VDF` | the base64 text from step 6 |
   | `STEAM_APP_ID` | App ID |
   | `STEAM_DEPOT_WINDOWS` | Windows depot ID |
   | `STEAM_DEPOT_LINUX` | Linux depot ID |
8. **Merge** the pull request with this work into `main` on GitHub. GitHub only runs the release
   workflow (and shows its *Run workflow* button) once it is on `main`.

## Then it's automatic

1. Tag `main` with the version (it becomes the app's version):
   `git checkout main && git pull && git tag snail-v1.0.0 && git push origin snail-v1.0.0`
   (or *Actions > Steam release > Run workflow* and pick a branch).
2. GitHub builds Windows + Linux, uploads both to Steam and puts the build on **`beta`**. The run's
   summary shows the build number.
3. **Test**: in Steam, right-click the game > *Properties > Betas* > `beta`. Play each mode; quit
   mid-game and relaunch (it should resume).
4. **Go live**: *SteamPipe > Builds* > set that build live on **default** (only possible there).

If the upload says *login failed* one day, repeat step 6 and update `STEAM_CONFIG_VDF`.

## Store page

*Store Admin*: paste the text from `store/store-page.md` (description, tags, system requirements,
content survey answers, price US$2.99). Upload:

- graphics from `store/art/`: header, small, main, vertical capsules and page background (Store
  Assets); library capsule, header, hero and logo (Library Assets); community icon; client icon
  (`client_icon.ico`);
- all 7 screenshots from `store/screenshots/`, in order;
- the trailer `store/trailer.mp4`, with `store/trailer-thumbnail.jpg` as its thumbnail.

## Valve review timeline

- Your first release can be no sooner than **30 days** after paying the fee.
- Store page review: **3-5 business days** (submit at least 7 business days before you want it public).
- The **Coming Soon** page must be public for at least **2 weeks** before release.
- Build review: **3-5 business days**. Then press **Release**. Plan about 6 weeks in all.

## Steam Deck

- Controllers work natively: D-pad or left stick moves, **A** selects, **B** goes back, **X** shows
  the rules, **Y** / Start starts a new game.
- In Steamworks' *Steam Input* settings, choose the **Gamepad with Mouse Trackpad** template as
  the default (the right trackpad then also works as a mouse). No custom configuration is needed.
- Text stays legible at 1280x800; touch works too.

---

# Reference

## What's in this folder

| Path | What it is |
| --- | --- |
| `store/store-page.md` | Store text to paste: short description, About, tags, system requirements, content survey answers, price |
| `store/art/` | Every store and library graphic at Steam's exact sizes, plus community and client icons |
| `store/screenshots/` | 7 screenshots (1920x1080) from the real game |
| `store/trailer.mp4` | The trailer: real gameplay, about 32 s, 1920x1080 H.264 30 fps (+ `trailer-thumbnail.jpg`) |
| `stage-content.sh` | Puts the Windows and Linux builds into `content/windows` and `content/linux` |
| `upload.sh` / `upload.ps1` | Fill in the SteamPipe scripts and run SteamCMD (`--dry-run` / `-DryRun` to check first) |
| `scripts/*.vdf.template` | The SteamPipe app and depot build scripts |
| `art/` | Generators: `npm run art` (graphics + app icons), `npm run screenshots`, `npm run verify` (sizes) |
| `trailer/` | `npm run trailer`: plays the game in Chromium, records it, adds the title cards, encodes |
| `../../.github/workflows/steam-release.yml` | The automatic build + upload (uses `stage-content.sh` and `upload.sh --ci`) |
| `../../.github/workflows/snail-desktop.yml` | Builds only (Windows, Linux, macOS), for downloading |

Run `npm install` once here before using the generators (they use the Chromium at
`/opt/pw-browsers/chromium`, `$CHROMIUM_PATH`, or one installed with `npx playwright-core install chromium`).
The trailer also needs ffmpeg with libx264 (on the PATH, in `$FFMPEG_PATH`, or
`npm i --no-save ffmpeg-static`). The art and the trailer take the game's name from `../src/site.json`.

## Before you pay

- **The name.** Search "Snailmate Chess" on Steam, the web and a trademark database (USPTO /
  EUIPO). The idea comes from the "Immortal Snail Chess!" YouTube Short by **ViperKing** (itself
  riffing on the immortal snail meme). Rules and ideas aren't protected by copyright, but consider
  crediting him on the store page or asking him first. To rename again: the game and the art read
  the name from `../src/site.json`; the desktop app has it in `../desktop` (`package.json`,
  `electron-builder.yml`); the executable names are also in `upload.sh`, `upload.ps1`,
  `stage-content.sh` and the launch options. Then re-run `npm run art`, `npm run screenshots` and
  `npm run trailer`.
- **The content is original.** All code and art in this repo were made for this project: the
  snails and pieces are this game's own SVG drawings, and the two fonts in the logo (Lilita One,
  Fredoka) are under the SIL Open Font License (`art/fonts/`). Open-source libraries in the game
  are listed in `THIRD-PARTY-NOTICES.txt` next to the exe.
- **Money and time.** US$100 per game, paid back after $1,000 of sales. See the timeline above.

## How the automatic upload works

`steam-release.yml` runs on a `snail-v*` tag or by hand (input: branch, default `beta`). On a
`snail-vX.Y.Z` tag the app's version is `X.Y.Z` (set in `../desktop/package.json` for the build;
the committed number is only used by hand-run builds). It calls `snail-desktop.yml` to build and
test Windows + Linux, downloads both builds, runs `stage-content.sh`, installs SteamCMD on Ubuntu,
writes `STEAM_CONFIG_VDF` to `~/Steam/config/config.vdf` (the saved login; deleted at the end), and
runs `upload.sh --ci`. `--ci` never prompts: SteamCMD must log in with the saved login, and the job
only passes when SteamCMD reports a BuildID. Missing secrets: the upload is skipped with a warning
naming them, and the builds stay attached to the run. Secrets are never printed (GitHub also masks
them).

Valve notes: a builder account needs a phone number or the Steam Mobile App on it to set builds
live for an app that is already released; after any security change on that account (email,
phone) wait 3 days. Builds can never be set live on **default** from SteamCMD.

## Uploading by hand (no GitHub)

1. Builds: *Actions > Snail desktop builds > Run workflow* (once it is on `main`, step 8), download
   `SnailmateChess-windows` and `SnailmateChess-linux`, then
   `./stage-content.sh ~/Downloads/SnailmateChess-windows.zip ~/Downloads/SnailmateChess-linux.zip`.
   Or build locally: `cd ../desktop && npm ci && npm run dist:win && npm run dist:linux`, then
   `./stage-content.sh` with no arguments. Either way you get `content/windows/SnailmateChess.exe`
   and `content/linux/snailmate-chess`.
2. Upload from Linux, macOS or WSL:

   ```bash
   export STEAM_USER=snailmate-builder APP_ID=1234560 DEPOT_WIN=1234561 DEPOT_LINUX=1234562 SET_LIVE=beta
   ./upload.sh --dry-run    # checks the settings and content, prints the build scripts
   ./upload.sh              # SteamCMD asks for the password and Steam Guard code
   ```

   On Windows: set the same variables with `$env:NAME = "value"` and run
   `powershell -ExecutionPolicy Bypass -File upload.ps1 -DryRun`, then without `-DryRun`. Windows
   can't record Linux file permissions, so upload the Linux depot from Linux/macOS/WSL (or use
   `upload.ps1 -WindowsOnly`). `--preview` does a SteamPipe preview build (checks, no upload).

## The Linux launcher

The Linux launch option `snailmate-chess` is a small script next to the real binary
(`snailmate-chess.bin`). Steam can't install Electron's setuid sandbox helper, so the launcher
keeps Chromium's sandbox on when the system allows it (user namespaces) and adds `--no-sandbox`
only when it doesn't; otherwise the game would refuse to start on some distros
(`SNAIL_SANDBOX=off` / `on` forces either way). The **sniper** runtime ships the GTK 3, NSS, CUPS,
GBM and ALSA libraries Electron loads, so the game starts the same everywhere, including Steam
Deck. (Not 4.0: it has no GTK 3. If the *Linux Runtime* menu item is missing, check that the
`snailmate-chess` launch option's Operating System is **Linux + SteamOS**.)

## macOS (optional, later)

`snail-desktop.yml` also builds an unsigned macOS app (universal, ad-hoc signed). To ship it you
need an Apple Developer account (US$99/year) to sign it with a "Developer ID Application"
certificate and notarize it: set `mac.identity` and `hardenedRuntime: true` in
`../desktop/electron-builder.yml`, add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
`APPLE_TEAM_ID` to the build, add a macOS depot, a third depot template, and the launch option
`Snailmate Chess.app`.

## Steamworks SDK

Not used: no achievements, cloud saves or overlay hooks are needed for launch, so the game has no
DRM and no Steam dependency. Saves live in the player's app data folder
(`%APPDATA%\Snailmate Chess` on Windows, `~/.config/Snailmate Chess` on Linux). Achievements or
Steam Cloud would be a later update (e.g. with the `steamworks.js` package); Cloud would also need
the game to save to a plain file rather than browser storage.
