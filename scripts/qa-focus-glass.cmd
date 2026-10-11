@echo off
rem Visual QA for the Focus Active edge glass (Cloud Ruins).
rem Typecheck + tests, then real-App captures at dawn / day / dusk / night / night-to-dawn,
rem in the default window and the minimum 1040x700 window, plus a live resize sequence.
rem Every run uses its own QA data folder under %TEMP%; the real save is never opened.
setlocal
cd /d "%~dp0.."
set "OUT=%CD%\previews\focus-glass-qa"
set "DATA=%TEMP%\focusquest-focus-glass-qa"
if exist "%DATA%" rmdir /s /q "%DATA%"
if not exist "%OUT%" mkdir "%OUT%"

echo [1/5] typecheck
call npm run typecheck > "%OUT%\typecheck.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\typecheck.log"

echo [2/5] tests
call npm test > "%OUT%\tests.log" 2>&1
echo exit code %errorlevel%>> "%OUT%\tests.log"

echo [3/5] default window 1366x768
for %%T in (0-dawn 150-day 300-dusk 450-night 560-night-to-dawn) do call :shot %%T 1366 768 wide

echo [4/5] minimum window 1040x700
for %%T in (0-dawn 150-day 300-dusk 450-night 560-night-to-dawn) do call :shot %%T 1040 700 min

echo [5/5] live resize 1366x768 to 1040x700 (frame sequence)
call :clear
set "FOCUSQUEST_QA_USER_DATA=%DATA%\resize"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=archive"
set "FOCUSQUEST_QA_VIEW=focus"
set "FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS=200"
set "FOCUSQUEST_QA_WINDOW_WIDTH=1366"
set "FOCUSQUEST_QA_WINDOW_HEIGHT=768"
set "FOCUSQUEST_QA_RESIZE_WIDTH=1040"
set "FOCUSQUEST_QA_RESIZE_HEIGHT=700"
set "FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR=%OUT%\resize-sequence"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=1000"
set "FOCUSQUEST_QA_CAPTURE_FRAME_COUNT=32"
call npx electron-vite dev > "%OUT%\run-resize.log" 2>&1
echo done> "%OUT%\captures-finished.txt"
goto :eof

:shot
rem %1 = seconds-label, %2 x %3 = window size, %4 = size label
call :clear
for /f "tokens=1 delims=-" %%S in ("%1") do set "SECS=%%S"
set "FOCUSQUEST_QA_USER_DATA=%DATA%\%4-%1"
set "FOCUSQUEST_QA_SEED=1"
set "FOCUSQUEST_QA_EXPEDITION=archive"
set "FOCUSQUEST_QA_VIEW=focus"
set "FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS=%SECS%"
set "FOCUSQUEST_QA_WINDOW_WIDTH=%2"
set "FOCUSQUEST_QA_WINDOW_HEIGHT=%3"
set "FOCUSQUEST_QA_CAPTURE_PATH=%OUT%\%4-%1.png"
set "FOCUSQUEST_QA_CAPTURE_DELAY_MS=8000"
echo    %4 %1
call npx electron-vite dev > "%OUT%\run-%4-%1.log" 2>&1
exit /b 0

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
set "FOCUSQUEST_QA_WINDOW_WIDTH="
set "FOCUSQUEST_QA_WINDOW_HEIGHT="
set "FOCUSQUEST_QA_RESIZE_WIDTH="
set "FOCUSQUEST_QA_RESIZE_HEIGHT="
exit /b 0
