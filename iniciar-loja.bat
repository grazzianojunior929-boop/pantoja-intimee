@echo off
chcp 65001 >nul
title Pantoja Intimee - Loja
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Vou abrir o site para baixar: instale a versao LTS e depois rode este arquivo de novo.
  echo.
  start "" https://nodejs.org/pt
  pause
  exit /b
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)"
if errorlevel 1 (
  echo.
  echo  Seu Node.js e antigo. Instale a versao LTS mais nova em https://nodejs.org/pt
  echo.
  start "" https://nodejs.org/pt
  pause
  exit /b
)

if not exist node_modules (
  echo  Instalando a loja pela primeira vez, aguarde...
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo  Nao foi possivel instalar. Verifique a internet e tente de novo.
    pause
    exit /b
  )
)

if not exist .env (
  > .env echo ADMIN_EMAIL=admin@pantojaintimee.com.br
  >> .env echo ADMIN_SENHA=pantoja123
  >> .env echo SESSION_SECRET=%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%%RANDOM%
)

echo.
echo  ==================================================
echo   Loja:   http://localhost:3000
echo   Painel: http://localhost:3000/admin
echo   Login:  admin@pantojaintimee.com.br / pantoja123
echo   Para desligar a loja, feche esta janela.
echo  ==================================================
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 3; Start-Process 'http://localhost:3000'"
node --disable-warning=ExperimentalWarning server.js
pause
