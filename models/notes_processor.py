"""
Enhanced Notes Processor module with audio transcription
"""
import json
import re
import os
import speech_recognition as sr
from pydub import AudioSegment
import tempfile
from datetime import datetime

def extract_medical_info(text, ai_model=None):
    """
    Extract comprehensive medical information from notes text
    
    Args:
        text (str): The medical note text to process
        ai_model: Optional AI model for advanced extraction (e.g., Gemini)
        
    Returns:
        dict: Structured medical information
    """
    # If AI model is provided, use it for advanced extraction
    if ai_model:
        try:
            return extract_with_ai(text, ai_model)
        except Exception as e:
            print(f"Error with AI extraction: {str(e)}")
            # Fall back to basic extraction
    
    # Basic extraction using regex patterns
    return basic_extraction(text)

def extract_with_ai(text, model):
    """
    Use AI model to extract structured medical information
    
    Args:
        text (str): The text to analyze
        model: AI model instance (e.g., Gemini)
        
    Returns:
        dict: Structured medical information
    """
    try:
        # Structure the prompt for better extraction
        prompt = f"""Extract the following medical information from the given medical note in a structured JSON format:

        1. Patient Details (name, age, gender, marital status, residence)
        2. Chief Complaints (primary symptoms and duration)
        3. Chief Complaint Details (location in body, severity on scale 1-10)
        4. Past History (previous illnesses, surgeries)
        5. Chronic Diseases (diabetes, hypertension, etc.)
        6. Lifestyle (smoking, alcohol, recreational drugs with frequency)
        7. Drug History (current medications)
        8. Family History (conditions in family members)
        9. Allergies (especially medication allergies)
        10. Symptoms (all mentioned symptoms)
        11. Possible Diseases (based on mentioned symptoms)
        
        Instructions:
        - Extract only if clearly mentioned
        - Be concise but thorough
        - If no information found for a field, keep it as an empty list or null
        - Prioritize medical relevance
        - For allergies, be especially thorough - this is critical patient safety information

        Medical Note: "{text}"

        Output Format JSON:
        {{
            "patient_details": {{
                "name": "string or null",
                "age": "string or null",
                "gender": "string or null",
                "marital_status": "string or null",
                "residence": "string or null"
            }},
            "chief_complaints": ["complaint with duration", ...],
            "chief_complaint_details": [
                {{
                    "complaint": "string",
                    "location": "string or null",
                    "severity": "string or null", 
                    "duration": "string or null"
                }},
                ...
            ],
            "past_history": ["previous illness/surgery", ...],
            "chronic_diseases": ["disease", ...],
            "lifestyle": [
                {{
                    "habit": "string",
                    "frequency": "string or null",
                    "duration": "string or null"
                }},
                ...
            ],
            "drug_history": ["medication", ...],
            "family_history": ["condition with relation", ...],
            "allergies": ["allergy", ...],
            "symptoms": ["symptom", ...],
            "possible_diseases": ["disease", ...]
        }}
        """
        
        # Generate response from AI model
        response = model.generate_content(prompt)
        
        # Clean up response
        response_text = response.text.replace('```json', '').replace('```', '').strip()
        
        # Parse JSON response
        try:
            extracted_info = json.loads(response_text)
            return clean_extracted_info(extracted_info)
        except json.JSONDecodeError:
            # Fall back to basic extraction if JSON is malformed
            print("Failed to parse AI response as JSON. Falling back to basic extraction.")
            return basic_extraction(text)
            
    except Exception as e:
        print(f"Error in AI extraction: {str(e)}")
        return basic_extraction(text)

