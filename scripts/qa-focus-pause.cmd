@echo off
rem Pause-mode QA: typecheck + tests, then one interactive Focus window on isolated QA data
rem (%TEMP%\focusquest-pause-qa). The real save is never opened. Close this window when done.
setlocal
cd /d "%~dp0.."
set "OUT=%CD%\previews\focus-pause-qa"
set "DATA=%TEMP%\focusquest-pause-qa"
if exist "%DATA%" rmdir /s /q "%DATA%"
if not exist "%OUT%" mkdir "%OUT%"

echo [1/3] typecheck
call npm.cmd run typecheck > "%OUT%\typecheck.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\typecheck.log"

echo [2/3] tests
call npm.cmd test > "%OUT%\tests.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\tests.log"

echo [3/3] interactive Focus window (about 4.5 minutes in, close to the first lamp)
set "FOCUSQUEST_QA_USER_DATA=%DATA%\interactive"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=archive"
set "FOCUSQUEST_QA_VIEW=focus"
set "FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS=270"
set "FOCUSQUEST_QA_WINDOW_WIDTH=1366"
set "FOCUSQUEST_QA_WINDOW_HEIGHT=768"
echo ready> "%OUT%\interactive-started.txt"
call npx electron-vite dev > "%OUT%\run-interactive.log" 2>&1
