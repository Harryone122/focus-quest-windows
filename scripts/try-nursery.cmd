@echo off
cd /d "%~dp0.."
set ELECTRON_RUN_AS_NODE=
call node_modules\.bin\electron.cmd scripts\try-nursery.cjs
