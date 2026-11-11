@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0web"
if "%~1"=="atualizar" goto atualizar
title LS Busca

where node >nul 2>nul || (
  echo Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra este arquivo de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependências, só na primeira vez...
  call npm install || goto erro
)
if not exist .next\BUILD_ID (
  echo Preparando o sistema, só na primeira vez...
  call npm run build || goto erro
)

rem Segredo novo a cada abertura: só esta janela e a de atualização conhecem.
for /f %%s in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')"') do set "CRON_SECRET=%%s"

start "LS Busca - atualização PNCP" /min cmd /c ""%~f0" atualizar"
rem Ao iniciar com o Windows (argumento "auto") não abre o navegador.
if not "%~1"=="auto" start "" /min cmd /c "timeout /t 4 >nul & start http://localhost:3000"

echo.
echo LS Busca aberto em http://localhost:3000
echo Feche esta janela para desligar o sistema.
echo.
call npm run start -- -H 127.0.0.1 -p 3000
goto :eof

:atualizar
rem Busca licitações novas no PNCP a cada minuto enquanto o sistema estiver aberto.
rem Cada chamada trabalha até 4 minutos e retoma de onde parou na próxima.
timeout /t 20 >nul
:laco
curl -s -o nul -m 300 -H "Authorization: Bearer %CRON_SECRET%" http://127.0.0.1:3000/api/cron/ingerir || exit /b
timeout /t 60 >nul
goto laco

:erro
echo.
echo Algo deu errado. Veja a mensagem acima.
pause
exit /b 1
