# FinTrack MultiAgent

FinTrack is organized as three separate application areas:

- `backend/` contains the Node.js/Express API, MongoDB models, services, and backend package manifest.
- `frontend/` contains the Vite/React application and frontend package manifest.
- `agent/` contains the Python multi-agent runtime, tools, and evaluation scenarios.

## Backend

From the `backend/` directory, configure the variables in `.env` using `.env.example`, then run:

```powershell
npm install
npm start
```

The development server uses the configured `PORT` value, defaulting to port 5000 when it is not set.

## Frontend

From the `frontend/` directory, configure the variables in `.env` using `.env.example`, then run:

```powershell
npm install
npm run dev
```

To create a production build:

```powershell
npm run build
```

The frontend uses `VITE_API_BASE_URL` when provided. Otherwise, its API client uses the same-origin `/api` path.

## Agent

From the `agent/` directory, set `FINTRACK_AGENT_USER_TOKEN` to a valid authenticated FinTrack user JWT in the process environment. Run the evaluator with:

```powershell
python evaluation\test_runner.py
```

The evaluator runs the JSON scenarios in `evaluation/scenarios/` for anomaly detection, budget generation, and savings planning.
