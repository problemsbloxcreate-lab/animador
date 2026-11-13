@echo off
rem ===== Instalar o AJUDANTE DO BLENDER (Estudio Problems) =====
rem Dois cliques e pronto. Copia o ajudante para uma pasta propria (LOCALAPPDATA\EstudioProblems\ajudante), entao
rem pode apagar este arquivo depois. NAO liga com o Windows: o Estudio liga o ajudante quando precisa (link estudio-blender://).
rem Para tirar: Desinstalar.cmd, na mesma pasta do ajudante.
chcp 65001 >nul
title Instalar o ajudante do Blender - Estudio Problems
set "D=%LOCALAPPDATA%\EstudioProblems\ajudante"
set "U=https://problemsbloxcreate-lab.github.io/animador/ajudante"
set "B="
for /d %%G in ("%ProgramFiles%\Blender Foundation\Blender*") do if exist "%%G\blender.exe" set "B=%%G\blender.exe"
if not defined B for /f "delims=" %%P in ('where blender 2^>nul') do if not defined B set "B=%%P"
if not defined B (
  echo.
  echo  Nao achei o Blender neste computador.
  echo  Instale o Blender em blender.org e de dois cliques neste arquivo de novo.
  echo.
  pause
  exit /b 1
)
echo.
echo  Blender encontrado: %B%
echo  Baixando o ajudante...
if not exist "%D%" mkdir "%D%"
for %%F in (ponte.py converter_cenario.py assar_cenario.py preparar_cenario.py render_cenario.py acabamento.py cenarios.json versao.txt) do (
  curl -fsSL "%U%/%%F" -o "%D%\%%F"
  if errorlevel 1 (
    echo.
    echo  Nao consegui baixar %%F. Confira a internet e tente de novo.
    pause
    exit /b 1
  )
)
rem liga escondido (sem janela preta)
> "%D%\ligar.vbs" echo Set s = CreateObject("WScript.Shell")
>> "%D%\ligar.vbs" echo s.Run """%B%"" -b --factory-startup -P ""%D%\ponte.py""", 0, False
rem o Estudio liga o ajudante por este link (so desta conta do Windows, sem precisar de administrador)
reg add "HKCU\Software\Classes\estudio-blender" /ve /d "URL:Ajudante do Blender (Estudio Problems)" /f >nul
reg add "HKCU\Software\Classes\estudio-blender" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\estudio-blender\shell\open\command" /ve /d "wscript.exe \"%D%\ligar.vbs\"" /f >nul
rem desinstalador
> "%D%\Desinstalar.cmd" echo @echo off
>> "%D%\Desinstalar.cmd" echo reg delete "HKCU\Software\Classes\estudio-blender" /f ^>nul 2^>nul
>> "%D%\Desinstalar.cmd" echo echo O ajudante do Blender foi tirado deste computador.
>> "%D%\Desinstalar.cmd" echo cd /d "%%TEMP%%"
>> "%D%\Desinstalar.cmd" echo timeout /t 3 ^>nul
>> "%D%\Desinstalar.cmd" echo rmdir /s /q "%D%"
wscript.exe "%D%\ligar.vbs"
echo.
echo  Pronto! O ajudante do Blender esta instalado.
echo  Pode fechar esta janela e apagar este arquivo. Volte ao Estudio: ele ja enxerga o Blender.
echo.
timeout /t 8 >nul
