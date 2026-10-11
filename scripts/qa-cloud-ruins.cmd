@echo off
rem Visual QA for Cloud Ruins (Area 01) departure and Focus flow.
rem Runs typecheck + tests, records the app with its built-in QA capture, then leaves
rem one interactive QA window open. Uses separate QA data folders; your real save is not touched.
setlocal
cd /d "%~dp0.."
set "OUT=%CD%\previews\cloud-ruins-qa"
set "DATA=%TEMP%\focusquest-cloud-ruins-qa"
if exist "%DATA%" rmdir /s /q "%DATA%"
if not exist "%OUT%" mkdir "%OUT%"

echo [1/7] typecheck
call npm run typecheck > "%OUT%\typecheck.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\typecheck.log"

echo [2/7] tests
call npm test > "%OUT%\tests.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\tests.log"

echo [3/7] departure, high exit (real Focus screen, starts at 0 s)
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\departure-high"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_VIEW=cloud-departure-high"
set "FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR=%OUT%\departure-high"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=1000"
set "FOCUSQUEST_QA_CAPTURE_FRAME_COUNT=48"
call npx electron-vite dev > "%OUT%\run-departure-high.log" 2>&1

echo [4/7] departure, pine exit
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\departure-pines"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_VIEW=cloud-departure-pines"
set "FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR=%OUT%\departure-pines"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=1000"
set "FOCUSQUEST_QA_CAPTURE_FRAME_COUNT=48"
call npx electron-vite dev > "%OUT%\run-departure-pines.log" 2>&1

echo [5/7] real save data: first Focus on the newly chosen route
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\route-first-focus"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=archive"
set "FOCUSQUEST_QA_VIEW=focus"
set "FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR=%OUT%\route-first-focus"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=1000"
set "FOCUSQUEST_QA_CAPTURE_FRAME_COUNT=48"
call npx electron-vite dev > "%OUT%\run-route-first-focus.log" 2>&1

echo [6/7] reopening 30 s into that first Focus (must not replay)
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\reopen-30s"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=archive"
set "FOCUSQUEST_QA_VIEW=focus"
set "FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS=30"
set "FOCUSQUEST_QA_CAPTURE_PATH=%OUT%\reopen-after-30s.png"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=6000"
call npx electron-vite dev > "%OUT%\run-reopen-30s.log" 2>&1

echo [7/7] interactive QA window (leave it open; close this window when done)
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\interactive"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=reward"
echo done> "%OUT%\captures-finished.txt"
call npx electron-vite dev > "%OUT%\run-interactive.log" 2>&1
goto :eof

:clear
set "FOCUSQUEST_QA_USER_DATA="
set "FOCUSQUEST_QA_SEED="
set "FOCUSQUEST_QA_EXPEDITION="
set "FOCUSQUEST_QA_VIEW="
set "FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR="
set "FOCUSQUEST_QA_CAPTURE_PATH="
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS="
set "FOCUSQUEST_QA_CAPTURE_FRAME_COUNT="
set "FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS="
exit /b 0
