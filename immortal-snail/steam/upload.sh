#!/usr/bin/env bash
# Upload Snailmate Chess to Steam with SteamCMD (Linux, macOS or WSL).
#
#   STEAM_USER=you APP_ID=1234560 DEPOT_WIN=1234561 DEPOT_LINUX=1234562 ./upload.sh
#
# Required:  STEAM_USER   your Steamworks account name (the password is typed into SteamCMD,
#                         which also asks for the Steam Guard code; nothing is stored here)
#            APP_ID       the app's ID from Steamworks
#            DEPOT_WIN    the Windows depot ID
#            DEPOT_LINUX  the Linux depot ID
# Optional:  SET_LIVE     a beta branch to put the build on after uploading, e.g. "beta"
#                         (Steam never allows setting the default branch from here)
#            BUILD_DESC   a note for the build list (default: "Snailmate Chess <version> <date>")
#            STEAMCMD     path to steamcmd (default: steamcmd on PATH, or ~/steamcmd/steamcmd.sh)
# Flags:     --dry-run    check everything and print the generated scripts; upload nothing
#            --preview    SteamPipe preview build: steamcmd checks the files, uploads nothing
#            --ci         no prompts (for GitHub Actions): SteamCMD must log in with the saved
#                         login in ~/Steam/config/config.vdf, and the upload only counts as done
#                         when SteamCMD reports a BuildID
#
# Before running: put the builds in steam/content/ (./stage-content.sh does it).
set -euo pipefail
# Bash 5.2+ would treat "&" in a replacement text as "the match"; keep replacements literal.
shopt -u patsub_replacement 2>/dev/null || true

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
templates="$here/scripts"
content="$here/content"
out="$here/output"

# The game's executables (see ../desktop/electron-builder.yml): the Windows exe, and on Linux the
# launcher script plus the real Electron binary next to it.
WIN_EXE=SnailmateChess.exe
LINUX_EXE=snailmate-chess

dry_run=0
preview=0
ci=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --preview) preview=1 ;;
    --ci) ci=1 ;;
    -h | --help)
      awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
      exit 0
      ;;
    *)
      echo "upload.sh: unknown option $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

problems=0
fail() {
  echo "  x $*" >&2
  problems=$((problems + 1))
}

# ---- settings -----------------------------------------------------------------------------
echo "Checking settings..."
for name in STEAM_USER APP_ID DEPOT_WIN DEPOT_LINUX; do
  if [ -z "${!name:-}" ]; then fail "$name is not set"; fi
done
for name in APP_ID DEPOT_WIN DEPOT_LINUX; do
  value="${!name:-}"
  if [ -n "$value" ] && ! [[ "$value" =~ ^[0-9]+$ ]]; then fail "$name must be a number (got \"$value\")"; fi
done
if [ -n "${DEPOT_WIN:-}" ] && [ "${DEPOT_WIN:-}" = "${DEPOT_LINUX:-}" ]; then fail "DEPOT_WIN and DEPOT_LINUX must be different depots"; fi
SET_LIVE="${SET_LIVE:-}"
if [ -n "$SET_LIVE" ] && ! [[ "$SET_LIVE" =~ ^[A-Za-z0-9_.-]+$ ]]; then fail "SET_LIVE must be a branch name (letters, digits, - _ .)"; fi
branch_lower="$(printf '%s' "$SET_LIVE" | tr '[:upper:]' '[:lower:]')" # macOS bash 3.2 has no ${x,,}
if [ "$branch_lower" = "default" ] || [ "$branch_lower" = "public" ]; then
  fail "SET_LIVE cannot be the default branch: Steam only lets you set that live in Steamworks (App Admin > SteamPipe > Builds)"
fi

# ---- content --------------------------------------------------------------------------------
echo "Checking content in $content ..."
win="$content/windows"
lin="$content/linux"
[ -f "$win/$WIN_EXE" ] || fail "missing $win/$WIN_EXE (run ./stage-content.sh)"
[ -f "$win/resources/app.asar" ] || fail "missing $win/resources/app.asar"
[ -f "$lin/$LINUX_EXE" ] || fail "missing $lin/$LINUX_EXE (run ./stage-content.sh)"
[ -f "$lin/$LINUX_EXE.bin" ] || fail "missing $lin/$LINUX_EXE.bin"
[ -f "$lin/resources/app.asar" ] || fail "missing $lin/resources/app.asar"
for exe in "$LINUX_EXE" "$LINUX_EXE.bin" chrome_crashpad_handler; do
  if [ -f "$lin/$exe" ] && [ ! -x "$lin/$exe" ]; then
    fail "$lin/$exe is not executable: unpack the Linux build on Linux/macOS (tar keeps the permissions) or chmod +x it"
  fi
done

if [ "$problems" -gt 0 ]; then
  echo "upload.sh: $problems problem(s); nothing was uploaded." >&2
  exit 1
fi

