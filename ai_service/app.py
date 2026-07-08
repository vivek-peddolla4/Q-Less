from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import os

app = Flask(__name__)
CORS(app)

# Mocked AI logic for symptom analysis
# In a real scenario, this would load a trained model (e.g., Scikit-learn)
def analyze_symptom(symptom_text):
    symptom_text = symptom_text.lower()
    
    if any(word in symptom_text for word in ["heart", "chest", "pain", "blood pressure"]):
        return {"department": "Cardiology", "urgency": "High"}
    elif any(word in symptom_text for word in ["bone", "fracture", "joint", "back"]):
        return {"department": "Orthopedics", "urgency": "Medium"}
    elif any(word in symptom_text for word in ["headache", "fever", "cold", "cough"]):
        return {"department": "General Medicine", "urgency": "Low"}
    elif any(word in symptom_text for word in ["eye", "vision", "blur"]):
        return {"department": "Ophthalmology", "urgency": "Low"}
    elif any(word in symptom_text for word in ["stomach", "vomit", "ulcer"]):
        return {"department": "Gastroenterology", "urgency": "Medium"}
    elif any(word in symptom_text for word in ["accident", "bleeding", "unconscious", "stroke", "breathe", "choking", "breath"]):
        return {"department": "Emergency", "urgency": "Emergency"}
    else:
        # Default analysis
        departments = ["General Medicine", "Consultation"]
        urgencies = ["Low", "Medium"]
        return {"department": random.choice(departments), "urgency": random.choice(urgencies)}

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for Docker/load balancer liveness probes."""
    return {"status": "ok", "service": "ai-service"}, 200

@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if not data or 'symptoms' not in data:
        return jsonify({"error": "No symptoms provided"}), 400
    
    symptoms = data.get('symptoms', '')
    if not symptoms or not symptoms.strip():
        return jsonify({"error": "Symptoms cannot be empty"}), 400

    prediction = analyze_symptom(symptoms)
    
    return jsonify(prediction)

if __name__ == '__main__':
    # debug=False is critical for production security.
    # The interactive debugger exposes a remote code execution console.
    # Gunicorn (used in Docker) ignores this block entirely.
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
