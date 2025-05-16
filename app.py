from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import os
import re
import json
import tempfile
import sqlite3  # Ensure this is imported at the top level
import numpy as np
import pandas as pd
from werkzeug.utils import secure_filename
from datetime import datetime

# Import custom modules
from models.database import init_db, save_note, save_summary, get_all_notes, get_note_by_id, delete_note, import_existing_notes, DB_PATH
from models.lipid_analyzer import analyze_lipid_profile, get_population_percentile, extract_data_from_pdf, is_valid_extraction
from models.symptom_checker import predict_disease, get_common_symptoms
from models.notes_processor import extract_medical_info, get_all_notes, save_note, save_edited_summary, get_edited_summary, transcribe_audio
from models.chatbot_handler import ChatbotHandler

# Initialize the database and import existing notes when the app starts
init_db()
import_existing_notes()  # This will import notes from notes.txt

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

@app.route('/save_note', methods=['POST'])
def save_note_route():
    """API endpoint to save a new note"""
    try:
        data = request.get_json()
        if not data or 'note' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Missing note text in request'
            }), 400
            
        note_text = data['note']
        
        if not note_text or not isinstance(note_text, str):
            return jsonify({
                'status': 'error',
                'message': 'Invalid note text'
            }), 400
            
        print(f"Attempting to save note: {note_text[:50]}...")
        
        # Save the note to the database
        note_id = save_note(note_text)
        
        if note_id is None:
            return jsonify({
                'status': 'error',
                'message': 'Failed to save note to database'
            }), 500
            
        # Make sure note_id is not a boolean
        if isinstance(note_id, bool):
            print(f"WARNING: save_note returned boolean {note_id}, converting to string ID")
            # Generate a numeric ID instead
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
            else:
                note_id = str(int(datetime.now().timestamp()))
        
        print(f"Note saved with ID: {note_id}, Type: {type(note_id)}")
        
        # Process the note
        try:
            if 'genai_model' in globals() and genai_model:
                summary = extract_medical_info(note_text, genai_model)
            else:
                summary = extract_medical_info(note_text)
                
            if not summary:
                print("Warning: extract_medical_info returned empty summary")
                # Create a minimal summary
                summary = {
                    "patient_details": {"name": "Unknown Patient"},
                    "chief_complaints": [],
                    "symptoms": [],
                    "allergies": []
                }
        except Exception as e:
            print(f"Error generating summary: {str(e)}")
            # Create a minimal summary as fallback
            summary = {
                "patient_details": {"name": "Unknown Patient"},
                "chief_complaints": [],
                "symptoms": [],
                "allergies": []
            }
        
        # Save the generated summary
        summary_saved = save_summary(note_id, summary)
        if not summary_saved:
            print("Warning: Failed to save summary")
        
        # Return success
        return jsonify({
            'status': 'success',
            'id': note_id,
            'original': note_text,
            'summary': summary
        })
        
    except Exception as e:
        print(f"Error in save_note_route: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/save_edited_note', methods=['POST'])
def save_edited_note_route():
    """API endpoint to save an edited note"""
    try:
        data = request.get_json()
        
        if not data or 'noteId' not in data or 'editedText' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Note ID and edited text are required'
            }), 400
        
        note_id = data['noteId']
        edited_text = data['editedText']
        
        print(f"Edit request for note ID: {note_id}, Type: {type(note_id)}")
        
        # Handle the case where note_id is a boolean (true/false)
        if note_id is True or note_id == 'true':
            print("WARNING: Converting boolean 'true' to numeric ID")
            # Get the most recent note as a fallback
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
                print(f"Using most recent note ID: {note_id}")
            else:
                # Generate a timestamp-based ID as absolute fallback
                note_id = str(int(datetime.now().timestamp()))
                print(f"Generated timestamp-based ID: {note_id}")
        elif note_id is False or note_id == 'false':
            return jsonify({
                'status': 'error',
                'message': 'Cannot edit note with boolean ID "false"'
            }), 400
        elif isinstance(note_id, str) and note_id.startswith('temp-'):
            # This is a temporary ID; find the newest note in the database
            print(f"Received temp ID {note_id}, looking for real ID")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
                print(f"Using most recent note ID: {note_id}")
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'No notes found in database'
                }), 404
        else:
            # Convert string ID to integer if needed
            try:
                if isinstance(note_id, str) and note_id.isdigit():
                    note_id = int(note_id)
            except (ValueError, TypeError) as e:
                print(f"Error converting note ID: {str(e)}")
        
        # Check if the note exists
        original_note = get_note_by_id(note_id)
        print(f"Checking for note with ID {note_id}: {'Found' if original_note else 'Not found'}")
        
        if not original_note:
            return jsonify({
                'status': 'error',
                'message': f'Note with ID {note_id} not found in database'
            }), 404
            
        # Update the note text
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('UPDATE notes SET text = ? WHERE id = ?', (edited_text, note_id))
        update_success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        if not update_success:
            return jsonify({
                'status': 'error',
                'message': 'Failed to update note text'
            }), 500
            
        # Re-process the note if needed to update summary
        if 'genai_model' in globals() and genai_model:
            summary = extract_medical_info(edited_text, genai_model)
        else:
            summary = extract_medical_info(edited_text)
            
        # Save the updated summary
        save_summary(note_id, summary, is_edited=True)
        
        # Get the updated note
        updated_note = get_note_by_id(note_id)
        
        return jsonify({
            'status': 'success',
            'message': 'Note updated successfully',
            'note': updated_note
        })
            
    except Exception as e:
        print(f"Error in save_edited_note_route: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500
    
@app.route('/save_edited_summary', methods=['POST'])
def save_edited_summary_route():
    """API endpoint to save an edited summary"""
    try:
        data = request.get_json()
        
        if not data or 'noteId' not in data or 'editedSummary' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Invalid data provided'
            }), 400
        
        note_id = data['noteId']
        edited_summary = data['editedSummary']
        
        # Handle temporary or boolean IDs
        if isinstance(note_id, bool) or note_id == 'true' or note_id == 'false' or (isinstance(note_id, str) and note_id.startswith('temp-')):
            print(f"WARNING: Problematic note ID: {note_id}, looking for real ID")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
                print(f"Using most recent note ID: {note_id}")
            else:
                return jsonify({
                    'status': 'error',
                    'message': f'Cannot resolve note ID {note_id} to a valid database ID'
                }), 400
        
        # Save the edited summary
        success = save_summary(note_id, edited_summary, is_edited=True)
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Summary saved successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to save summary'
            }), 500
            
    except Exception as e:
        print(f"Error in save_edited_summary_route: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/get_notes', methods=['GET'])
def fetch_notes():
    """API endpoint to get all saved notes with filtering for empty/invalid notes"""
    try:
        notes = get_all_notes()
        
        if notes is None:
            print("Error: get_all_notes() returned None")
            return jsonify([])  # Return empty array instead of error
            
        # Filter out empty notes or placeholder notes
        valid_notes = []
        for note in notes:
            # Skip notes that don't have proper content or are just placeholders
            if not note or not note.get('original') or not note.get('summary'):
                continue
                
            # Skip notes with empty or default summaries
            summary = note.get('summary', {})
            if not summary or (summary.get('patient_details', {}).get('name') == 'Unknown Patient' and 
                              not any(summary.get(key, []) for key in ['chief_complaints', 'symptoms', 'allergies'])):
                continue
                
            # Ensure note has a proper ID (not a boolean)
            if isinstance(note.get('id'), bool):
                print(f"WARNING: Found note with boolean ID: {note.get('id')}")
                # Replace with a timestamp-based ID
                note['id'] = str(int(datetime.now().timestamp()))
                
            valid_notes.append(note)
        
        return jsonify(valid_notes)
    except Exception as e:
        # Log the error
        print(f"Error in fetch_notes: {str(e)}")
        import traceback
        traceback.print_exc()
        # Return a proper error response
        return jsonify([])  # Return empty array instead of error

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

@app.route('/delete_note', methods=['POST'])
def delete_note_route():
    """API endpoint to delete a note"""
    try:
        data = request.get_json()
        
        if not data or 'noteId' not in data:
            return jsonify({
                'status': 'error',
                'message': 'Note ID is required'
            }), 400
        
        # Get the note ID from request
        note_id = data['noteId']
        
        print(f"Delete request for note ID: {note_id}, Type: {type(note_id)}")
        
        # Handle the case where note_id is a boolean or temporary ID
        if note_id is True or note_id == 'true':
            print("WARNING: Converting boolean 'true' to numeric ID")
            # Get the most recent note as a fallback
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
                print(f"Using most recent note ID: {note_id}")
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Cannot delete with boolean ID and no notes exist'
                }), 400
        elif note_id is False or note_id == 'false':
            return jsonify({
                'status': 'error',
                'message': 'Cannot delete note with boolean ID "false"'
            }), 400
        elif isinstance(note_id, str) and note_id.startswith('temp-'):
            # This is a temporary ID; find the newest note in the database
            print(f"Received temp ID {note_id}, looking for real ID")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM notes ORDER BY id DESC LIMIT 1')
            result = cursor.fetchone()
            conn.close()
            
            if result:
                note_id = result[0]
                print(f"Using most recent note ID: {note_id}")
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'No notes found in database'
                }), 404
        else:
            # Convert string ID to integer if needed
            try:
                if isinstance(note_id, str) and note_id.isdigit():
                    note_id = int(note_id)
            except (ValueError, TypeError) as e:
                print(f"Error converting note ID: {str(e)}")
        
        # Check if the note exists
        existing_note = get_note_by_id(note_id)
        print(f"Checking for note with ID {note_id}: {'Found' if existing_note else 'Not found'}")
        
        if not existing_note:
            return jsonify({
                'status': 'error',
                'message': f'Note with ID {note_id} not found in database'
            }), 404
        
        # Delete the note
        success = delete_note(note_id)
        print(f"Note deletion result: {success}")
        
        if success:
            return jsonify({
                'status': 'success',
                'message': 'Note deleted successfully'
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Failed to delete note'
            }), 500
            
    except Exception as e:
        print(f"Error in delete_note_route: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500
            
@app.route('/diagnose_database', methods=['GET'])
def diagnose_database():
    """Diagnostic endpoint to check database status"""
    try:
        # List all tables
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        # Count records in each table
        counts = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = cursor.fetchone()[0]
            counts[table_name] = count
        
        # Sample records from notes table
        notes_sample = []
        if 'notes' in [t[0] for t in tables]:
            cursor.execute("SELECT id, text, created_at FROM notes LIMIT 5")
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                notes_sample.append(dict(zip(columns, row)))
        
        # Sample records from summaries table
        summaries_sample = []
        if 'summaries' in [t[0] for t in tables]:
            cursor.execute("SELECT id, note_id, is_edited, created_at FROM summaries LIMIT 5")
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                summaries_sample.append(dict(zip(columns, row)))
        
        conn.close()
        
        return jsonify({
            'status': 'success',
            'database_path': DB_PATH,
            'tables': [t[0] for t in tables],
            'record_counts': counts,
            'notes_sample': notes_sample,
            'summaries_sample': summaries_sample
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Error diagnosing database: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True)