# ---- build scripts ------------------------------------------------------------------------------
version="$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' "$here/../desktop/package.json" | head -n 1)"
product="$(sed -n 's/^ *"productName": *"\([^"]*\)".*/\1/p' "$here/../desktop/package.json" | head -n 1)"
BUILD_DESC="${BUILD_DESC:-${product:-Snailmate Chess} ${version:-?} $(date -u +%Y-%m-%d)}"
BUILD_DESC="${BUILD_DESC//\"/\'}"
BUILD_DESC="${BUILD_DESC//\\/\/}"

render() { # template -> stdout
  local text
  text="$(cat "$1")"
  text="${text//\{\{APP_ID\}\}/$APP_ID}"
  text="${text//\{\{DEPOT_WIN\}\}/$DEPOT_WIN}"
  text="${text//\{\{DEPOT_LINUX\}\}/$DEPOT_LINUX}"
  text="${text//\{\{BUILD_DESC\}\}/$BUILD_DESC}"
  text="${text//\{\{PREVIEW\}\}/$preview}"
  text="${text//\{\{SET_LIVE\}\}/$SET_LIVE}"
  # No branch to set live: drop the SetLive line instead of leaving it empty.
  if [ -z "$SET_LIVE" ]; then text="$(printf '%s\n' "$text" | grep -v '"SetLive"')"; fi
  printf '%s\n' "$text"
}

mkdir -p "$out/logs"
app_vdf="$out/app_build_${APP_ID}.vdf"
render "$templates/app_build.vdf.template" >"$app_vdf"
render "$templates/depot_build_windows.vdf.template" >"$out/depot_build_${DEPOT_WIN}.vdf"
render "$templates/depot_build_linux.vdf.template" >"$out/depot_build_${DEPOT_LINUX}.vdf"

# Every {{placeholder}} must have been filled.
if grep -n '{{' "$out"/app_build_"${APP_ID}".vdf "$out/depot_build_${DEPOT_WIN}.vdf" "$out/depot_build_${DEPOT_LINUX}.vdf" >&2; then
  echo "upload.sh: unfilled placeholders above" >&2
  exit 1
fi
# Syntax check (needs Node, which the rest of the kit uses anyway).
if command -v node >/dev/null 2>&1; then
  node "$templates/vdf-check.mjs" "$app_vdf" "$out/depot_build_${DEPOT_WIN}.vdf" "$out/depot_build_${DEPOT_LINUX}.vdf"
fi

# ---- run --------------------------------------------------------------------------------------
STEAMCMD="${STEAMCMD:-}"
if [ -z "$STEAMCMD" ]; then
  if command -v steamcmd >/dev/null 2>&1; then
    STEAMCMD="$(command -v steamcmd)"
  elif [ -x "$HOME/steamcmd/steamcmd.sh" ]; then
    STEAMCMD="$HOME/steamcmd/steamcmd.sh"
  fi
fi
cmd=("${STEAMCMD:-steamcmd}" +login "$STEAM_USER" +run_app_build "$app_vdf" +quit)

if [ "$dry_run" = 1 ]; then
  for f in "$app_vdf" "$out/depot_build_${DEPOT_WIN}.vdf" "$out/depot_build_${DEPOT_LINUX}.vdf"; do
    echo
    echo "===== ${f#"$here"/} ====="
    cat "$f"
  done
  echo
  echo "Content:"
  echo "  windows: $(find "$win" -type f | wc -l | tr -d ' ') files, $(du -sh "$win" | cut -f1)"
  echo "  linux:   $(find "$lin" -type f | wc -l | tr -d ' ') files, $(du -sh "$lin" | cut -f1)"
  echo
  echo "Dry run: would now run"
  printf ' %q' "${cmd[@]}"
  echo
  exit 0
fi

if [ -z "$STEAMCMD" ] || ! [ -x "$STEAMCMD" ]; then
  echo "upload.sh: SteamCMD not found. Install it (https://developer.valvesoftware.com/wiki/SteamCMD) or set STEAMCMD=/path/to/steamcmd.sh" >&2
  exit 1
fi

echo
if [ "$ci" = 1 ]; then # CI logs are shared: don't echo the IDs (they're repository secrets there)
  echo "Uploading the Windows and Linux depots${SET_LIVE:+, then setting the build live on branch \"$SET_LIVE\"}."
else
  echo "Uploading app $APP_ID (depots $DEPOT_WIN, $DEPOT_LINUX)${SET_LIVE:+, then setting it live on branch \"$SET_LIVE\"}."
fi
[ "$preview" = 1 ] && echo "Preview build: SteamCMD checks the files and writes logs to steam/output/logs, nothing is uploaded."

if [ "$ci" = 0 ]; then
  echo "SteamCMD will ask for your password and Steam Guard code."
  "${cmd[@]}"
  echo
  echo "Done. See the build in Steamworks: App Admin > SteamPipe > Builds."
  exit 0
fi

# --ci: nobody can type a password, so SteamCMD gets no input and must use the saved login. Its
# exit code alone doesn't prove an upload happened, so the BuildID it prints is checked too.
log="$out/logs/steamcmd.log"
status=0
"${cmd[@]}" </dev/null 2>&1 | tee "$log" || status=$?
build_id="$(sed -n 's/.*(BuildID \([0-9][0-9]*\)).*/\1/p' "$log" | tail -n 1)"
if [ "$status" -eq 0 ] && { [ "$preview" = 1 ] || [ "${build_id:-0}" != 0 ]; }; then
  echo
  echo "Done${build_id:+: BuildID $build_id}. See it in Steamworks: App Admin > SteamPipe > Builds."
  # In GitHub Actions, hand the BuildID to the next steps.
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "build_id=$build_id" >>"$GITHUB_OUTPUT"; fi
  exit 0
fi

echo >&2
echo "upload.sh: the upload failed (SteamCMD exit code $status${build_id:+, BuildID $build_id})." >&2
if grep -qiE 'cached credentials not found|login failure|logon denied|invalid password|steam ?guard|two-factor|expired|rate limit|password:' "$log"; then
  echo "upload.sh: SteamCMD could not log in with the saved login. On your computer run" >&2
  echo "  steamcmd +login <builder account> +quit   (type the password and Steam Guard code)" >&2
  echo "then put the new config.vdf into the STEAM_CONFIG_VDF secret again (see steam/README.md)." >&2
fi
for f in "$out"/logs/*.log "$HOME/Steam/logs/stderr.txt"; do
  [ -f "$f" ] && [ "$f" != "$log" ] || continue
  echo "----- last lines of ${f#"$HOME"/} -----" >&2
  tail -n 40 "$f" >&2
done
exit 1
