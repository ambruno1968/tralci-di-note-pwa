@echo off
title Tralci di note - Prova PWA
cd /d "%~dp0"
node build-pwa.js
echo.
echo Apri Chrome su  http://localhost:8080   (CTRL+C per fermare)
start "" http://localhost:8080
node serve.js

