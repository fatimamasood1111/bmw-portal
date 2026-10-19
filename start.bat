@echo off
rem Starts the Verde Motors portal on http://localhost:8080 (needs Python + Ollama running with qwen2.5:3b)
cd /d "%~dp0"
start "" http://localhost:8080
python server.py
