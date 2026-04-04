# ShiftShield ML Service

Run everything from this directory.

Setup:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Windows / PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Tests:

```bash
.venv/bin/python -m unittest discover -s tests -p 'test*.py'
```

Windows / PowerShell:

```powershell
.\.venv\Scripts\python -m unittest discover -s tests -p "test*.py"
```

This works reliably because it uses the local virtualenv that contains `fastapi`, `xgboost`, and the other ML service dependencies, and it uses explicit `unittest` discovery against the [`tests`](/home/arnavbansal/Guidewire/ml-service/tests) directory.

Run locally:

```bash
uvicorn main:app --host 0.0.0.0 --port 8001
```

Windows / PowerShell:

```powershell
uvicorn main:app --host 0.0.0.0 --port 8001
```
