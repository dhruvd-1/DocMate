from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import os
import re
import json
import tempfile
import numpy as np
import pandas as pd
from werkzeug.utils import secure_filename
from datetime import datetime

# Import custom modules
from models.lipid_analyzer import analyze_lipid_profile, get_population_percentile, extract_data_from_pdf, is_valid_extraction
from models.symptom_checker import predict_disease, get_common_symptoms
from models.notes_processor import extract_medical_info, get_all_notes, save_note, save_edited_summary, transcribe_audio
from models.chatbot_handler import ChatbotHandler

# Optional: Import AI model if available
try:
    import google.generativeai as genai
    # Configure Gemini API Key from environment variable
    API_KEY = os.environ.get("GEMINI_API_KEY", "your-api-key-here")
    genai.configure(api_key=API_KEY)
    
    # Create a model instance
    try:
        genai_model = genai.GenerativeModel('gemini-1.5-pro')
    except Exception:
        # Fallback to another model if the preferred one isn't available
        genai_model = genai.GenerativeModel('gemini-1.0-pro')
    
    # Initialize chatbot with the AI model
    chatbot = ChatbotHandler(genai_model)
    
except ImportError:
    print("Google Generative AI package not available. Using rule-based chatbot instead.")
    genai_model = None
    chatbot = ChatbotHandler()

# Initialize Flask application
app = Flask(__name__)
app.secret_key = 'health_companion_secret_key'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'mp3', 'wav', 'ogg', 'm4a'}  # Added audio file types

# Ensure necessary directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs('summaries', exist_ok=True)  # Directory for saved summaries

