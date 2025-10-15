@echo off
echo Killing processes on ports 3000 and 5173...

for %%p in (3000 5173) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p') do (
        echo Terminating PID %%a on port %%p
        taskkill /PID %%a /F >nul 2>&1
    )
)

echo Done.
pause
