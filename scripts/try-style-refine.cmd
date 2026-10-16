@echo off
chcp 65001 >nul
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=
set FOCUSQUEST_AREA05_QA=
set FOCUSQUEST_AREA05_AUDIO_QA=
set FOCUSQUEST_STYLE_QA=
set FOCUSQUEST_STYLE_APP_QA=
:menu
cls
echo Focus Quest 精緻版試玩 · 每次使用獨立存檔
echo.
echo 1. 藏聲秋谷（新旅人＋戶外光影，可選日暮夜）
echo 2. 霧岸營火大廳
echo 3. 雲上遺庭
echo 4. 苔痕驛站
echo 5. 倒影湖畔
echo 6. 玻璃苗圃
echo 7. 離開
echo.
choice /c 1234567 /n /m "請選擇 1–7："
if errorlevel 7 exit /b
if errorlevel 6 (set scene=nursery) else if errorlevel 5 (set scene=lake) else if errorlevel 4 (set scene=moss) else if errorlevel 3 (set scene=cloud) else if errorlevel 2 (set scene=campfire) else (set scene=quarry)
if "%scene%"=="quarry" (call node_modules\.bin\electron.cmd scripts\try-echo-quarry.cjs) else (call node_modules\.bin\electron.cmd scripts\try-refined-map.cjs %scene%)
if errorlevel 1 pause
goto menu