# Helper Functions
def allowed_file(filename):
    """Check if file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']
# Routes
@app.route('/')
def home():
    """Home page route"""
    return render_template('index.html')

# Lipid Profile Routes
@app.route('/lipid_profile')
def lipid_profile():
    """Lipid profile input page"""
    return render_template('lipid_profile.html')

@app.route('/analyze_lipid', methods=['POST'])
def analyze_lipid():
    """Handle lipid profile manual input analysis"""
    if request.method == 'POST':
        # Check if form is submitted with manual values
        if 'total_cholesterol' in request.form:
            try:
                # Get values from form
                total_cholesterol = float(request.form['total_cholesterol'])
                hdl_cholesterol = float(request.form['hdl_cholesterol'])
                ldl_cholesterol = float(request.form['ldl_cholesterol'])
                triglycerides = float(request.form['triglycerides'])
                
                # Analyze the lipid profile
                result, risk_level, recommendations = analyze_lipid_profile(
                    total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides
                )
                
                # Get population percentiles
                percentiles = get_population_percentile(
                    total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides
                )
                
                return render_template('lipid_result.html',
                                    total_cholesterol=total_cholesterol,
                                    hdl_cholesterol=hdl_cholesterol,
                                    ldl_cholesterol=ldl_cholesterol,
                                    triglycerides=triglycerides,
                                    result=result,
                                    risk_level=risk_level,
                                    recommendations=recommendations,
                                    percentiles=percentiles)
            except Exception as e:
                flash(f'Error processing values: {str(e)}', 'danger')
                return redirect(url_for('lipid_profile'))
        else:
            flash('Please provide valid lipid profile values', 'danger')
            return redirect(url_for('lipid_profile'))

@app.route('/upload_report', methods=['POST'])
def upload_report():
    """Handle uploaded PDF report analysis"""
    if 'report_file' not in request.files:
        flash('No file part', 'danger')
        return redirect(url_for('lipid_profile'))
        
    file = request.files['report_file']
    
    if file.filename == '':
        flash('No selected file', 'danger')
        return redirect(url_for('lipid_profile'))
        
    if file and allowed_file(file.filename):
        try:
            # Create a temporary file to store the upload
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp:
                temp_path = temp.name
                file.save(temp_path)
                
            try:
                # Extract data from PDF
                extracted_data = extract_data_from_pdf(temp_path)
                
                # Check if extraction was successful
                if not extracted_data or not is_valid_extraction(extracted_data):
                    flash('Could not extract lipid values from the report. Please try manual entry.', 'warning')
                    os.unlink(temp_path)  # Delete the temporary file
                    return redirect(url_for('lipid_profile'))
                    
                # Get the values
                tc = extracted_data.get('total_cholesterol')
                hdl = extracted_data.get('hdl_cholesterol')
                ldl = extracted_data.get('ldl_cholesterol')
                trig = extracted_data.get('triglycerides')
                
                # Analyze the lipid profile
                result, risk_level, recommendations = analyze_lipid_profile(tc, hdl, ldl, trig)
                
                # Get population percentiles
                percentiles = get_population_percentile(tc, hdl, ldl, trig)
                
                # Clean up the temporary file
                os.unlink(temp_path)
                
                return render_template('lipid_result.html',
                                    total_cholesterol=tc,
                                    hdl_cholesterol=hdl,
                                    ldl_cholesterol=ldl,
                                    triglycerides=trig,
                                    result=result,
                                    risk_level=risk_level,
                                    recommendations=recommendations,
                                    percentiles=percentiles,
                                    additional_data=extracted_data.get('additional_data', {}))
            except Exception as e:
                # Clean up the temporary file
                os.unlink(temp_path)
                flash(f'Error processing file: {str(e)}', 'danger')
                return redirect(url_for('lipid_profile'))
        except Exception as e:
            flash(f'Error saving file: {str(e)}', 'danger')
            return redirect(url_for('lipid_profile'))
    else:
        flash('Only PDF files are allowed', 'warning')
        return redirect(url_for('lipid_profile'))

# Symptom Checker Routes
@app.route('/symptom_checker')
def symptom_checker():
    """Symptom checker page"""
    # Get list of symptoms for checkboxes
    symptoms = get_common_symptoms()
    return render_template('symptom_checker.html', symptoms=symptoms)

@app.route('/predict_disease', methods=['POST'])
def predict_disease_route():
    """Process symptom checker form and show prediction"""
    if request.method == 'POST':
        selected_symptoms = request.form.getlist('symptoms')
        # Get prediction from model
        prediction, confidence = predict_disease(selected_symptoms)
        return render_template('prediction_result.html',
                              prediction=prediction,
                              confidence=confidence,
                              symptoms=selected_symptoms)

# Chatbot Routes
@app.route('/chatbot')
def chatbot_page():
    """Chatbot interface page"""
    return render_template('chatbot.html')

@app.route('/get_chatbot_response', methods=['POST'])
def get_chatbot_response():
    """API endpoint for chatbot responses"""
    user_message = request.form.get('user_message', '')
    
    # Get response from chatbot handler
    response_data = chatbot.get_response(user_message)
    
    return jsonify(response_data)

# Medical Notes Routes
@app.route('/note')
def note():
    """Medical notes page"""
    return render_template('note.html')

@app.route('/get_notes', methods=['GET'])
def fetch_notes():
    """API endpoint to get all saved notes"""
    notes = get_all_notes()
    processed_notes = []
    
    for note in notes:
        # Process each note with AI if available, otherwise use basic extraction
        if genai_model:
            summary = extract_medical_info(note, genai_model)
        else:
            summary = extract_medical_info(note)
            
        processed_notes.append({
            "original": note,
            "summary": summary
        })
        
    return jsonify(processed_notes)

@app.route('/save_note', methods=['POST'])
def save_note_route():
    """API endpoint to save a new note"""
    data = request.get_json()
    note = data['note']
    
    # Save the note
    save_success = save_note(note)
    
    if not save_success:
        return jsonify({
            'status': 'error',
            'message': 'Failed to save note'
        }), 500
        
    # Process the note
    if genai_model:
        summary = extract_medical_info(note, genai_model)
    else:
        summary = extract_medical_info(note)
    
    return jsonify({
        'status': 'success',
        'original': note,
        'summary': summary
    })

@app.route('/save_edited_summary', methods=['POST'])
def save_edited_summary_route():
    """API endpoint to save an edited summary"""
    data = request.get_json()
    
    if not data or 'noteId' not in data or 'editedSummary' not in data or 'originalSummary' not in data:
        return jsonify({
            'status': 'error',
            'message': 'Invalid data provided'
        }), 400
    
    note_id = data['noteId']
    edited_summary = data['editedSummary']
    original_summary = data['originalSummary']
    
    # Save edited summary
    save_success, filename = save_edited_summary(note_id, {
        'edited_summary': edited_summary,
        'original_summary': original_summary,
        'timestamp': datetime.now().isoformat()
    })
    
    if not save_success:
        return jsonify({
            'status': 'error',
            'message': 'Failed to save edited summary'
        }), 500
    
    return jsonify({
        'status': 'success',
        'message': 'Summary saved successfully',
        'filename': filename
    })

@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    """Handle audio file upload and transcription"""
    if 'audio_file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'No file part'
        }), 400
        
    file = request.files['audio_file']
    
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'No selected file'
        }), 400
        
    if file and allowed_file(file.filename):
        try:
            # Create a file path in the uploads directory
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{timestamp}_{filename}")
            
            # Save the file
            file.save(file_path)
            
            # Transcribe the audio file
            transcription = transcribe_audio(file_path)
            
            return jsonify({
                'status': 'success',
                'message': 'Audio file transcribed successfully',
                'transcription': transcription,
                'file_path': file_path
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error processing audio: {str(e)}'
            }), 500
    else:
        return jsonify({
            'status': 'error',
            'message': 'Invalid file type. Allowed types: mp3, wav, ogg, m4a'
        }), 400

if __name__ == '__main__':
    app.run(debug=True)