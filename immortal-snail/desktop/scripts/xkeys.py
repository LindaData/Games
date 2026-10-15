#!/usr/bin/env python3
"""Send real X11 key presses (XTEST) to whatever window is under the pointer.

Used by the smoke test on Linux to exercise the app's own shortcuts (F11, Esc, Ctrl+Q), which
synthetic DevTools key events do not reach. Needs only libX11 + libXtst (both come with Xvfb).

    python3 xkeys.py X Y F11            # move the pointer to X,Y (screen pixels) and press F11
    python3 xkeys.py X Y Control_L+q    # chord: hold Control_L, press q
"""
import ctypes
import ctypes.util
import sys
import time


def main() -> int:
    x11 = ctypes.CDLL(ctypes.util.find_library("X11") or "libX11.so.6")
    xtst = ctypes.CDLL(ctypes.util.find_library("Xtst") or "libXtst.so.6")
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XStringToKeysym.restype = ctypes.c_ulong
    x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
    x11.XKeysymToKeycode.restype = ctypes.c_ubyte
    x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]

    display = x11.XOpenDisplay(None)
    if not display:
        print("xkeys: cannot open display", file=sys.stderr)
        return 2
    x, y, chord = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    xtst.XTestFakeMotionEvent(display, -1, x, y, 0)
    x11.XFlush(display)
    time.sleep(0.1)
    codes = []
    for name in chord.split("+"):
        code = x11.XKeysymToKeycode(display, x11.XStringToKeysym(name.encode()))
        if not code:
            print(f"xkeys: unknown key {name}", file=sys.stderr)
            return 2
        codes.append(code)
    for code in codes:
        xtst.XTestFakeKeyEvent(display, code, 1, 0)
        x11.XFlush(display)
        time.sleep(0.05)
    for code in reversed(codes):
        xtst.XTestFakeKeyEvent(display, code, 0, 0)
        x11.XFlush(display)
        time.sleep(0.05)
    x11.XCloseDisplay(display)
    return 0


if __name__ == "__main__":
    sys.exit(main())
