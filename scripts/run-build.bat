@echo off
rem Build the release executable (no installer bundle) with cargo on PATH.
rem Prepend (not append) the rustup bin dir so an older cargo.exe elsewhere
rem on PATH cannot be picked up.
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
call npx tauri build --no-bundle %*
