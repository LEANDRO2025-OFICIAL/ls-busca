@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0web"
title Redefinir senha - LS Busca

where node >nul 2>nul || goto sem_node

echo Feche a janela "LS Busca" antes de continuar: com ela aberta, este programa se recusa a mexer no banco.
echo.
rem Códigos de saída do script: 0 = senha trocada; 2 = recusou porque o banco está em uso; outro = nada alterado.
node scripts\redefinir-senha.mjs
set "CODIGO=%errorlevel%"
echo.
if "%CODIGO%"=="0" goto pronto
if "%CODIGO%"=="2" goto em_uso
echo A senha NÃO foi alterada. Veja a mensagem acima.
pause
exit /b %CODIGO%

:em_uso
echo A senha NÃO foi alterada: o LS Busca está aberto. Feche a janela "LS Busca" e rode este arquivo de novo.
pause
exit /b 2

:pronto
echo Pronto. Abra o LS Busca de novo pelo "Abrir LS Busca.bat".
pause
exit /b 0

:sem_node
echo Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra este arquivo de novo.
pause
exit /b 1
