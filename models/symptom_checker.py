"""
Symptom Checker module for Health Companion app
"""

def predict_disease(selected_symptoms):
    """
    Predict possible diseases based on selected symptoms.
    This is a placeholder function - in a real application,
    this would use a trained ML model.
    """
    # Sample disease prediction logic - replace with actual ML model in production
    symptom_disease_map = {
        'Fever': ['Common Cold', 'Flu', 'COVID-19'],
        'Cough': ['Common Cold', 'Flu', 'COVID-19', 'Bronchitis'],
        'Fatigue': ['Flu', 'COVID-19', 'Anemia', 'Depression'],
        'Difficulty Breathing': ['COVID-19', 'Asthma', 'Pneumonia'],
        'Headache': ['Migraine', 'Tension Headache', 'Sinusitis'],
        'Sore Throat': ['Common Cold', 'Strep Throat', 'Tonsillitis'],
        'Body Aches': ['Flu', 'COVID-19', 'Fibromyalgia'],
        'Runny Nose': ['Common Cold', 'Allergies', 'Sinusitis'],
        'Nausea': ['Food Poisoning', 'Migraine', 'Gastroenteritis'],
        'Diarrhea': ['Food Poisoning', 'Gastroenteritis', 'IBS'],
        'Chest Pain': ['Heart Attack', 'Angina', 'Acid Reflux'],
        'Abdominal Pain': ['Appendicitis', 'Gastritis', 'IBS'],
        'Dizziness': ['Low Blood Pressure', 'Anemia', 'Vertigo'],
        'Rash': ['Allergic Reaction', 'Eczema', 'Psoriasis'],
        'Loss of Taste/Smell': ['COVID-19', 'Common Cold', 'Sinusitis'],
        'Joint Pain': ['Arthritis', 'Gout', 'Lupus'],
        'Swelling': ['Injury', 'Infection', 'Allergic Reaction'],
        'Chills': ['Flu', 'COVID-19', 'Infection'],
        'Vomiting': ['Food Poisoning', 'Gastroenteritis', 'Migraine'],
        'Confusion': ['Stroke', 'UTI (in elderly)', 'Medication Side Effect']
    }
    
    # Collect all possible diseases based on symptoms
    possible_diseases = []
    for symptom in selected_symptoms:
        if symptom in symptom_disease_map:
            possible_diseases.extend(symptom_disease_map[symptom])
            
    # Count occurrences of each disease
    disease_counts = {}
    for disease in possible_diseases:
        if disease in disease_counts:
            disease_counts[disease] += 1
        else:
            disease_counts[disease] = 1
            
    # Sort by count (most likely first)
    sorted_diseases = sorted(disease_counts.items(), key=lambda x: x[1], reverse=True)
    
    if not sorted_diseases:
        return "Unable to determine from given symptoms", 0
        
    # Return the top disease and a simple confidence metric
    top_disease = sorted_diseases[0][0]
    confidence = min(100, (sorted_diseases[0][1] / len(selected_symptoms)) * 100)
    
    return top_disease, round(confidence, 1)

def get_common_symptoms():
    """
    Return a list of common symptoms for the checker interface
    """
    return [
        'Fever', 'Cough', 'Fatigue', 'Difficulty Breathing', 'Headache',
        'Sore Throat', 'Body Aches', 'Runny Nose', 'Nausea', 'Diarrhea',
        'Chest Pain', 'Abdominal Pain', 'Dizziness', 'Rash', 'Loss of Taste/Smell',
        'Joint Pain', 'Swelling', 'Chills', 'Vomiting', 'Confusion'
    ]

def get_recommendations(disease):
    """
    Get general recommendations based on the predicted disease
    """
    recommendations = {
        'Common Cold': [
            "Rest and get plenty of sleep",
            "Stay hydrated with water, tea, and soup",
            "Use over-the-counter cold medications as directed",
            "Consider saline nasal sprays for congestion"
        ],
        'Flu': [
            "Rest and avoid contact with others",
            "Drink plenty of fluids",
            "Take acetaminophen or ibuprofen for fever and aches",
            "Consult a doctor about antiviral medications if within 48 hours of symptoms"
        ],
        'COVID-19': [
            "Isolate from others immediately",
            "Get tested as soon as possible",
            "Monitor your oxygen levels if possible",
            "Contact a healthcare provider for guidance"
        ],
        'Migraine': [
            "Rest in a quiet, dark room",
            "Apply cold or warm compresses to your head",
            "Try over-the-counter pain relievers",
            "Stay hydrated and consider tracking triggers"
        ],
        'Food Poisoning': [
            "Stay hydrated with small sips of water or electrolyte solutions",
            "Avoid solid foods until vomiting subsides",
            "Gradually reintroduce bland foods like toast or bananas",
            "Seek medical attention if symptoms are severe or persistent"
        ]
    }
    
    # Default recommendations if the disease isn't in our dictionary
    default_recommendations = [
        "Rest and monitor your symptoms",
        "Stay hydrated",
        "Consult with a healthcare provider for proper diagnosis",
        "Take over-the-counter medications as appropriate for symptom relief"
    ]
    
    return recommendations.get(disease, default_recommendations)