@echo off
rem Starts the NB Enterprise website + product server, then opens it.
powershell -NoProfile -WindowStyle Hidden -Command "if (-not (Get-NetTCPConnection -LocalPort 4610 -State Listen -ErrorAction SilentlyContinue)) { Start-Process node -ArgumentList 'server.js' -WorkingDirectory '%~dp0server' -WindowStyle Hidden }"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4610/"
