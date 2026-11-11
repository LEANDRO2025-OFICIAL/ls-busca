@echo off
chcp 65001 >nul
cd /d "%~dp0web"
title Redefinir senha - LS Busca
echo Feche a janela "LS Busca" antes de continuar (o banco só abre em um programa por vez).
pause
node scripts\redefinir-senha.mjs
echo.
echo Pronto. Abra o LS Busca de novo pelo "Abrir LS Busca.bat".
pause