def basic_extraction(text):
    """
    Basic extraction using regex patterns for comprehensive medical information
    
    Args:
        text (str): The text to analyze
        
    Returns:
        dict: Structured medical information
    """
    # Initialize the structure with all required fields
    extracted_info = {
        "patient_details": {
            "name": None,
            "age": None,
            "gender": None,
            "marital_status": None,
            "residence": None
        },
        "chief_complaints": [],
        "chief_complaint_details": [],
        "past_history": [],
        "chronic_diseases": [],
        "lifestyle": [],
        "drug_history": [],
        "family_history": [],
        "allergies": [],
        "symptoms": [],
        "possible_diseases": []
    }
    
    # Extract patient details
    # Name extraction
    name_patterns = [
        r'(?:patient|name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})',
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})[,\s]+(?:aged?|a)\s+\d+'
    ]
    
    for pattern in name_patterns:
        name_match = re.search(pattern, text, re.IGNORECASE)
        if name_match:
            extracted_info["patient_details"]["name"] = name_match.group(1)
            break
    
    # Age and gender extraction
    age_match = re.search(r'\b(\d{1,3})[\s-]*(years?|yrs?|y\.o\.?|year old)\b', text, re.IGNORECASE)
    if age_match:
        extracted_info["patient_details"]["age"] = age_match.group(1) + " years"
    
    # Gender extraction
    gender_patterns = [
        r'\b(male|female|m/f|f/m|m|f)\b',
        r'\b(man|woman|boy|girl)\b'
    ]
    
    for pattern in gender_patterns:
        gender_match = re.search(pattern, text, re.IGNORECASE)
        if gender_match:
            gender = gender_match.group(1).lower()
            if gender in ['m', 'male', 'man', 'boy']:
                extracted_info["patient_details"]["gender"] = "Male"
            elif gender in ['f', 'female', 'woman', 'girl']:
                extracted_info["patient_details"]["gender"] = "Female"
            break
    
    # Marital status
    marital_patterns = [
        r'\b(single|married|divorced|widowed|separated)\b'
    ]
    
    for pattern in marital_patterns:
        marital_match = re.search(pattern, text, re.IGNORECASE)
        if marital_match:
            extracted_info["patient_details"]["marital_status"] = marital_match.group(1).capitalize()
            break
    
    # Residence
    residence_patterns = [
        r'residing in\s+([A-Za-z\s]+)',
        r'resident of\s+([A-Za-z\s]+)',
        r'lives in\s+([A-Za-z\s]+)',
        r'from\s+([A-Za-z\s]+)'
    ]
    
    for pattern in residence_patterns:
        residence_match = re.search(pattern, text, re.IGNORECASE)
        if residence_match:
            extracted_info["patient_details"]["residence"] = residence_match.group(1).strip()
            break
    
    # Extract chief complaints
    complaint_patterns = [
        r'(?:chief|main|primary)\s+complaints?[:\s]+([^.;]+)[.;]',
        r'complains of\s+([^.;]+)[.;]',
        r'presented with\s+([^.;]+)[.;]'
    ]
    
    for pattern in complaint_patterns:
        complaint_match = re.search(pattern, text, re.IGNORECASE)
        if complaint_match:
            complaints_text = complaint_match.group(1)
            complaints = re.split(r',\s*(?:and\s+)?|\s+and\s+', complaints_text)
            extracted_info["chief_complaints"] = [c.strip() for c in complaints if c.strip()]
            
            # Try to extract details for each complaint
            for complaint in extracted_info["chief_complaints"]:
                detail = {"complaint": complaint, "location": None, "severity": None, "duration": None}
                
                # Extract location
                location_match = re.search(r'(?:in|on|at)\s+(?:the\s+)?([a-z\s]+)', complaint, re.IGNORECASE)
                if location_match:
                    detail["location"] = location_match.group(1).strip()
                
                # Extract severity
                severity_match = re.search(r'(mild|moderate|severe|\d+/10)', text, re.IGNORECASE)
                if severity_match:
                    detail["severity"] = severity_match.group(1)
                
                # Extract duration
                duration_patterns = [
                    r'for\s+([^.;]+)',
                    r'(?:since|past|last)\s+([^.;]+)'
                ]
                
                for d_pattern in duration_patterns:
                    duration_match = re.search(d_pattern, complaint, re.IGNORECASE)
                    if duration_match:
                        detail["duration"] = duration_match.group(1).strip()
                        break
                
                extracted_info["chief_complaint_details"].append(detail)
            
            break
    
    # Extract past history
    past_history_section = re.search(r'(?:past|previous|medical)\s+history[:\s]+([^.]+)[.]', text, re.IGNORECASE)
    if past_history_section:
        history_text = past_history_section.group(1)
        histories = re.split(r',\s*(?:and\s+)?|\s+and\s+', history_text)
        extracted_info["past_history"] = [h.strip() for h in histories if h.strip()]
    
    # Look for surgeries specifically
    surgery_match = re.search(r'(?:history of|previous|underwent)\s+([^.;]+(?:surgery|operation|procedure))[.;]', text, re.IGNORECASE)
    if surgery_match:
        extracted_info["past_history"].append(surgery_match.group(1).strip())
    
    # Extract chronic diseases
    chronic_diseases = ["diabetes", "hypertension", "asthma", "copd", "arthritis", 
                        "cancer", "heart disease", "kidney disease", "liver disease"]
    
    for disease in chronic_diseases:
        if re.search(r'\b' + disease + r'\b', text, re.IGNORECASE):
            extracted_info["chronic_diseases"].append(disease.capitalize())
    
    # Extract lifestyle information
    lifestyle_habits = [
        {"term": "smok", "habit": "Smoking"},
        {"term": "alcohol", "habit": "Alcohol"},
        {"term": "drink", "habit": "Drinking"},
        {"term": "drug", "habit": "Recreational drugs"}
    ]
    
    for habit_info in lifestyle_habits:
        habit_match = re.search(r'\b' + habit_info["term"] + r'[a-z]*\b[^.;]*', text, re.IGNORECASE)
        if habit_match:
            habit_text = habit_match.group(0)
            detail = {"habit": habit_info["habit"], "frequency": None, "duration": None}
            
            # Try to extract frequency
            frequency_patterns = [
                r'(\d+)[^.;]*(?:times|per|a)\s+(?:day|week|month|year)',
                r'(?:daily|weekly|monthly|occasionally|rarely|frequently)'
            ]
            
            for f_pattern in frequency_patterns:
                frequency_match = re.search(f_pattern, habit_text, re.IGNORECASE)
                if frequency_match:
                    detail["frequency"] = frequency_match.group(0)
                    break
            
            # Try to extract duration
            duration_patterns = [
                r'for\s+([^.;]+)',
                r'(?:since|past|last)\s+([^.;]+)',
                r'(\d+)\s+(?:years|months)'
            ]
            
            for d_pattern in duration_patterns:
                duration_match = re.search(d_pattern, habit_text, re.IGNORECASE)
                if duration_match:
                    detail["duration"] = duration_match.group(0)
                    break
            
            extracted_info["lifestyle"].append(detail)
    
    # Extract drug history
    drug_history_section = re.search(r'(?:drug|medication|prescription)\s+history[:\s]+([^.]+)[.]', text, re.IGNORECASE)
    if drug_history_section:
        drug_text = drug_history_section.group(1)
        drugs = re.split(r',\s*(?:and\s+)?|\s+and\s+', drug_text)
        extracted_info["drug_history"] = [d.strip() for d in drugs if d.strip()]
    
    # Extract family history
    family_history_section = re.search(r'family\s+history[:\s]+([^.]+)[.]', text, re.IGNORECASE)
    if family_history_section:
        history_text = family_history_section.group(1)
        family_conditions = ["diabetes", "hypertension", "cancer", "heart disease", 
                           "asthma", "stroke", "alzheimer", "arthritis"]
        
        # Look for conditions with relations
        for condition in family_conditions:
            condition_pattern = r'\b' + condition + r'\b[^.;]*(?:(?:in|with)\s+(?:father|mother|brother|sister|parent|grandparent))?'
            condition_matches = re.finditer(condition_pattern, history_text, re.IGNORECASE)
            
            for match in condition_matches:
                extracted_info["family_history"].append(match.group(0).strip())
    
    # Extract allergies - highest priority
    allergy_section = re.search(r'(?:allerg(?:y|ies)|allergic)[:\s]+([^.]+)[.]', text, re.IGNORECASE)
    if allergy_section:
        allergy_text = allergy_section.group(1)
        allergies = re.split(r',\s*(?:and\s+)?|\s+and\s+', allergy_text)
        extracted_info["allergies"] = [a.strip() for a in allergies if a.strip()]
    
    # Extract symptoms - looking for common physical symptoms
    common_symptoms = [
        "fever", "headache", "fatigue", "cough", "nausea", "vomiting", 
        "dizziness", "pain", "rash", "sore throat", "shortness of breath",
        "chest pain", "back pain", "abdominal pain", "diarrhea", "weakness",
        "chills", "sweating", "itching", "loss of appetite", "swelling"
    ]
    
    for symptom in common_symptoms:
        if re.search(r'\b' + symptom + r'\b', text, re.IGNORECASE):
            extracted_info["symptoms"].append(symptom.title())
    
    # Extract possible diseases based on symptoms and mentioned conditions
    # This is a simplified approach - in reality, would use a medical knowledge base
    symptom_to_disease = {
        "fever": ["Common Cold", "Flu", "COVID-19", "Infection"],
        "headache": ["Migraine", "Tension Headache", "Sinus Infection"],
        "cough": ["Common Cold", "Bronchitis", "Asthma", "COVID-19"],
        "nausea": ["Food Poisoning", "Migraine", "Vertigo", "Pregnancy"],
        "fatigue": ["Anemia", "Depression", "Sleep Apnea", "Hypothyroidism"],
        "sore throat": ["Strep Throat", "Common Cold", "Tonsillitis"]
    }
    
    for symptom in extracted_info["symptoms"]:
        symptom_lower = symptom.lower()
        if symptom_lower in symptom_to_disease:
            extracted_info["possible_diseases"].extend(symptom_to_disease[symptom_lower])
    
    # Remove duplicates
    extracted_info["possible_diseases"] = list(set(extracted_info["possible_diseases"]))
    
    return extracted_info

