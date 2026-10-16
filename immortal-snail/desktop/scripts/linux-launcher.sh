#!/bin/sh
# Snailmate Chess launcher for Linux (this is what Steam starts).
#
# Electron (Chromium) sandboxes its child processes with Linux user namespaces, or, when those
# are unavailable, with the setuid-root helper "chrome-sandbox". When neither works it refuses to
# start ("The SUID sandbox helper binary was found, but is not configured correctly").
#
#  - Steam depots cannot ship a setuid-root file: chrome-sandbox arrives owned by the player
#    without the setuid bit, so the helper never works for a Steam install.
#  - Most distros allow unprivileged user namespaces, but some block them (Ubuntu 23.10+ AppArmor
#    policy, hardened kernels, some containers).
#
# So: run with the sandbox whenever one of the two works, and add --no-sandbox only when neither
# does (or when running as root, which Chromium refuses to sandbox). The game only ever loads its
# own local files and blocks all navigation, so that fallback is low risk.
# Set SNAIL_SANDBOX=off to force --no-sandbox, SNAIL_SANDBOX=on to never add it.

# This script is <name> (snailmate-chess); the real binary sits next to it as <name>.bin.
self=$(readlink -f "$0")
here=$(dirname "$self")
bin="$self.bin"

sandbox_ok() {
  case "${SNAIL_SANDBOX:-auto}" in
    on) return 0 ;;
    off) return 1 ;;
  esac
  [ "$(id -u)" = 0 ] && return 1
  # 1. Namespace sandbox: Chromium's preferred one. Probe it the way Chromium uses it.
  if command -v unshare >/dev/null 2>&1 &&
    unshare --user --map-root-user --pid --net --fork true >/dev/null 2>&1; then
    return 0
  fi
  # 2. setuid sandbox: only if chrome-sandbox is root-owned and setuid (e.g. a manual install).
  helper="$here/chrome-sandbox"
  if [ -u "$helper" ] && [ "$(stat -c %u "$helper" 2>/dev/null)" = 0 ]; then
    return 0
  fi
  return 1
}

for arg in "$@"; do
  [ "$arg" = "--no-sandbox" ] && exec "$bin" "$@"
done

if sandbox_ok; then
  exec "$bin" "$@"
else
  exec "$bin" --no-sandbox "$@"
fi
