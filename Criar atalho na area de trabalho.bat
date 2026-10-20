@echo off
rem Cria o atalho "Estudio Problems" (com ícone) na Área de Trabalho, apontando para "Abrir como programa.bat".
setlocal
set "PASTA=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Estudio Problems.lnk'); $s.TargetPath='%PASTA%Abrir como programa.bat'; $s.WorkingDirectory='%PASTA%'; $s.IconLocation='%PASTA%icones\turma.ico'; $s.WindowStyle=7; $s.Save()"
echo Atalho "Estudio Problems" criado na Area de Trabalho.
timeout /t 3 >nul
endlocal
