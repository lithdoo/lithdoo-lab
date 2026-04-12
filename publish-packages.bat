@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "PACKAGES=%~dp0packages"
set "ROOT_NPMRC=%~dp0.npmrc"
set "AUTH_HELPER=%~dp0scripts\publish-npm-auth.js"

if not exist "%PACKAGES%\" (
  echo ERROR: packages directory not found: "%PACKAGES%"
  exit /b 1
)

REM Detect --dry-run without findstr (findstr treats leading "-" as flags).
set "IS_DRY=0"
if not "%~1"=="" (
  for %%A in (%*) do (
    if /I "%%~A"=="--dry-run" set "IS_DRY=1"
  )
)

REM Publish mode: build a temp npmrc from repo root .npmrc token so npm publish sees auth
REM (running from packages\*\ subdirs may not load root .npmrc the way you expect).
set "PUBLISH_NPMRC="
if "!IS_DRY!"=="0" (
  if not exist "!ROOT_NPMRC!" (
    echo ERROR: For publish, add token to: !ROOT_NPMRC!
    echo Example line: //registry.npmjs.org/:_authToken=npm_your_token_here
    exit /b 1
  )
  if not exist "!AUTH_HELPER!" (
    echo ERROR: Missing !AUTH_HELPER!
    exit /b 1
  )
  set "PUBLISH_NPMRC=%TEMP%\hostra-publish-!RANDOM!-!RANDOM!.npmrc"
  node "!AUTH_HELPER!" "!ROOT_NPMRC!" "!PUBLISH_NPMRC!"
  if errorlevel 1 (
    echo ERROR: Could not read _authToken from !ROOT_NPMRC!
    exit /b 1
  )
)

echo Publishing packages under: "%PACKAGES%"
echo Skip rule: npm view name@version matches package.json -^> skip publish/pack step
echo.
if "!IS_DRY!"=="1" (
  echo Mode: DRY RUN ^(npm pack --dry-run only^)
) else (
  echo Mode: PUBLISH ^(auth from !ROOT_NPMRC! via temp userconfig^)
  echo Extra npm args: %*
)
echo.

for /d %%D in ("%PACKAGES%\*") do (
  if exist "%%D\package.json" (
    echo === %%~nxD ===
    pushd "%%D" || exit /b 1

    for /f "delims=" %%N in ('node -p "require('./package.json').name"') do set "PKG_NAME=%%N"
    for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "LOCAL_VER=%%V"

    REM npm view + redirection must run outside this ( ) block; see :NpmViewVersion.
    call :NpmViewVersion "!PKG_NAME!" "!LOCAL_VER!"

    if "!PUBLISHED_VER!"=="!LOCAL_VER!" (
      echo Skip: !PKG_NAME!@!LOCAL_VER! already on registry.
      popd
    ) else (
      if "!IS_DRY!"=="1" (
        echo Pack dry-run: !PKG_NAME! !LOCAL_VER!
        call npm pack --dry-run
      ) else (
        echo Publish: !PKG_NAME! !LOCAL_VER!
        call npm publish --userconfig "!PUBLISH_NPMRC!" %*
      )
      if errorlevel 1 (
        echo Failed: %%~nxD
        popd
        if defined PUBLISH_NPMRC if exist "!PUBLISH_NPMRC!" del /q "!PUBLISH_NPMRC!"
        exit /b 1
      )
      popd
    )
    echo.
  )
)

if defined PUBLISH_NPMRC if exist "!PUBLISH_NPMRC!" del /q "!PUBLISH_NPMRC!"

echo All packages processed.
exit /b 0

:NpmViewVersion
set "PUBLISHED_VER="
for /f "delims=" %%R in ('npm view "%~1@%~2" version 2^>nul') do set "PUBLISHED_VER=%%R"
exit /b 0
