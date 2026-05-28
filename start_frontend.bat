@echo off
cd /d "%~dp0"
call npm install
node node_modules\vite\bin\vite.js
