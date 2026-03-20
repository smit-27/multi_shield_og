"""
MultiShield ML Risk Scoring Microservice

FastAPI service that loads pre-trained ML models and provides
login behavior risk scoring via a /predict endpoint.

Expected features (9):
  avg_login_hour, num_devices, file_access_count, usb_activity,
  email_count, late_login, multi_device, large_file_activity, high_usb_usage
"""
import os
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="MultiShield ML Risk Service", version="1.0.0")

# ─── Model Loading ───────────────────────────────────────────────────────────

MODEL_DIR = os.environ.get("MODEL_DIR", "/app/models")

FEATURE_NAMES = [
    "avg_login_hour",
    "num_devices",
    "file_access_count",
    "usb_activity",
    "email_count",
    "late_login",
    "multi_device",
    "large_file_activity",
    "high_usb_usage"
]

# Load models at startup
ensemble_model = None
scaler = None

def load_models():
    global ensemble_model, scaler
    
    ensemble_path = os.path.join(MODEL_DIR, "ensemble_risk_model.pkl")
    scaler_path = os.path.join(MODEL_DIR, "feature_scaler.pkl")
    
    if os.path.exists(ensemble_path):
        ensemble_model = joblib.load(ensemble_path)
        print(f"[ML Service] Loaded ensemble model from {ensemble_path}")
    else:
        print(f"[ML Service] WARNING: Ensemble model not found at {ensemble_path}")
    
    if os.path.exists(scaler_path):
        scaler = joblib.load(scaler_path)
        print(f"[ML Service] Loaded feature scaler from {scaler_path}")
    else:
        print(f"[ML Service] WARNING: Feature scaler not found at {scaler_path}")

load_models()

# ─── Request / Response Models ───────────────────────────────────────────────

class PredictRequest(BaseModel):
    avg_login_hour: float = 12.0
    num_devices: float = 1.0
    file_access_count: float = 3.0
    usb_activity: float = 1.0
    email_count: float = 5.0
    late_login: float = 0.0
    multi_device: float = 0.0
    large_file_activity: float = 0.0
    high_usb_usage: float = 0.0

class PredictResponse(BaseModel):
    risk_score: float
    risk_label: str
    explanation: List[str]
    top_features: List[str]

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ml-risk-service",
        "model_loaded": ensemble_model is not None,
        "scaler_loaded": scaler is not None
    }

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    """
    Predict login behavior risk score from 9 behavioral features.
    Returns score 0-100 and explanations.
    """
    # Build feature vector in correct order
    features = np.array([[
        req.avg_login_hour,
        req.num_devices,
        req.file_access_count,
        req.usb_activity,
        req.email_count,
        req.late_login,
        req.multi_device,
        req.large_file_activity,
        req.high_usb_usage
    ]])

    if ensemble_model is not None:
        try:
            # Scale features if scaler is available
            if scaler is not None:
                features_scaled = scaler.transform(features)
            else:
                features_scaled = features

            # Get prediction (probability of being high-risk)
            if hasattr(ensemble_model, 'predict_proba'):
                proba = ensemble_model.predict_proba(features_scaled)
                # Use the probability of the positive (risky) class
                risk_score = float(proba[0][1]) * 100 if proba.shape[1] > 1 else float(proba[0][0]) * 100
            else:
                prediction = ensemble_model.predict(features_scaled)
                risk_score = float(prediction[0]) * 100

            risk_score = max(0, min(100, round(risk_score, 1)))
        except Exception as e:
            print(f"[ML Service] Prediction error: {e}")
            risk_score = _heuristic_score(req)
    else:
        # Fallback: heuristic scoring when no model is loaded
        risk_score = _heuristic_score(req)

    # Generate explanations
    explanation, top_features = _generate_explanation(req, risk_score)
    risk_label = _get_risk_label(risk_score)

    return PredictResponse(
        risk_score=risk_score,
        risk_label=risk_label,
        explanation=explanation,
        top_features=top_features
    )

# ─── Helpers ─────────────────────────────────────────────────────────────────

def _heuristic_score(req: PredictRequest) -> float:
    """Fallback heuristic scoring when ML model is unavailable."""
    score = 10  # base

    if req.late_login == 1:
        score += 25
    if req.multi_device == 1:
        score += 15
    if req.high_usb_usage == 1:
        score += 20
    if req.large_file_activity == 1:
        score += 15
    if req.num_devices > 2:
        score += 10
    if req.file_access_count > 10:
        score += 10
    if req.usb_activity > 5:
        score += 10
    if req.avg_login_hour < 6 or req.avg_login_hour > 22:
        score += 15

    return min(100, score)

def _generate_explanation(req: PredictRequest, risk_score: float):
    """Generate human-readable explanations for the risk factors."""
    explanations = []
    top_features = []

    if req.late_login == 1:
        explanations.append(f"Late login detected (hour: {req.avg_login_hour})")
        top_features.append("late_login")

    if req.multi_device == 1:
        explanations.append(f"Multiple devices used ({req.num_devices} devices)")
        top_features.append("multi_device")

    if req.high_usb_usage == 1:
        explanations.append("High USB activity detected")
        top_features.append("high_usb_usage")

    if req.large_file_activity == 1:
        explanations.append("Large file transfers detected")
        top_features.append("large_file_activity")

    if req.file_access_count > 10:
        explanations.append(f"Elevated file access count ({req.file_access_count})")
        top_features.append("file_access_count")

    if req.usb_activity > 5:
        explanations.append(f"Elevated USB activity level ({req.usb_activity})")
        top_features.append("usb_activity")
    
    if req.avg_login_hour < 6 or req.avg_login_hour > 22:
        explanations.append(f"Unusual login hour ({req.avg_login_hour}:00)")
        top_features.append("avg_login_hour")

    if not explanations:
        explanations.append("Normal behavioral pattern detected")

    return explanations, top_features

def _get_risk_label(score: float) -> str:
    if score >= 80:
        return "CRITICAL"
    elif score >= 60:
        return "HIGH"
    elif score >= 40:
        return "MEDIUM"
    elif score >= 20:
        return "LOW"
    return "MINIMAL"
