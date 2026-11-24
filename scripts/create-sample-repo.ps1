<#
.SYNOPSIS
  Creates a git repository with prepared markdown changes for trying out the extension.

.DESCRIPTION
  Commits every file from samples/before, then copies samples/after over the working tree, so
  "Markdown Diff Visualiser: Show Changes" (Last Committed vs Unstaged) shows the prepared
  changes. The repository uses core.autocrlf=true, and the files listed in $CrlfFiles are
  written with CRLF line endings to reproduce issue #8.

.PARAMETER Path
  Target directory. It must not exist yet. Default: markdown-diff-samples next to this repository.

.EXAMPLE
  ./scripts/create-sample-repo.ps1
  code ../markdown-diff-samples
#>
param(
  [string]$Path = (Join-Path $PSScriptRoot '..\..\markdown-diff-samples')
)

$ErrorActionPreference = 'Stop'

$SamplesDir = Join-Path $PSScriptRoot '..\samples'
$CrlfFiles = @('06-crlf-line-endings.md')

function Invoke-Git {
  git -C $Path @args
  if ($LASTEXITCODE -ne 0) { throw "git $args failed with exit code $LASTEXITCODE" }
}

function Convert-ToCrlf([string]$File) {
  $text = [IO.File]::ReadAllText($File) -replace "`r?`n", "`r`n"
  [IO.File]::WriteAllText($File, $text)
}

if (Test-Path $Path) {
  throw "Target '$Path' already exists. Delete it or pass another -Path."
}

New-Item -ItemType Directory -Path $Path | Out-Null
$Path = (Resolve-Path $Path).Path

Invoke-Git init --quiet
Invoke-Git config user.name 'Markdown Diff Samples'
Invoke-Git config user.email 'samples@example.invalid'
Invoke-Git config commit.gpgsign false
Invoke-Git config core.autocrlf true
Invoke-Git config core.safecrlf false

Copy-Item (Join-Path $SamplesDir 'before\*') $Path
Invoke-Git add --all
Invoke-Git commit --quiet -m 'Sample baseline'

Copy-Item (Join-Path $SamplesDir 'after\*') $Path -Force
foreach ($file in $CrlfFiles) {
  Convert-ToCrlf (Join-Path $Path $file)
}

Write-Host "Sample repository created: $Path"
Write-Host "Open it with: code `"$Path`""
