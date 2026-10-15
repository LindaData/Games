#!/usr/bin/env bash
# Put the desktop builds where the Steam depot scripts expect them:
#   steam/content/windows/   ImmortalSnailChess.exe and its files
#   steam/content/linux/     immortal-snail-chess (launcher), immortal-snail-chess.bin, ...
#
#   ./stage-content.sh
#       from a local build: ../desktop/release/win-unpacked and linux-unpacked
#   ./stage-content.sh ~/Downloads/ImmortalSnailChess-windows.zip ~/Downloads/ImmortalSnailChess-linux.zip
#       from CI downloads: the GitHub artifact zips, or the .zip / .tar.gz inside them
#
# Run it on Linux, macOS or WSL: unpacking the Linux .tar.gz there keeps its executable bits.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
content="$here/content"
release="$here/../desktop/release"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# copy_build <dir with the app files> <windows|linux>
copy_build() {
  local from="$1" platform="$2"
  rm -rf "${content:?}/$platform"
  mkdir -p "$content/$platform"
  cp -a "$from/." "$content/$platform/"
  echo "  $platform: $(find "$content/$platform" -type f | wc -l | tr -d ' ') files, $(du -sh "$content/$platform" | cut -f1)"
}

# The folder inside an unpacked archive that holds the app (the archive root or one subfolder).
find_app_dir() {
  local root="$1" marker="$2" hit
  hit="$(find "$root" -maxdepth 3 -name "$marker" -type f | head -n 1)"
  [ -n "$hit" ] && dirname "$hit"
}

unpack() { # unpack <archive> <into>
  case "$1" in
    *.tar.gz | *.tgz) tar -xzf "$1" -C "$2" ;;
    *.zip) unzip -q "$1" -d "$2" ;;
    *)
      echo "stage-content: don't know how to unpack $1" >&2
      return 1
      ;;
  esac
}

stage_archive() {
  local archive="$1" platform marker dir nested
  case "$(basename "$archive" | tr '[:upper:]' '[:lower:]')" in
    *win*) platform=windows marker=ImmortalSnailChess.exe ;;
    *linux*) platform=linux marker=immortal-snail-chess.bin ;;
    *)
      echo "stage-content: can't tell whether $archive is the Windows or the Linux build (name it *win* or *linux*)" >&2
      exit 1
      ;;
  esac
  dir="$work/$platform"
  mkdir -p "$dir"
  unpack "$archive" "$dir"
  # A GitHub artifact zip wraps the real build archive: unpack that too.
  nested="$(find "$dir" -maxdepth 2 -type f \( -name '*.tar.gz' -o -name '*.zip' \) | head -n 1)"
  if [ -n "$nested" ] && [ -z "$(find_app_dir "$dir" "$marker")" ]; then
    mkdir -p "$dir/inner"
    unpack "$nested" "$dir/inner"
  fi
  local app
  app="$(find_app_dir "$dir" "$marker")" || true
  if [ -z "$app" ]; then
    echo "stage-content: no $marker inside $archive" >&2
    exit 1
  fi
  copy_build "$app" "$platform"
}

echo "Staging builds into $content ..."
if [ "$#" -eq 0 ]; then
  [ -f "$release/win-unpacked/ImmortalSnailChess.exe" ] || {
    echo "stage-content: no Windows build in $release/win-unpacked (cd ../desktop && npm run dist:win)" >&2
    exit 1
  }
  [ -f "$release/linux-unpacked/immortal-snail-chess.bin" ] || {
    echo "stage-content: no Linux build in $release/linux-unpacked (cd ../desktop && npm run dist:linux)" >&2
    exit 1
  }
  copy_build "$release/win-unpacked" windows
  copy_build "$release/linux-unpacked" linux
else
  for archive in "$@"; do stage_archive "$archive"; done
fi

if [ -f "$content/linux/immortal-snail-chess" ] && [ ! -x "$content/linux/immortal-snail-chess" ]; then
  echo "warning: the Linux launcher lost its executable bit; fixing" >&2
  chmod +x "$content/linux/immortal-snail-chess" "$content/linux/immortal-snail-chess.bin" "$content/linux/chrome_crashpad_handler" 2>/dev/null || true
fi
echo "Done. Next: ./upload.sh --dry-run"
