@echo off
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0.."
"%~dp0..\node_modules\electron\dist\electron.exe" "%~dp0open-nursery-audio-tester.cjs"
if errorlevel 1 pause
