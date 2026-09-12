# Hourly Bike Rental Demand Predictor

A small AI-enabled application that predicts hourly bike rental demand using a
trained machine learning model, and generates a plain-language explanation
and operational recommendation using a local Large Language Model (LLM).

This project extends the Module 3 bike-demand model by combining it with a
local LLM (via Ollama) to produce a user-facing dashboard.

```
User Input → ML Prediction → Local LLM → Explanation / Recommendation
```

---

## What This Application Does

Given a date, time, temperature, and holiday status, the application:

1. **Predicts hourly bike rental demand** using a Gradient Boosting model
   trained on the Seoul Bike Sharing Demand dataset.
2. **Generates a short explanation and recommendation** using a local LLM
   (`llama3.2:1b` via Ollama), based on the predicted demand and the input
   conditions.

The LLM complements the prediction — it does not calculate or override the
predicted demand, it only interprets it in plain language.

To keep the interface simple, the user only provides four inputs (date,
time, temperature, and holiday status). All other weather-related features
the model was trained on (humidity, wind speed, visibility, solar
radiation, rainfall, snowfall) are filled in with fixed, reasonable
defaults, since a typical user would not know these values. The
bike-share system is always assumed to be operating.

---

## Project Structure

```
4-bike-demand-app/
├── README.md
├── PROMPT.md               # AI-assisted development prompts and decisions
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── startup.py               # Waits for Ollama, pulls the model on first run
├── models/
│   └── bike_demand_model.joblib
├── src/
│   ├── predict.py            # ML prediction logic
│   └── llm_service.py        # Local LLM interaction logic
└── app.py                    # Streamlit UI
```

- **`app.py`** — Streamlit user interface. Collects input, displays the
  prediction and AI explanation, and handles validation/failure messages.
  Contains no prediction or LLM logic itself.
- **`src/predict.py`** — Loads the trained model and derives all 19
  features the model expects from the four user-facing inputs. Clips
  negative predictions to zero and returns an integer bike count.
- **`src/llm_service.py`** — Sends a prompt to the local Ollama service and
  returns its response. Raises a clear `LLMServiceError` on connection
  failure, timeout, or bad response, rather than crashing the application.
- **`models/bike_demand_model.joblib`** — The trained Gradient Boosting
  model, produced by following an 11-stage AI-assisted ML lifecycle in
  Google Colab (see `PROMPT.md` for details).

---

## Prerequisites

- Docker Desktop
- Python 3.12+ (only needed if running components outside Docker)

You do not need to install Python packages directly — Docker Compose builds
and runs everything, including the local LLM.

---

## How to Install Required Python Packages

If you want to run the application outside Docker (for local development or
debugging), install dependencies into a virtual environment:

```bash
python3 -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Note: `scikit-learn` is pinned to `1.6.1` in `requirements.txt`, matching
the version used to train the model. A different scikit-learn version may
fail to load the saved model file correctly.

---

## How to Start the Local LLM Environment

The local LLM (Ollama) is started automatically as part of Docker Compose
— no separate setup step is required. On first run, the `llama3.2:1b`
model is pulled automatically before the application starts (this can take
a few minutes the first time; subsequent runs reuse the downloaded model).

If you want to run Ollama independently for testing:

```bash
docker compose up ollama
```

---

## How to Run the Application

From the project directory:

```bash
docker compose up --build
```

This starts two containers:

- `bike-demand-ollama` — the local LLM service (port `11434`)
- `bike-demand-app` — the Streamlit application (port `8501`)

Once both services are running, open:

```
http://localhost:8501
```

To stop the application:

```bash
docker compose down
```

---

## What LLM-Enabled Capability Was Added

The local LLM adds a **plain-language explanation and short operational
recommendation** based on the predicted bike demand and the input
conditions (e.g., "Demand is expected to be high given the warm evening
temperature; consider preparing extra bikes at high-traffic stations.").
The LLM does not perform or influence the numeric prediction itself — that
responsibility belongs entirely to the trained machine learning model.

---

## Known Limitations

- **Response length is capped** (`num_predict` on the Ollama request) to
  keep response times predictable on CPU-only hardware. As a result, the
  AI explanation occasionally ends mid-sentence rather than being
  artificially shortened by the model itself.
- **Weather inputs beyond temperature use fixed defaults**, not live or
  user-provided values, so predictions reflect "typical" conditions for
  factors like humidity and wind speed rather than the actual forecast.
- **The underlying model tends to under-predict very high-demand hours**,
  a pattern observed during evaluation in `PROMPT.md`. The AI explanation
  should be read as a general guide, not a precise operational guarantee.
