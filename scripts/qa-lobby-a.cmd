@echo off
rem Visual QA for lobby option A (core plan 47) with sample data (dev previews #/qa/lobby-a-<scenario> and #/qa/after-<scenario>).
rem Typecheck + tests, then real-App captures of every scenario in the default and the minimum window.
rem Every run uses its own QA data folder under %TEMP%; the real save is never opened.
setlocal
cd /d "%~dp0.."
set "OUT=%CD%\previews\lobby-a-qa"
set "DATA=%TEMP%\focusquest-lobby-a-qa"
if exist "%DATA%" rmdir /s /q "%DATA%"
if not exist "%OUT%" mkdir "%OUT%"

echo [1/4] typecheck
call npm run typecheck > "%OUT%\typecheck.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\typecheck.log"

echo [2/4] tests
call npm test > "%OUT%\tests.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\tests.log"

echo [3/4] default window 1366x768
for %%S in (lobby-a-start lobby-a-partial lobby-a-choose lobby-a-selected lobby-a-yesterday lobby-a-final lobby-a-returned lobby-a-empty after-task after-complete after-partial after-short) do call :shot %%S 1366 768 wide

echo [4/4] minimum window 1040x700
for %%S in (lobby-a-start lobby-a-partial lobby-a-choose lobby-a-yesterday after-task after-complete) do call :shot %%S 1040 700 min

echo done> "%OUT%\captures-finished.txt"
goto :eof

:shot
rem %1 = view name, %2 x %3 = window size, %4 = size label
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\%4-%1"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_VIEW=%1"
set "FOCUSQUEST_QA_WINDOW_WIDTH=%2"
set "FOCUSQUEST_QA_WINDOW_HEIGHT=%3"
set "FOCUSQUEST_QA_CAPTURE_PATH=%OUT%\%4-%1.png"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=9000"
echo    %4 %1
call npx electron-vite dev > "%OUT%\run-%4-%1.log" 2>&1
exit /b 0

:clear
set "FOCUSQUEST_QA_USER_DATA="
set "FOCUSQUEST_QA_SEED="
set "FOCUSQUEST_QA_VIEW="
set "FOCUSQUEST_QA_CAPTURE_PATH="
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS="
set "FOCUSQUEST_QA_WINDOW_WIDTH="
set "FOCUSQUEST_QA_WINDOW_HEIGHT="
exit /b 0