def clean_extracted_info(extracted_info):
    """
    Clean and normalize the extracted information
    
    Args:
        extracted_info (dict): Raw extracted information
        
    Returns:
        dict: Cleaned information
    """
    # Ensure all required fields exist
    required_lists = ["chief_complaints", "past_history", "chronic_diseases", 
                     "lifestyle", "drug_history", "family_history", "allergies",
                     "symptoms", "possible_diseases", "chief_complaint_details"]
    
    required_objects = ["patient_details"]
    
    # Check and initialize required lists
    for field in required_lists:
        if field not in extracted_info:
            extracted_info[field] = []
        elif not isinstance(extracted_info[field], list):
            # Convert to list if not already
            if extracted_info[field] is None:
                extracted_info[field] = []
            else:
                extracted_info[field] = [extracted_info[field]]
    
    # Check and initialize required objects
    for field in required_objects:
        if field not in extracted_info or not isinstance(extracted_info[field], dict):
            extracted_info[field] = {}
    
    # Ensure patient_details fields exist
    patient_detail_fields = ["name", "age", "gender", "marital_status", "residence"]
    for field in patient_detail_fields:
        if field not in extracted_info["patient_details"]:
            extracted_info["patient_details"][field] = None
    
    # Remove duplicates in lists while preserving order
    for field in required_lists:
        if isinstance(extracted_info[field], list):
            # Skip fields that are dicts in lists like chief_complaint_details and lifestyle
            if field in ["chief_complaint_details", "lifestyle"]:
                continue
                
            seen = set()
            extracted_info[field] = [x for x in extracted_info[field] 
                                    if not (str(x).lower() in seen or seen.add(str(x).lower())) and x]
    
    return extracted_info

