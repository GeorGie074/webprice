# ─── PriceCompare Local Scraper ──────────────────────────────────────────────
$BackendDir = "D:\webprice-new\backend"
$LogFile    = "D:\webprice-new\scraper-log.txt"

function Log($msg) {
    Write-Host $msg
    Add-Content -Path $LogFile -Value $msg -Encoding UTF8
}

$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Log ""
Log ("=" * 60)
Log "  PriceCompare Local Scraper"
Log "  Started: $ts"
Log ("=" * 60)
Log ""

Set-Location $BackendDir

# npx บน Windows ต้องรันผ่าน cmd /c
cmd /c "npx tsx src/scripts/runScraper.ts 2>&1" | ForEach-Object {
    Write-Host $_
    Add-Content -Path $LogFile -Value $_ -Encoding UTF8
}

$ts2 = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Log ""
Log ("=" * 60)
Log "  Finished: $ts2"
Log "  Log: $LogFile"
Log ("=" * 60)
