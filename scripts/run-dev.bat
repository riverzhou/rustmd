@echo off
rem Launch the Tauri dev flow with a dynamic dev-server port (prefers 5173,
rem falls back to a random free port if it is occupied). cargo must be on
rem PATH; this shell's PATH lacks it, so prepend the rustup bin dir.
set "PATH=%PATH%;C:\Users\River\.cargo\bin"
node scripts\launch-dev.mjs %*
