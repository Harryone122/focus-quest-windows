param(
    [string]$Topic = '',
    [string]$IndexPath = (Join-Path $PSScriptRoot '../../../../docs/COLLABORATION_STATUS.md')
)
$ErrorActionPreference = 'Stop'
function Short-Cell([string]$Value, [int]$Limit) {
    $Value = ($Value -replace '\s+', ' ').Trim()
    if ($Value.Length -le $Limit) { return $Value }
    return $Value.Substring(0, $Limit) + '…（詳見來源）'
}
$rows = @()
foreach ($line in Get-Content -LiteralPath $IndexPath -Encoding UTF8) {
    if (-not $line.StartsWith('|')) { continue }
    $cells = @($line.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
    if ($cells.Count -ne 4 -or $cells[0] -eq '工作' -or $cells[0] -match '^:?-+:?$') { continue }
    if ($Topic -and $cells[0].IndexOf($Topic, [StringComparison]::OrdinalIgnoreCase) -lt 0) { continue }
    $rows += ,$cells
}
if ($rows.Count -eq 0) {
    Write-Output '沒有匹配工作。請用地圖名稱／編號重查，或搜尋 COLLABORATION_STATUS.md；這不表示沒有待辦。'
    exit 0
}
Write-Output '精簡索引（長欄已省略；批准範圍與完整狀態須讀來源交接）'
foreach ($row in $rows) {
    Write-Output ('工作：' + $row[0])
    Write-Output ('狀態：' + (Short-Cell $row[1] 100))
    Write-Output ('下一位／動作：' + (Short-Cell $row[2] 140))
    Write-Output ('來源：' + $row[3])
    Write-Output ''
}
