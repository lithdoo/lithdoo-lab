@echo off
setlocal

if not defined DAY_LOOM_DIR (
  echo [ERROR] ensure-day-loom.bat: DAY_LOOM_DIR is not set.
  exit /b 1
)

set "MODE=%~1"
if not defined MODE set "MODE=init"
set "EXAMPLE_ROOT=%~dp0.."
set "PROMPTPILE_DIST=%DAY_LOOM_DIR%\node_modules\promptpile\dist\index.js"
set "DAY_LOOM_DIST=%DAY_LOOM_DIR%\dist\index.js"
set "REPO_MCP_DIR=%DAY_LOOM_DIR%\..\..\promptpile\packages\promptpile-mcp"
set "REPO_MCP_DIST=%REPO_MCP_DIR%\dist\src\index.js"
set "FILESYSTEM_MCP_DIST=%EXAMPLE_ROOT%\.runtime\node_modules\@modelcontextprotocol\server-filesystem\dist\index.js"

if not exist "%PROMPTPILE_DIST%" (
  echo Installing dependencies in packages/day-loom...
  pushd "%DAY_LOOM_DIR%"
  call npm install
  if errorlevel 1 ( popd & exit /b 1 )
  popd
)

echo Building day-loom...
pushd "%DAY_LOOM_DIR%"
call npm run build
if errorlevel 1 ( popd & exit /b 1 )
popd

if not exist "%PROMPTPILE_DIST%" exit /b 1
if not exist "%DAY_LOOM_DIST%" exit /b 1
if /i not "%MODE%"=="revise" exit /b 0

if defined PROMPTPILE_MCP_BASE_URL goto check_filesystem
if defined PROMPTPILE_MCP_BIN goto check_filesystem
if exist "%REPO_MCP_DIST%" goto check_filesystem
where promptpile-mcp >nul 2>nul
if not errorlevel 1 goto check_filesystem
if exist "%REPO_MCP_DIR%\package.json" (
  echo Installing and building repository promptpile-mcp...
  pushd "%REPO_MCP_DIR%"
  call npm install
  if errorlevel 1 ( popd & exit /b 1 )
  call npm run build
  if errorlevel 1 ( popd & exit /b 1 )
  popd
)
if not exist "%REPO_MCP_DIST%" (
  echo [ERROR] promptpile-mcp CLI is required for interactive revise.
  exit /b 1
)

:check_filesystem
if defined PROMPTPILE_MCP_BASE_URL exit /b 0
if exist "%FILESYSTEM_MCP_DIST%" exit /b 0
echo Installing isolated filesystem MCP runtime...
call npm install --prefix "%EXAMPLE_ROOT%\.runtime" @modelcontextprotocol/server-filesystem@2026.1.14
if errorlevel 1 exit /b 1
if exist "%FILESYSTEM_MCP_DIST%" exit /b 0
echo [ERROR] filesystem MCP not found at:
echo   %FILESYSTEM_MCP_DIST%
exit /b 1
