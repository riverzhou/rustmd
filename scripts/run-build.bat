@echo off
rem Build the release executable (no installer bundle) with cargo on PATH.
set "PATH=%PATH%;%USERPROFILE%\.cargo\bin"
call npx tauri build --no-bundle %*
