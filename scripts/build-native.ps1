# Run in a Developer PowerShell for Visual Studio (C++ Build Tools).
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force backend\native | Out-Null
    cl.exe /nologo /O2 /LD /EHsc native\spatial.cpp /Febackend\native\geobusiness.dll /Fobackend\native\spatial.obj
    if ($LASTEXITCODE -ne 0) { throw 'C++ compilation failed' }
} finally { Pop-Location }