def get_all_notes():
    """
    Read all notes from the file
    
    Returns:
        list: List of note texts
    """
    try:
        with open('notes.txt', 'r') as f:
            content = f.read()
            notes = content.split('---\n')
            return [note.strip() for note in notes if note.strip()]
    except FileNotFoundError:
        return []

def save_note(note_text):
    """
    Save a new note to the file
    
    Args:
        note_text (str): Note text to save
        
    Returns:
        bool: Success status
    """
    try:
        with open('notes.txt', 'a') as f:
            f.write(note_text + '\n---\n')
        return True
    except Exception as e:
        print(f"Error saving note: {str(e)}")
        return False

def save_edited_summary(note_id, edited_summary):
    """
    Save edited summary to a file
    
    Args:
        note_id: Identifier for the note
        edited_summary: The edited summary content
    
    Returns:
        bool: Success status
    """
    try:
        # Create summaries directory if it doesn't exist
        if not os.path.exists('summaries'):
            os.makedirs('summaries')
            
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"summaries/summary_{note_id}_{timestamp}.json"
        
        # Save the summary
        with open(filename, 'w') as f:
            json.dump(edited_summary, f, indent=2)
        
        return True, filename
    except Exception as e:
        print(f"Error saving edited summary: {str(e)}")
        return False, None

