@echo off
chcp 65001 > nul
:: รัน scraper ด้วย PowerShell เพื่อแสดงผลบนหน้าจอและบันทึก log พร้อมกัน
powershell -ExecutionPolicy Bypass -File "%~dp0run-scraper.ps1"
pause
