@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Run npm ci in every subfolder that has package.json (uses package-lock.json).
REM For incremental installs or lock updates, run npm install in that folder instead.

set "ROOT=%~dp0"
if not exist "%ROOT%packages\" (
  echo ERROR: packages directory not found: "%ROOT%packages\"
  exit /b 1
)

call :npm_ci "packages\tomlith"
if errorlevel 1 exit /b 1

call :npm_ci "packages\promptpile"
if errorlevel 1 exit /b 1

call :npm_ci "packages\hostra"
if errorlevel 1 exit /b 1

call :npm_ci "packages\tomlith\example"
if errorlevel 1 exit /b 1

call :npm_ci "example"
if errorlevel 1 exit /b 1

call :npm_ci "web-components\web-editor-component"
if errorlevel 1 exit /b 1

call :npm_ci "web-components\file-view-component"
if errorlevel 1 exit /b 1

call :npm_ci "web-components\fsdb-view-component"
if errorlevel 1 exit /b 1

call :npm_ci "web-components\file-view-ws-server"
if errorlevel 1 exit /b 1

call :npm_ci "web-components\lsp-ws-server"
if errorlevel 1 exit /b 1

echo.
echo All workspace dependencies installed successfully.
exit /b 0

:npm_ci
set "REL=%~1"
cd /d "%ROOT%%REL%"
if not exist "package.json" (
  echo ERROR: package.json not found: "%ROOT%%REL%"
  exit /b 1
)
echo.
echo ========== npm ci: %REL% ==========
call npm ci
if errorlevel 1 (
  echo ERROR: npm ci failed in: %REL%
  exit /b 1
)
cd /d "%ROOT%"
exit /b 0
