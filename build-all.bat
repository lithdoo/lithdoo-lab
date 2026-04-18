@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Run npm run build in each subproject that defines a build script.

set "ROOT=%~dp0"
if not exist "%ROOT%packages\" (
  echo ERROR: packages directory not found: "%ROOT%packages\"
  exit /b 1
)

call :npm_build "packages\tomlith"
if errorlevel 1 exit /b 1

call :npm_build "packages\promptpile"
if errorlevel 1 exit /b 1

call :npm_build "web-components\file-view-component"
if errorlevel 1 exit /b 1

call :npm_build "web-components\fsdb-view-component"
if errorlevel 1 exit /b 1

call :npm_build "web-components\web-editor-component"
if errorlevel 1 exit /b 1

call :npm_build "web-components\file-view-ws-server"
if errorlevel 1 exit /b 1

call :npm_build "web-components\lsp-ws-server"
if errorlevel 1 exit /b 1

echo.
echo All builds finished successfully.
exit /b 0

:npm_build
set "REL=%~1"
cd /d "%ROOT%%REL%"
if not exist "package.json" (
  echo ERROR: package.json not found: "%ROOT%%REL%"
  exit /b 1
)
echo.
echo ========== npm run build: %REL% ==========
call npm run build
if errorlevel 1 (
  echo ERROR: npm run build failed in: %REL%
  exit /b 1
)
cd /d "%ROOT%"
exit /b 0
