@echo off
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=
set FOCUSQUEST_AREA05_QA=
call node_modules\.bin\electron.cmd scripts\try-echo-quarry.cjs
