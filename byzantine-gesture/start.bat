@echo off
setlocal
REM Double-click this file to start Byzantine Gesture.
REM It launches a local server and opens the browser automatically.
set PORT=8080
if not "%~1"=="" set PORT=%~1

REM Always run from the folder that contains this file
cd /d "%~dp0"

echo Byzantine Gesture
echo Folder: %CD%
echo.

if not exist "src\index.html" (
  echo ERROR: src\index.html was not found in this folder.
  echo Extract the whole zip first ^(right-click, Extract All^), then run start.bat from the extracted folder.
  pause
  exit /b 1
)

REM Find a Python that really runs. The Microsoft Store "python" shortcut
REM exists on many PCs but only prints "Python was not found", so test it.
set "PY="
py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
if not defined PY ( python -c "import sys" >nul 2>&1 && set "PY=python" )
if not defined PY ( python3 -c "import sys" >nul 2>&1 && set "PY=python3" )

REM No Python: use the small server written for Windows PowerShell, which every Windows has.
if not defined PY (
  echo Python was not found - using Windows PowerShell instead ^(nothing to install^).
  echo The browser will open automatically. Close this window to stop.
  echo.
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" %PORT%
  pause
  exit /b
)

echo Starting local server on http://localhost:%PORT%/
echo The browser will open automatically.
echo Press Ctrl+C in this window to stop the server.
echo.

start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:%PORT%/"
%PY% serve.py %PORT%
pause
