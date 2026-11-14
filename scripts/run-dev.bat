@echo off
rem Launch the Tauri dev flow with a dynamic dev-server port (prefers 5173,
rem falls back to a random free port if it is occupied). cargo must be on
rem PATH; this shell's PATH lacks it, so prepend the rustup bin dir (an
rem older cargo.exe elsewhere on PATH must not win).
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
node scripts\launch-dev.mjs %*
