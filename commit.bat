@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo ======================================
echo   MEAGO SERVER - VERIFY AND COMMIT
echo ======================================

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto :not_git

for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not defined CURRENT_BRANCH (
  echo [ERROR] Dang o detached HEAD.
  goto :fail
)

echo [1/5] Kiem tra diff...
git diff --check
if errorlevel 1 goto :fail

echo [2/5] Chay quality gates...
call npm run lint
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
call npm test -- --runInBand
if errorlevel 1 goto :fail

set "COMMIT_MESSAGE="
set /p "COMMIT_MESSAGE=Nhap commit message: "
if not defined COMMIT_MESSAGE (
  echo [ERROR] Commit message khong duoc de trong.
  goto :fail
)

echo [3/5] Stage va commit tat ca thay doi...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo [ERROR] Khong co thay doi de commit.
  goto :fail
)
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :fail

echo [4/5] Pull origin/%CURRENT_BRANCH% bang rebase...
git pull --rebase origin "%CURRENT_BRANCH%"
if errorlevel 1 (
  echo [ERROR] Pull/rebase that bai. Hay xu ly conflict thu cong.
  goto :fail
)

echo [5/5] Push origin/%CURRENT_BRANCH%...
git push origin "%CURRENT_BRANCH%"
if errorlevel 1 goto :fail

echo [OK] Hoan tat commit va push MeagoServer.
exit /b 0

:not_git
echo [ERROR] Thu muc hien tai khong phai Git repository.

:fail
echo [FAILED] Da dung. Script khong force-push va khong xoa thay doi.
exit /b 1

