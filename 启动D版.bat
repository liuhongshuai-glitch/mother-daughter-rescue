@echo off
cd /d "%~dp0"
start "" http://localhost:8001/
python .tools\serve.py 8001