def transcribe_audio(file_path):
    """
    Enhanced transcription function with improved accuracy settings
    
    Args:
        file_path (str): Path to the audio file
        
    Returns:
        str: Transcribed text
    """
    try:
        # Initialize recognizer with enhanced settings
        recognizer = sr.Recognizer()
        
        # Adjust recognition parameters for better accuracy
        recognizer.energy_threshold = 300  # Increase energy threshold for better noise handling
        recognizer.dynamic_energy_threshold = True  # Dynamically adjust for ambient noise
        recognizer.pause_threshold = 0.8  # Longer pause threshold for better phrase detection
        
        # Determine file extension
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Check if it's a WAV file
        if file_ext != '.wav':
            return """
            This version only supports WAV files for direct transcription.
            
            For other audio formats, please:
            1. Convert your audio to WAV format using an online converter
            2. Upload the WAV file instead
            3. Or install ffmpeg properly on your system
            """
        
        # Direct transcription for WAV files with multiple attempts and settings
        transcription_result = ""
        
        try:
            # First attempt with standard settings
            with sr.AudioFile(file_path) as source:
                # Adjust for ambient noise
                recognizer.adjust_for_ambient_noise(source, duration=0.5)
                # Record the entire audio file with higher quality
                audio_data = recognizer.record(source)
                
                # Try to recognize using Google's service with additional language options
                try:
                    # First try with English (US) - best for medical terminology
                    transcription_result = recognizer.recognize_google(
                        audio_data, 
                        language="en-US",
                        show_all=False  # Only return the most likely result
                    )
                except:
                    # If US English fails, try generic English
                    transcription_result = recognizer.recognize_google(
                        audio_data, 
                        language="en",
                        show_all=False
                    )
            
            # If the result seems too short, try again with different settings
            if len(transcription_result.split()) < 5:
                with sr.AudioFile(file_path) as source:
                    # Use a longer duration for noise adjustment
                    recognizer.adjust_for_ambient_noise(source, duration=1.0)
                    # Increase the phrase threshold for better sentence detection
                    recognizer.pause_threshold = 1.0
                    audio_data = recognizer.record(source)
                    
                    # Try with different settings for the Google API
                    second_attempt = recognizer.recognize_google(
                        audio_data,
                        language="en-US",
                        show_all=False
                    )
                    
                    # Use the longer result
                    if len(second_attempt.split()) > len(transcription_result.split()):
                        transcription_result = second_attempt
            
            # Clean and format the transcription
            transcription_result = clean_transcription(transcription_result)
            
            return transcription_result if transcription_result else "Transcription produced no results. Please try uploading a clearer audio file or entering text manually."
            
        except sr.UnknownValueError:
            return "Speech recognition could not understand the audio. Please ensure the recording is clear and try again."
        except sr.RequestError as e:
            return f"Could not request results from Speech Recognition service; {e}. Check your internet connection."
        except Exception as wav_error:
            print(f"Error processing WAV file: {str(wav_error)}")
            return f"Error processing audio: {str(wav_error)}. Please try again with a different file."
    
    except Exception as e:
        print(f"Error in transcription process: {str(e)}")
        return f"Error in transcription process: {str(e)}"

def clean_transcription(text):
    """
    Clean and format the transcription text
    
    Args:
        text (str): Raw transcription text
        
    Returns:
        str: Cleaned and formatted text
    """
    if not text:
        return ""
        
    # Convert to proper capitalization
    sentences = re.split(r'(?<=[.!?])\s+', text)
    formatted_sentences = []
    
    for sentence in sentences:
        if sentence:
            # Capitalize first letter of each sentence
            formatted = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
            formatted_sentences.append(formatted)
    
    # Rejoin with proper spacing
    result = ' '.join(formatted_sentences)
    
    # Fix common medical term capitalization
    medical_terms = [
        'COVID', 'COVID-19', 'MRI', 'CT scan', 'EKG', 'ECG', 'IV', 'BP',
        'HDL', 'LDL', 'VLDL', 'GERD', 'UTI', 'URI', 'PCP', 'COPD'
    ]
    
    for term in medical_terms:
        # Use word boundaries to replace only whole words
        pattern = r'\b' + re.escape(term.lower()) + r'\b'
        result = re.sub(pattern, term, result, flags=re.IGNORECASE)
    
    # Add periods to the end of sentences if missing
    if result and result[-1] not in '.!?':
        result += '.'
        
    return result