@echo off
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=
set FOCUSQUEST_CAMERA_QA=
"node_modules\electron\dist\electron.exe" "scripts\try-moss-camera.cjs"
