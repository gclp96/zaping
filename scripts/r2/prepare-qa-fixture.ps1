# Generate a non-sensitive QA fixture. No credentials or network access.
param([string]$OutputDirectory = [System.IO.Path]::GetTempPath())

$ErrorActionPreference = 'Stop'
$companyId = [guid]::NewGuid().ToString('D')
$documentId = [guid]::NewGuid().ToString('D')
$attachmentId = [guid]::NewGuid().ToString('D')
$objectKey = "private/$companyId/$documentId/$attachmentId"
$localPath = Join-Path $OutputDirectory $attachmentId
$content = "ZAPING-R2-QA-SYNTHETIC-ONLY`n$([guid]::NewGuid().ToString('D'))`n"
[System.IO.File]::WriteAllBytes($localPath, [System.Text.Encoding]::UTF8.GetBytes($content))

Write-Output 'R2 QA synthetic object created. NOT a medical or fiscal document.'
Write-Output "Local upload file: $localPath"
Write-Output "R2 QA object key: $objectKey"
Write-Output "R2_QA_FIXTURE_COMPANY_ID=$companyId"
Write-Output "R2_QA_FIXTURE_OBJECT_KEY=$objectKey"
Write-Output "R2_QA_FIXTURE_SHA256=$((Get-FileHash -LiteralPath $localPath -Algorithm SHA256).Hash.ToLowerInvariant())"
Write-Output "R2_QA_FIXTURE_SIZE_BYTES=$((Get-Item -LiteralPath $localPath).Length)"
Write-Output 'Set R2_QA_FIXTURE_* values in the local smoke-test shell; do not commit them.'
Write-Output 'Remove QA synthetic data according to the approved retention policy.'
