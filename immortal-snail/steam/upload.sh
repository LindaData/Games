#!/usr/bin/env bash
# Upload Immortal Snail Chess to Steam with SteamCMD (Linux, macOS or WSL).
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
#            BUILD_DESC   a note for the build list (default: "Immortal Snail Chess <version> <date>")
#            STEAMCMD     path to steamcmd (default: steamcmd on PATH, or ~/steamcmd/steamcmd.sh)
# Flags:     --dry-run    check everything and print the generated scripts; upload nothing
#            --preview    SteamPipe preview build: steamcmd checks the files, uploads nothing
#
# Before running: put the builds in steam/content/ (./stage-content.sh does it).
set -euo pipefail
# Bash 5.2+ would treat "&" in a replacement text as "the match"; keep replacements literal.
shopt -u patsub_replacement 2>/dev/null || true

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
templates="$here/scripts"
content="$here/content"
out="$here/output"

dry_run=0
preview=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --preview) preview=1 ;;
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
[ -f "$win/ImmortalSnailChess.exe" ] || fail "missing $win/ImmortalSnailChess.exe (run ./stage-content.sh)"
[ -f "$win/resources/app.asar" ] || fail "missing $win/resources/app.asar"
[ -f "$lin/immortal-snail-chess" ] || fail "missing $lin/immortal-snail-chess (run ./stage-content.sh)"
[ -f "$lin/immortal-snail-chess.bin" ] || fail "missing $lin/immortal-snail-chess.bin"
[ -f "$lin/resources/app.asar" ] || fail "missing $lin/resources/app.asar"
for exe in immortal-snail-chess immortal-snail-chess.bin chrome_crashpad_handler; do
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
BUILD_DESC="${BUILD_DESC:-Immortal Snail Chess ${version:-?} $(date -u +%Y-%m-%d)}"
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
echo "Uploading app $APP_ID (depots $DEPOT_WIN, $DEPOT_LINUX)${SET_LIVE:+, then setting it live on branch \"$SET_LIVE\"}."
[ "$preview" = 1 ] && echo "Preview build: SteamCMD checks the files and writes logs to steam/output/logs, nothing is uploaded."
echo "SteamCMD will ask for your password and Steam Guard code."
"${cmd[@]}"
echo
echo "Done. See the build in Steamworks: App Admin > SteamPipe > Builds."
