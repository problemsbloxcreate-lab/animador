@echo off
rem Abre o Estudio Problems numa janela de programa (sem barra do navegador), sempre com os arquivos desta pasta.
setlocal
set "ARQ=%~dp0index.html"
set "URL=file:///%ARQ:\=/%"
set "CH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CH%" set "CH=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if exist "%CH%" (
  start "" "%CH%" --app="%URL%"
) else (
  start "" msedge --app="%URL%"
)
endlocal
