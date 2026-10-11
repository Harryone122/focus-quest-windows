# Reset the installed Focus Quest profile for a fresh playthrough.
# The previous profile is moved intact to a dated backup beside the live profile.
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$appData = [IO.Path]::GetFullPath([Environment]::GetFolderPath('ApplicationData')).TrimEnd('\')
$profile = [IO.Path]::GetFullPath((Join-Path $appData 'focus-quest-windows')).TrimEnd('\')
$backupRoot = [IO.Path]::GetFullPath((Join-Path $appData 'focus-quest-windows-backups')).TrimEnd('\')
$installedExe = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs\Focus Quest\Focus Quest.exe'))
if ($profile -ne (Join-Path $appData 'focus-quest-windows') -or
    $backupRoot -ne (Join-Path $appData 'focus-quest-windows-backups') -or
    -not (Test-Path -LiteralPath $installedExe -PathType Leaf)) {
  throw '找不到預期的 Focus Quest 安裝或資料路徑。'
}
if ($CheckOnly) { Write-Output "profile=$profile`nbackupRoot=$backupRoot`ninstalledExe=$installedExe"; exit 0 }

$answer = [System.Windows.Forms.MessageBox]::Show(
  '這會關閉 Focus Quest，備份目前所有本機資料，然後從全新進度啟動。要繼續嗎？',
  'Focus Quest 從頭測試',
  [System.Windows.Forms.MessageBoxButtons]::YesNo,
  [System.Windows.Forms.MessageBoxIcon]::Question)
if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { exit 0 }

try {
  $running = @(Get-CimInstance Win32_Process -Filter "name = 'Focus Quest.exe'" |
    Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -ieq $installedExe })
  foreach ($process in $running | Where-Object { $_.CommandLine -notmatch ' --type=' }) {
    $main = Get-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
    if ($main) { [void]$main.CloseMainWindow() }
  }
  Start-Sleep -Seconds 3
  $remaining = @(Get-CimInstance Win32_Process -Filter "name = 'Focus Quest.exe'" |
    Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -ieq $installedExe })
  foreach ($process in $remaining) { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
  if (Get-CimInstance Win32_Process -Filter "name = 'Focus Quest.exe'" |
      Where-Object { $_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -ieq $installedExe }) {
    throw '遊戲仍在執行，資料沒有移動。'
  }

  $backup = $null
  if (Test-Path -LiteralPath $profile -PathType Container) {
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backup = [IO.Path]::GetFullPath((Join-Path $backupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 6))))
    if (-not $backup.StartsWith($backupRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
        (Test-Path -LiteralPath $backup)) { throw '備份路徑檢查失敗。' }
    Move-Item -LiteralPath $profile -Destination $backup
    if (Test-Path -LiteralPath $profile) { throw '舊資料仍在使用，重設未完成。' }
  }

  $launched = Start-Process -FilePath $installedExe -PassThru
  Start-Sleep -Seconds 4
  $secondary = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
  $window = Get-Process -Id $launched.Id -ErrorAction SilentlyContinue
  if ($secondary -and $window -and $window.MainWindowHandle -ne [IntPtr]::Zero) {
    Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class FocusQuestResetWindow { [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags); }'
    $area = $secondary.WorkingArea
    [void][FocusQuestResetWindow]::SetWindowPos($window.MainWindowHandle, [IntPtr]::Zero,
      $area.X + 20, $area.Y + 20, [Math]::Min(1400, $area.Width - 40), [Math]::Min(900, $area.Height - 40), 0x0040)
  }
  $message = if ($backup) { "已從全新進度啟動。`n原進度備份：$backup" } else { '已從全新進度啟動；原本沒有本機資料。' }
  [void][System.Windows.Forms.MessageBox]::Show($message, 'Focus Quest 從頭測試',
    [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
} catch {
  [void][System.Windows.Forms.MessageBox]::Show("重設失敗；原資料不會刪除。`n$($_.Exception.Message)",
    'Focus Quest 從頭測試', [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Error)
  exit 1
}
