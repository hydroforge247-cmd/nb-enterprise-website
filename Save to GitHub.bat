@echo off
rem Saves the latest version of the NB Enterprise website to GitHub.
cd /d "%~dp0"
robocopy site docs /MIR /NFL /NDL /NJH /NJS >nul
rem practice copy of the staff admin (works on github.io only, see admin\demo-api.js)
robocopy admin docs\admin /MIR /NFL /NDL /NJH /NJS >nul
type nul > docs\.nojekyll
git add -A
git -c user.name="NFC Software Solutions" -c user.email="arnevreenen13@gmail.com" commit -m "Update website"
git push -u origin main
echo.
echo Done. You can close this window.
pause
