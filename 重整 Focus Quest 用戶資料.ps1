$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$profilePath = Join-Path $env:APPDATA 'focus-quest-windows'
if (-not (Test-Path -LiteralPath $profilePath -PathType Container)) {
  [System.Windows.Forms.MessageBox]::Show('找不到 Focus Quest 的用戶資料夾，沒有任何資料被變更。', 'Focus Quest 用戶資料', 'OK', 'Information') | Out-Null
  exit 0
}

$profilePath = (Resolve-Path -LiteralPath $profilePath).Path
$expectedPath = [System.IO.Path]::GetFullPath((Join-Path $env:APPDATA 'focus-quest-windows')).TrimEnd('\')
if (-not $profilePath.Equals($expectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "用戶資料夾位置不符預期，停止操作：$profilePath"
}

$runningApps = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and
  [System.IO.Path]::GetFileName($_.ExecutablePath) -ieq 'Focus Quest.exe' -and
  $_.CommandLine -notmatch '--type='
})
if ($runningApps.Count -gt 0) {
  [System.Windows.Forms.MessageBox]::Show('請先從系統列的 Focus Quest 選單選「離開」，再重新執行這個捷徑。', '請先關閉 Focus Quest', 'OK', 'Information') | Out-Null
  exit 0
}

$databaseFiles = @(Get-ChildItem -LiteralPath $profilePath -File | Where-Object { $_.Name -in @('focusquest.db', 'focusquest.db-wal', 'focusquest.db-shm') })
$saveBackups = @(Get-ChildItem -LiteralPath $profilePath -Directory | Where-Object { $_.Name -match '^backup-before-[0-9.]+-\d{8}-\d{6}$' })
$targets = @($databaseFiles) + @($saveBackups)
if ($targets.Count -eq 0) {
  [System.Windows.Forms.MessageBox]::Show('目前沒有遊戲存檔或存檔備份，用戶資料已是空白。', 'Focus Quest 用戶資料', 'OK', 'Information') | Out-Null
  exit 0
}

$backupBytes = ($saveBackups | ForEach-Object { (Get-ChildItem -LiteralPath $_.FullName -File -Recurse | Measure-Object -Property Length -Sum).Sum } | Measure-Object -Sum).Sum
$dbBytes = ($databaseFiles | Measure-Object -Property Length -Sum).Sum
$totalBytes = [long]($backupBytes + $dbBytes)
$sizeText = '{0:N1} MB' -f ($totalBytes / 1MB)
$message = "這會清除 Focus Quest 的本機帳戶資料，包括任務、專注紀錄、遊戲進度、設定及 $($saveBackups.Count) 份存檔備份（共約 $sizeText）。`n`n安裝程式、專案、美術素材與快取會保留。清除後無法復原。`n`n要重整成全新帳戶嗎？"
$answer = [System.Windows.Forms.MessageBox]::Show(
  $message,
  '確認重整 Focus Quest 用戶資料',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Warning,
  [System.Windows.Forms.MessageBoxDefaultButton]::Button2
)
if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }

$profilePrefix = $profilePath.TrimEnd('\') + '\'
foreach ($target in $targets) {
  $resolvedTarget = (Resolve-Path -LiteralPath $target.FullName).Path
  if (-not $resolvedTarget.StartsWith($profilePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "目標超出 Focus Quest 用戶資料夾，停止操作：$resolvedTarget"
  }
}

foreach ($file in $databaseFiles) { Remove-Item -LiteralPath $file.FullName -Force }
foreach ($folder in $saveBackups) { Remove-Item -LiteralPath $folder.FullName -Recurse -Force }

$remaining = @(Get-ChildItem -LiteralPath $profilePath -Force | Where-Object {
  $_.Name -in @('focusquest.db', 'focusquest.db-wal', 'focusquest.db-shm') -or
  ($_.PSIsContainer -and $_.Name -match '^backup-before-[0-9.]+-\d{8}-\d{6}$')
})
if ($remaining.Count -gt 0) { throw '部分存檔仍存在，請檢查 Focus Quest 用戶資料資料夾。' }

[System.Windows.Forms.MessageBox]::Show('已重整完成。下次開啟 Focus Quest 時會建立全新的本機帳戶。', 'Focus Quest 用戶資料已重整', 'OK', 'Information') | Out-Null
