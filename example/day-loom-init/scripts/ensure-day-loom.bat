@echo off
setlocal EnableDelayedExpansion

if not defined DAY_LOOM_DIR (
  echo [ERROR] ensure-day-loom.bat: DAY_LOOM_DIR is not set.
  exit /b 1
)

set "PROMPTPILE_DIST=%DAY_LOOM_DIR%\node_modules\promptpile\dist\index.js"
set "DAY_LOOM_DIST=%DAY_LOOM_DIR%\dist\index.js"

if not exist "%PROMPTPILE_DIST%" (
  echo Installing dependencies in packages/day-loom...
  pushd "%DAY_LOOM_DIR%"
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] npm install failed in packages/day-loom.
    exit /b 1
  )
  popd
)

if not exist "%DAY_LOOM_DIST%" (
  echo Building day-loom...
  pushd "%DAY_LOOM_DIR%"
  call npm run build
  if errorlevel 1 (
    popd
    echo [ERROR] day-loom build failed.
    exit /b 1
  )
  popd
)

if not exist "%PROMPTPILE_DIST%" (
  echo [ERROR] promptpile not found at:
  echo   %PROMPTPILE_DIST%
  echo Run manually: cd packages\day-loom ^&^& npm install
  exit /b 1
)

if not exist "%DAY_LOOM_DIST%" (
  echo [ERROR] day-loom dist not found at:
  echo   %DAY_LOOM_DIST%
  exit /b 1
)

exit /b 0
