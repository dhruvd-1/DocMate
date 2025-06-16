from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    flash,
    session,
    jsonify,
)
import os
import re
import json
import tempfile
import sqlite3
import numpy as np
import pandas as pd
from werkzeug.utils import secure_filename
from datetime import datetime
from pydub import AudioSegment

# Import custom modules
from models.database import (
    init_db,
    save_note,
    save_summary,
    get_all_notes,
    get_note_by_id,
    delete_note,
    update_note_text,  # Added missing import
    import_existing_notes,
    get_follow_up_actions,  # Added for follow-up functionality
    save_follow_up_actions,  # Added for follow-up functionality
    DB_PATH,
)
from models.lipid_analyzer import (
    analyze_lipid_profile,
    get_population_percentile,
    extract_data_from_pdf,
    is_valid_extraction,
)
from models.symptom_checker import predict_disease, get_common_symptoms
from models.notes_processor import (
    extract_medical_info,
    transcribe_audio,
    save_edited_summary,  # Keep this since it's specialized
)
from models.chatbot_handler import ChatbotHandler
from models.follow_up import (
    generate_follow_up_actions,
)  # Only import the generator function
from models.treatment_efficacy import analyze_treatment_efficacy, get_patient_notes

# Initialize the database and import existing notes when the app starts
init_db()
import_existing_notes()  # This will import notes from notes.txt
try:
    from models.database import DB_PATH

    print(f"Successfully imported DB_PATH: {DB_PATH}")
except ImportError:
    import os

    # Define a fallback path
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    DB_PATH = os.path.join(BASE_DIR, "medical_notes.db")
    print(f"Using fallback DB_PATH: {DB_PATH}")
# Optional: Import AI model if available
try:
    import google.generativeai as genai

    # Configure Gemini API Key from environment variable
    API_KEY = os.environ.get("GEMINI_API_KEY", "your-api-key-here")
    genai.configure(api_key=API_KEY)

    # Create a model instance
    try:
        genai_model = genai.GenerativeModel("gemini-1.5-pro")
    except Exception:
        # Fallback to another model if the preferred one isn't available
        genai_model = genai.GenerativeModel("gemini-1.0-pro")

    # Initialize chatbot with the AI model
    chatbot = ChatbotHandler(genai_model)

except ImportError:
    print(
        "Google Generative AI package not available. Using rule-based chatbot instead."
    )
    genai_model = None
    chatbot = ChatbotHandler()

# Initialize Flask application
app = Flask(__name__)
app.secret_key = "health_companion_secret_key"
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max upload
# Update allowed extensions to include more audio formats
app.config["ALLOWED_EXTENSIONS"] = {
    "pdf",
    "mp3",
    "wav",
    "ogg",
    "m4a",
    "aac",
    "flac",
    "wma",
    "aiff",
}  # Added audio file types

# Ensure necessary directories exist
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
os.makedirs("summaries", exist_ok=True)  # Directory for saved summaries


# Helper Functions
def allowed_file(filename):
    """Check if file has an allowed extension"""
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in app.config["ALLOWED_EXTENSIONS"]
    )


def convert_audio_to_wav(file_path):
    """Convert any audio file to WAV format using pydub"""
    try:
        # Get the file extension
        file_ext = os.path.splitext(file_path)[1].lower()

        # Define the output WAV path
        wav_path = os.path.splitext(file_path)[0] + ".wav"

        print(f"Converting {file_ext} file to WAV: {file_path} -> {wav_path}")

        # Load the audio file using pydub
        if file_ext == ".mp3":
            audio = AudioSegment.from_mp3(file_path)
        elif file_ext == ".ogg":
            audio = AudioSegment.from_ogg(file_path)
        elif file_ext == ".flac":
            audio = AudioSegment.from_file(file_path, format="flac")
        elif file_ext == ".aac":
            audio = AudioSegment.from_file(file_path, format="aac")
        elif file_ext == ".m4a":
            audio = AudioSegment.from_file(file_path, format="m4a")
        elif file_ext == ".wma":
            audio = AudioSegment.from_file(file_path, format="wma")
        elif file_ext == ".aiff" or file_ext == ".aif":
            audio = AudioSegment.from_file(file_path, format="aiff")
        elif file_ext == ".wav":
            # Already a WAV file, no conversion needed
            return file_path
        else:
            # Try to load using the file extension as format
            try:
                audio = AudioSegment.from_file(file_path, format=file_ext[1:])
            except Exception as e:
                print(f"Failed to determine format for {file_ext}: {e}")
                return None

        # Export as WAV
        audio.export(wav_path, format="wav")

        print(f"Conversion successful: {wav_path}")
        return wav_path

    except Exception as e:
        print(f"Error converting audio file: {e}")
        import traceback

        traceback.print_exc()
        return None


# Helper for resolving problematic note IDs
def resolve_note_id(note_id):
    """Helper function to resolve problematic note IDs (boolean, temp, etc)"""
    # Handle temporary or boolean IDs
    if isinstance(note_id, bool) or note_id == "true" or note_id == "false":
        print(f"WARNING: Problematic note ID: {note_id}, looking for real ID")
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM notes ORDER BY id DESC LIMIT 1")
        result = cursor.fetchone()
        conn.close()

        if result:
            return result[0]
        else:
            return None
    elif isinstance(note_id, str):
        if note_id.startswith("temp-"):
            # This is a temporary ID; find the newest note in the database
            print(f"Received temp ID {note_id}, looking for real ID")
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM notes ORDER BY id DESC LIMIT 1")
            result = cursor.fetchone()
            conn.close()

            if result:
                return result[0]
            else:
                return None
        elif note_id.isdigit():
            # Convert string ID to integer
            return int(note_id)

    # If note_id is already in proper format, return as is
    return note_id


# Routes
@app.route("/")
def home():
    """Home page route"""
    return render_template("index.html")


# Lipid Profile Routes
@app.route("/lipid_profile")
def lipid_profile():
    """Lipid profile input page"""
    return render_template("lipid_profile.html")


@app.route("/analyze_lipid", methods=["POST"])
def analyze_lipid():
    """Handle lipid profile manual input analysis"""
    if request.method == "POST":
        # Check if form is submitted with manual values
        if "total_cholesterol" in request.form:
            try:
                # Get values from form
                total_cholesterol = float(request.form["total_cholesterol"])
                hdl_cholesterol = float(request.form["hdl_cholesterol"])
                ldl_cholesterol = float(request.form["ldl_cholesterol"])
                triglycerides = float(request.form["triglycerides"])

                # Analyze the lipid profile
                result, risk_level, recommendations = analyze_lipid_profile(
                    total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides
                )

                # Get population percentiles
                percentiles = get_population_percentile(
                    total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides
                )

                return render_template(
                    "lipid_result.html",
                    total_cholesterol=total_cholesterol,
                    hdl_cholesterol=hdl_cholesterol,
                    ldl_cholesterol=ldl_cholesterol,
                    triglycerides=triglycerides,
                    result=result,
                    risk_level=risk_level,
                    recommendations=recommendations,
                    percentiles=percentiles,
                )
            except Exception as e:
                flash(f"Error processing values: {str(e)}", "danger")
                return redirect(url_for("lipid_profile"))
        else:
            flash("Please provide valid lipid profile values", "danger")
            return redirect(url_for("lipid_profile"))


@app.route("/upload_report", methods=["POST"])
def upload_report():
    """Handle uploaded PDF report analysis"""
    if "report_file" not in request.files:
        flash("No file part", "danger")
        return redirect(url_for("lipid_profile"))

    file = request.files["report_file"]

    if file.filename == "":
        flash("No selected file", "danger")
        return redirect(url_for("lipid_profile"))

    if file and allowed_file(file.filename):
        try:
            # Create a temporary file to store the upload
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp:
                temp_path = temp.name
                file.save(temp_path)

            try:
                # Extract data from PDF
                extracted_data = extract_data_from_pdf(temp_path)

                # Check if extraction was successful
                if not extracted_data or not is_valid_extraction(extracted_data):
                    flash(
                        "Could not extract lipid values from the report. Please try manual entry.",
                        "warning",
                    )
                    os.unlink(temp_path)  # Delete the temporary file
                    return redirect(url_for("lipid_profile"))

                # Get the values
                tc = extracted_data.get("total_cholesterol")
                hdl = extracted_data.get("hdl_cholesterol")
                ldl = extracted_data.get("ldl_cholesterol")
                trig = extracted_data.get("triglycerides")

                # Analyze the lipid profile
                result, risk_level, recommendations = analyze_lipid_profile(
                    tc, hdl, ldl, trig
                )

                # Get population percentiles
                percentiles = get_population_percentile(tc, hdl, ldl, trig)

                # Clean up the temporary file
                os.unlink(temp_path)

                return render_template(
                    "lipid_result.html",
                    total_cholesterol=tc,
                    hdl_cholesterol=hdl,
                    ldl_cholesterol=ldl,
                    triglycerides=trig,
                    result=result,
                    risk_level=risk_level,
                    recommendations=recommendations,
                    percentiles=percentiles,
                    additional_data=extracted_data.get("additional_data", {}),
                )
            except Exception as e:
                # Clean up the temporary file
                os.unlink(temp_path)
                flash(f"Error processing file: {str(e)}", "danger")
                return redirect(url_for("lipid_profile"))
        except Exception as e:
            flash(f"Error saving file: {str(e)}", "danger")
            return redirect(url_for("lipid_profile"))
    else:
        flash("Only PDF files are allowed", "warning")
        return redirect(url_for("lipid_profile"))


# Symptom Checker Routes
@app.route("/symptom_checker")
def symptom_checker():
    """Symptom checker page"""
    # Get list of symptoms for checkboxes
    symptoms = get_common_symptoms()
    return render_template("symptom_checker.html", symptoms=symptoms)


@app.route("/predict_disease", methods=["POST"])
def predict_disease_route():
    """Process symptom checker form and show prediction"""
    if request.method == "POST":
        selected_symptoms = request.form.getlist("symptoms")
        # Get prediction from model
        prediction, confidence = predict_disease(selected_symptoms)
        return render_template(
            "prediction_result.html",
            prediction=prediction,
            confidence=confidence,
            symptoms=selected_symptoms,
        )


# Chatbot Routes
@app.route("/chatbot")
def chatbot_page():
    """Chatbot interface page"""
    return render_template("chatbot.html")


@app.route("/get_chatbot_response", methods=["POST"])
def get_chatbot_response():
    """API endpoint for chatbot responses"""
    user_message = request.form.get("user_message", "")

    # Get response from chatbot handler
    response_data = chatbot.get_response(user_message)

    return jsonify(response_data)


# Medical Notes Routes
@app.route("/note")
def note():
    """Medical notes page"""
    return render_template("note.html")


@app.route("/save_note", methods=["POST"])
def save_note_route():
    """API endpoint to save a new note"""
    try:
        data = request.get_json()
        if not data or "note" not in data:
            return jsonify(
                {"status": "error", "message": "Missing note text in request"}
            ), 400

        note_text = data["note"]
        imported_history = data.get("imported_history")  # This is the new field

        # Log what history is being sent (if any)
        print("=== SAVING NOTE WITH HISTORY ===")
        if imported_history:
            print(
                f"Received imported history with keys: {', '.join(imported_history.keys())}"
            )
            for key in imported_history.keys():
                value = imported_history[key]
                if isinstance(value, list):
                    print(f"Import field {key}: {len(value)} items - {value}")
                else:
                    print(f"Import field {key}: {value}")

        if not note_text or not isinstance(note_text, str):
            return jsonify({"status": "error", "message": "Invalid note text"}), 400

        print(f"Attempting to save note: {note_text[:50]}...")

        # Save the note to the database
        note_id = save_note(note_text)

        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Failed to save note to database"}
            ), 500

        # Process the note
        try:
            if "genai_model" in globals() and genai_model:
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
                    "allergies": [],
                }

            # NEW: Incorporate imported history if available
            if imported_history:
                print(
                    f"Incorporating imported history for patient: {imported_history.get('patient_details', {}).get('name')}"
                )

                # Copy persistent fields from imported history if they're missing or empty in the current summary
                for field in [
                    "allergies",
                    "past_history",
                    "chronic_diseases",
                    "family_history",
                    "lifestyle",
                ]:
                    # Check if the field exists and has actual data (not just an empty array)
                    if field in imported_history:
                        has_data = False
                        if isinstance(imported_history[field], list):
                            has_data = len(imported_history[field]) > 0
                        else:
                            has_data = imported_history[field] is not None

                        print(
                            f"Processing imported field: {field} | Has data: {has_data} | Value: {imported_history[field]}"
                        )

                        if has_data:
                            # If the field doesn't exist in the new summary, create it
                            if field not in summary:
                                print(
                                    f"Field {field} not in current summary, creating it"
                                )
                                summary[field] = imported_history[field]
                            # If the field exists but is empty, use the imported values
                            elif not summary[field] or (
                                isinstance(summary[field], list)
                                and len(summary[field]) == 0
                            ):
                                print(
                                    f"Field {field} is empty in current summary, using imported values"
                                )
                                summary[field] = imported_history[field]
                            # If it exists with different items, merge them
                            elif isinstance(summary[field], list) and isinstance(
                                imported_history[field], list
                            ):
                                print(f"Merging field {field} from imported history")
                                # Create a set of existing items for fast lookup
                                existing_items = set()

                                # For simple string lists
                                if not summary[field] or (
                                    len(summary[field]) > 0
                                    and isinstance(summary[field][0], str)
                                ):
                                    existing_items = set(summary[field])
                                    for item in imported_history[field]:
                                        if item not in existing_items:
                                            summary[field].append(item)
                                            print(
                                                f"Added imported item to {field}: {item}"
                                            )
                                else:
                                    # For complex objects, we'd need a more sophisticated merge
                                    print(
                                        f"Complex object merging for {field} is not implemented, appending items"
                                    )
                                    summary[field].extend(imported_history[field])

                # Verify that each field was properly merged
                for field in [
                    "allergies",
                    "past_history",
                    "chronic_diseases",
                    "family_history",
                    "lifestyle",
                ]:
                    if field in summary:
                        value = summary[field]
                        if isinstance(value, list):
                            print(
                                f"Final {field} after merge: {len(value)} items - {value}"
                            )
                        else:
                            print(f"Final {field} after merge: {value}")
                    else:
                        print(f"WARNING: {field} missing from final summary")

                print("Successfully merged imported history into new note")

        except Exception as e:
            print(f"Error generating summary: {str(e)}")
            import traceback

            traceback.print_exc()
            # Create a minimal summary as fallback
            summary = {
                "patient_details": {"name": "Unknown Patient"},
                "chief_complaints": [],
                "symptoms": [],
                "allergies": [],
            }

        # Save the generated summary
        summary_saved = save_summary(note_id, summary)
        if not summary_saved:
            print("Warning: Failed to save summary")

        # Check if the history was properly merged in the returned data
        if summary:
            print("Returned summary keys:", list(summary.keys()))
            for field in [
                "allergies",
                "past_history",
                "chronic_diseases",
                "family_history",
                "lifestyle",
            ]:
                if field in summary:
                    value = summary[field]
                    if isinstance(value, list):
                        print(f"{field} in saved note: {len(value)} items - {value}")
                    else:
                        print(f"{field} in saved note: {value}")
                else:
                    print(f"WARNING: {field} is missing in the saved note summary")

        # Return success
        return jsonify(
            {
                "status": "success",
                "id": note_id,
                "original": note_text,
                "summary": summary,
            }
        )

    except Exception as e:
        print(f"Error in save_note_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/save_edited_note", methods=["POST"])
def save_edited_note_route():
    """API endpoint to save an edited note"""
    try:
        data = request.get_json()

        if not data or "noteId" not in data or "editedText" not in data:
            return jsonify(
                {"status": "error", "message": "Note ID and edited text are required"}
            ), 400

        note_id = data["noteId"]
        edited_text = data["editedText"]

        print(f"Edit request for note ID: {note_id}, Type: {type(note_id)}")

        # Resolve note ID issues
        note_id = resolve_note_id(note_id)
        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Could not resolve note ID"}
            ), 400

        # Check if the note exists
        original_note = get_note_by_id(note_id)
        print(
            f"Checking for note with ID {note_id}: {'Found' if original_note else 'Not found'}"
        )

        if not original_note:
            return jsonify(
                {
                    "status": "error",
                    "message": f"Note with ID {note_id} not found in database",
                }
            ), 404

        # Update the note text
        update_success = update_note_text(note_id, edited_text)

        if not update_success:
            return jsonify(
                {"status": "error", "message": "Failed to update note text"}
            ), 500

        # Re-process the note if needed to update summary
        if "genai_model" in globals() and genai_model:
            summary = extract_medical_info(edited_text, genai_model)
        else:
            summary = extract_medical_info(edited_text)

        # Save the updated summary
        save_summary(note_id, summary, is_edited=True)

        # Get the updated note
        updated_note = get_note_by_id(note_id)

        return jsonify(
            {
                "status": "success",
                "message": "Note updated successfully",
                "note": updated_note,
            }
        )

    except Exception as e:
        print(f"Error in save_edited_note_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/save_edited_summary", methods=["POST"])
def save_edited_summary_route():
    """API endpoint to save an edited summary"""
    try:
        data = request.get_json()

        if not data or "noteId" not in data or "editedSummary" not in data:
            return jsonify({"status": "error", "message": "Invalid data provided"}), 400

        note_id = data["noteId"]
        edited_summary = data["editedSummary"]

        # Resolve note ID issues
        note_id = resolve_note_id(note_id)
        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Could not resolve note ID"}
            ), 400

        # Save the edited summary
        success = save_summary(note_id, edited_summary, is_edited=True)

        if success:
            return jsonify(
                {"status": "success", "message": "Summary saved successfully"}
            )
        else:
            return jsonify(
                {"status": "error", "message": "Failed to save summary"}
            ), 500

    except Exception as e:
        print(f"Error in save_edited_summary_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/get_notes", methods=["GET"])
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
            if not note or not note.get("original") or not note.get("summary"):
                continue

            # Skip notes with empty or default summaries
            summary = note.get("summary", {})
            if not summary or (
                summary.get("patient_details", {}).get("name") == "Unknown Patient"
                and not any(
                    summary.get(key, [])
                    for key in ["chief_complaints", "symptoms", "allergies"]
                )
            ):
                continue

            # Ensure note has a proper ID (not a boolean)
            if isinstance(note.get("id"), bool):
                print(f"WARNING: Found note with boolean ID: {note.get('id')}")
                # Replace with a timestamp-based ID
                note["id"] = str(int(datetime.now().timestamp()))

            valid_notes.append(note)

        return jsonify(valid_notes)
    except Exception as e:
        # Log the error
        print(f"Error in fetch_notes: {str(e)}")
        import traceback

        traceback.print_exc()
        # Return a proper error response
        return jsonify([])  # Return empty array instead of error


@app.route("/upload_audio", methods=["POST"])
def upload_audio():
    """Handle audio file upload, conversion, and transcription"""
    if "audio_file" not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400

    file = request.files["audio_file"]

    if file.filename == "":
        return jsonify({"status": "error", "message": "No selected file"}), 400

    if file and allowed_file(file.filename):
        try:
            # Create a file path in the uploads directory
            filename = secure_filename(file.filename)
            timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
            original_file_path = os.path.join(
                app.config["UPLOAD_FOLDER"], f"{timestamp}_{filename}"
            )

            # Save the original file
            file.save(original_file_path)

            # Convert to WAV if needed
            wav_file_path = convert_audio_to_wav(original_file_path)

            if not wav_file_path:
                return jsonify(
                    {
                        "status": "error",
                        "message": "Failed to convert audio file to WAV format",
                    }
                ), 500

            # Transcribe the WAV file
            transcription = transcribe_audio(wav_file_path)

            # Clean up the original file if it's different from the WAV file
            if original_file_path != wav_file_path and os.path.exists(
                original_file_path
            ):
                os.remove(original_file_path)
                print(f"Removed original file after conversion: {original_file_path}")

            return jsonify(
                {
                    "status": "success",
                    "message": "Audio file transcribed successfully",
                    "transcription": transcription,
                    "file_path": wav_file_path,
                }
            )

        except Exception as e:
            return jsonify(
                {"status": "error", "message": f"Error processing audio: {str(e)}"}
            ), 500
    else:
        return jsonify(
            {
                "status": "error",
                "message": "Invalid file type. Allowed types: mp3, wav, ogg, m4a, aac, flac, wma, aiff",
            }
        ), 400


@app.route("/delete_note", methods=["POST"])
def delete_note_route():
    """API endpoint to delete a note"""
    try:
        data = request.get_json()

        if not data or "noteId" not in data:
            return jsonify({"status": "error", "message": "Note ID is required"}), 400

        # Get the note ID from request
        note_id = data["noteId"]

        print(f"Delete request for note ID: {note_id}, Type: {type(note_id)}")

        # Resolve note ID issues
        note_id = resolve_note_id(note_id)
        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Could not resolve note ID"}
            ), 400

        # Check if the note exists
        existing_note = get_note_by_id(note_id)
        print(
            f"Checking for note with ID {note_id}: {'Found' if existing_note else 'Not found'}"
        )

        if not existing_note:
            return jsonify(
                {
                    "status": "error",
                    "message": f"Note with ID {note_id} not found in database",
                }
            ), 404

        # Delete the note
        success = delete_note(note_id)
        print(f"Note deletion result: {success}")

        if success:
            return jsonify(
                {"status": "success", "message": "Note deleted successfully"}
            )
        else:
            return jsonify({"status": "error", "message": "Failed to delete note"}), 500

    except Exception as e:
        print(f"Error in delete_note_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/diagnose_database", methods=["GET"])
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
        if "notes" in [t[0] for t in tables]:
            cursor.execute("SELECT id, text, created_at FROM notes LIMIT 5")
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                notes_sample.append(dict(zip(columns, row)))

        # Sample records from summaries table
        summaries_sample = []
        if "summaries" in [t[0] for t in tables]:
            cursor.execute(
                "SELECT id, note_id, is_edited, created_at FROM summaries LIMIT 5"
            )
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                summaries_sample.append(dict(zip(columns, row)))

        # Sample records from follow_up_actions table
        follow_up_sample = []
        if "follow_up_actions" in [t[0] for t in tables]:
            cursor.execute(
                "SELECT id, note_id, created_at FROM follow_up_actions LIMIT 5"
            )
            columns = [desc[0] for desc in cursor.description]
            for row in cursor.fetchall():
                follow_up_sample.append(dict(zip(columns, row)))

        conn.close()

        return jsonify(
            {
                "status": "success",
                "database_path": DB_PATH,
                "tables": [t[0] for t in tables],
                "record_counts": counts,
                "notes_sample": notes_sample,
                "summaries_sample": summaries_sample,
                "follow_up_sample": follow_up_sample,
            }
        )

    except Exception as e:
        return jsonify(
            {"status": "error", "message": f"Error diagnosing database: {str(e)}"}
        ), 500


# Follow-up action routes
@app.route("/generate_follow_up", methods=["POST"])
def generate_follow_up_route():
    """API endpoint to generate follow-up actions for a note"""
    try:
        data = request.get_json()
        if not data or "noteId" not in data:
            return jsonify({"status": "error", "message": "Note ID is required"}), 400

        note_id = data["noteId"]

        # Resolve note ID issues
        note_id = resolve_note_id(note_id)
        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Could not resolve note ID"}
            ), 400

        # Generate follow-up actions
        actions = generate_follow_up_actions(note_id)

        if "error" in actions:
            return jsonify({"status": "error", "message": actions["error"]}), 404

        # Save the generated actions to the database
        save_follow_up_actions(note_id, actions)

        return jsonify({"status": "success", "actions": actions})

    except Exception as e:
        print(f"Error in generate_follow_up_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/get_follow_up", methods=["GET"])
def get_follow_up_route():
    """API endpoint to get stored follow-up actions for a note"""
    try:
        note_id = request.args.get("noteId")
        if not note_id:
            return jsonify({"status": "error", "message": "Note ID is required"}), 400

        # Resolve note ID issues
        note_id = resolve_note_id(note_id)
        if note_id is None:
            return jsonify(
                {"status": "error", "message": "Could not resolve note ID"}
            ), 400

        # Get follow-up actions
        actions = get_follow_up_actions(note_id)

        if not actions:
            return jsonify(
                {
                    "status": "error",
                    "message": "No follow-up actions found for this note",
                }
            ), 404

        return jsonify({"status": "success", "actions": actions})

    except Exception as e:
        print(f"Error in get_follow_up_route: {str(e)}")
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


# Add this route
@app.route("/analyze_treatment_efficacy", methods=["POST"])
def analyze_treatment_efficacy_route():
    """API endpoint to analyze treatment efficacy for a patient"""
    try:
        print("Treatment efficacy analysis endpoint hit")
        data = request.get_json()

        if not data or "patient_name" not in data:
            print("Missing patient_name in request")
            return jsonify(
                {"status": "error", "message": "Patient name is required"}
            ), 400

        patient_name = data["patient_name"]
        print(f"Analyzing treatments for patient: {patient_name}")

        # Perform the analysis
        try:
            analysis = analyze_treatment_efficacy(patient_name)
            print("analyze_treatment_efficacy completed successfully")
        except Exception as analysis_error:
            print(f"Error in analyze_treatment_efficacy: {str(analysis_error)}")
            import traceback

            traceback.print_exc()
            return jsonify(
                {"status": "error", "message": f"Analysis error: {str(analysis_error)}"}
            ), 500

        print(
            f"Analysis result: {'error' in analysis and analysis['error'] or 'success'}"
        )

        # Important: Return 200 status code even when there's an analysis error
        if "error" in analysis:
            return jsonify({"status": "error", "message": analysis["error"]}), 200

        return jsonify({"status": "success", "analysis": analysis})

    except Exception as e:
        print(f"Error in analyze_treatment_efficacy_route: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/test_notes_db", methods=["GET"])
def test_notes_db():
    """Test endpoint to verify database connectivity and structure"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Check if notes table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='notes'"
        )
        if not cursor.fetchone():
            return jsonify(
                {"status": "error", "message": "Notes table does not exist"}
            ), 404

        # Check if summaries table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='summaries'"
        )
        if not cursor.fetchone():
            return jsonify(
                {"status": "error", "message": "Summaries table does not exist"}
            ), 404

        # Count notes
        cursor.execute("SELECT COUNT(*) as count FROM notes")
        notes_count = cursor.fetchone()["count"]

        # Count summaries
        cursor.execute("SELECT COUNT(*) as count FROM summaries")
        summaries_count = cursor.fetchone()["count"]

        # Get a sample of notes with summaries
        cursor.execute("""
            SELECT n.id, n.text, n.created_at, s.summary_data
            FROM notes n
            LEFT JOIN summaries s ON n.id = s.note_id
            WHERE s.summary_data IS NOT NULL
            LIMIT 5
        """)

        sample_notes = []
        for row in cursor.fetchall():
            note = {
                "id": row["id"],
                "created_at": row["created_at"],
                "has_summary": row["summary_data"] is not None,
            }

            if row["summary_data"]:
                try:
                    summary = json.loads(row["summary_data"])
                    note["summary_keys"] = list(summary.keys())

                    # Check for patient details
                    if "patient_details" in summary:
                        note["has_patient_details"] = True
                        note["patient_name"] = summary["patient_details"].get(
                            "name", "None"
                        )
                    else:
                        note["has_patient_details"] = False

                    # Check for symptoms and medications
                    note["has_symptoms"] = "symptoms" in summary
                    note["symptoms_count"] = len(summary.get("symptoms", []))
                    note["has_medications"] = "drug_history" in summary
                    note["medications_count"] = len(summary.get("drug_history", []))

                except json.JSONDecodeError:
                    note["summary_error"] = "Invalid JSON"

            sample_notes.append(note)

        conn.close()

        return jsonify(
            {
                "status": "success",
                "database_info": {
                    "notes_count": notes_count,
                    "summaries_count": summaries_count,
                    "sample_notes": sample_notes,
                },
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/debug_patient_notes/<patient_name>", methods=["GET"])
def debug_patient_notes(patient_name):
    """Debug endpoint to check patient notes"""
    try:
        # Get all notes for this patient
        notes = get_patient_notes(patient_name)

        debug_info = {
            "patient_name": patient_name,
            "notes_count": len(notes),
            "notes_details": [],
        }

        for i, note in enumerate(notes):
            note_info = {"id": note["id"], "created_at": note["created_at"]}

            if "summary" in note:
                summary = note["summary"]
                note_info["summary_keys"] = list(summary.keys())

                if "patient_details" in summary:
                    note_info["patient_name"] = summary["patient_details"].get(
                        "name", "None"
                    )

                if "symptoms" in summary:
                    note_info["symptoms"] = summary["symptoms"]

                if "drug_history" in summary:
                    note_info["medications"] = summary["drug_history"]

            debug_info["notes_details"].append(note_info)

        return jsonify({"status": "success", "debug_info": debug_info})

    except Exception as e:
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/find_previous_patient_history", methods=["POST"])
def find_previous_patient_history():
    """API endpoint to find previous history for a patient"""
    try:
        data = request.get_json()

        if not data or "patient_name" not in data:
            return jsonify(
                {"status": "error", "message": "Patient name is required"}
            ), 400

        patient_name = data["patient_name"]
        patient_age = data.get("patient_age")  # Age is optional

        print(
            f"Looking for previous history of patient: {patient_name}, age: {patient_age}"
        )

        # Query the database for the most recent note for this patient
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get all notes with summaries, ordered by date (newest first)
        cursor.execute("""
        SELECT n.id, n.created_at, s.summary_data
        FROM notes n
        JOIN summaries s ON n.id = s.note_id
        ORDER BY n.created_at DESC
        """)

        # Initialize variables to track the best match
        best_match = None
        best_match_date = None

        for row in cursor.fetchall():
            try:
                if row["summary_data"]:
                    summary = json.loads(row["summary_data"])

                    print(
                        f"Checking note {row['id']} with summary keys: {', '.join(summary.keys())}"
                    )

                    # Debug: Check for family_history specifically
                    if "family_history" in summary:
                        if (
                            isinstance(summary["family_history"], list)
                            and len(summary["family_history"]) > 0
                        ):
                            print(
                                f"  - Note has family_history: {summary['family_history']}"
                            )
                        else:
                            print(
                                f"  - Note has empty family_history: {summary['family_history']}"
                            )
                    else:
                        print("  - Note does NOT have family_history field")

                    # Check if this is a potential match
                    if "patient_details" in summary and summary["patient_details"]:
                        db_patient_name = (
                            summary["patient_details"].get("name", "").lower().strip()
                        )
                        db_patient_age = None

                        # Try to get age as string or number
                        if "age" in summary["patient_details"]:
                            try:
                                db_patient_age = int(summary["patient_details"]["age"])
                            except (ValueError, TypeError):
                                # If it's not a number, try to use it as a string
                                db_patient_age = str(
                                    summary["patient_details"]["age"]
                                ).strip()

                        # Check name match
                        patient_name_lower = patient_name.lower().strip()
                        name_match = False

                        if db_patient_name == patient_name_lower:
                            name_match = True
                            print(
                                f"  - Exact name match: '{db_patient_name}' == '{patient_name_lower}'"
                            )
                        elif (
                            db_patient_name in patient_name_lower
                            or patient_name_lower in db_patient_name
                        ):
                            # Partial match - acceptable
                            name_match = True
                            print(
                                f"  - Partial name match: '{db_patient_name}' in/contains '{patient_name_lower}'"
                            )

                        # Check age match if provided
                        age_match = True  # Default to True if no age provided
                        if patient_age is not None and db_patient_age is not None:
                            # Convert both to string for comparison
                            if str(patient_age) != str(db_patient_age):
                                age_match = False
                                print(
                                    f"  - Age mismatch: {db_patient_age} != {patient_age}"
                                )
                            else:
                                print(
                                    f"  - Age match: {db_patient_age} == {patient_age}"
                                )

                        # If both name and age match, this is a potential match
                        if name_match and age_match:
                            print(f"  - MATCH: Name and age match for note {row['id']}")

                            # Check if this note has useful history data
                            history_fields = [
                                "allergies",
                                "past_history",
                                "chronic_diseases",
                                "family_history",
                                "lifestyle",
                            ]
                            has_history_data = False

                            for field in history_fields:
                                if (
                                    field in summary
                                    and isinstance(summary[field], list)
                                    and len(summary[field]) > 0
                                ):
                                    has_history_data = True
                                    print(
                                        f"  - Note has {field} data: {summary[field]}"
                                    )

                            if has_history_data:
                                print("  - Note has useful history data")
                                # This is a good match
                                note_date = row["created_at"]

                                # If this is the first match or newer than current best match
                                if best_match is None or note_date > best_match_date:
                                    best_match = summary
                                    best_match_date = note_date
                                    print(
                                        f"Found potential history match in note {row['id']} from {note_date}"
                                    )
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON for note {row['id']}: {e}")
                continue
            except Exception as e:
                print(f"Error processing note {row['id']}: {e}")
                continue

        conn.close()

        if best_match:
            # Extract just the history parts we want to reuse
            history = {
                "patient_details": best_match.get("patient_details"),
                "allergies": best_match.get("allergies", []),
                "past_history": best_match.get("past_history", []),
                "chronic_diseases": best_match.get("chronic_diseases", []),
                "family_history": best_match.get("family_history", []),
                "lifestyle": best_match.get("lifestyle", []),
                # Note: we don't include drug_history as that might change between visits
            }

            # Debug: Print what we're returning with explicit check for empty arrays
            print(f"Returning history with keys: {', '.join(history.keys())}")
            for field in [
                "allergies",
                "past_history",
                "chronic_diseases",
                "family_history",
                "lifestyle",
            ]:
                if field in history:
                    if isinstance(history[field], list) and len(history[field]) > 0:
                        print(
                            f"{field} being returned with {len(history[field])} items: {history[field]}"
                        )
                    else:
                        print(
                            f"{field} being returned as empty or non-list: {history[field]}"
                        )

            return jsonify(
                {
                    "status": "success",
                    "message": f"Found previous history for patient {patient_name}",
                    "history": history,
                    "date": best_match_date,
                }
            )
        else:
            print(f"No matching patient found for {patient_name}, age {patient_age}")
            return jsonify(
                {
                    "status": "info",
                    "message": f"No previous history found for patient {patient_name}",
                }
            )

    except Exception as e:
        print(f"Error finding previous patient history: {str(e)}")
        import traceback

        traceback.print_exc()
        return jsonify({"status": "error", "message": f"Server error: {str(e)}"}), 500


@app.route("/list_all_patients", methods=["GET"])
def list_all_patients():
    """Debug endpoint to list all patients in the database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
        SELECT n.id, n.created_at, s.summary_data
        FROM notes n
        JOIN summaries s ON n.id = s.note_id
        ORDER BY n.created_at DESC
        """)

        patients = []

        for row in cursor.fetchall():
            try:
                if row["summary_data"]:
                    summary = json.loads(row["summary_data"])

                    patient_name = "Unknown"
                    patient_age = "Unknown"

                    if "patient_details" in summary and summary["patient_details"]:
                        patient_name = summary["patient_details"].get("name", "Unknown")
                        patient_age = summary["patient_details"].get("age", "Unknown")

                    has_family_history = (
                        "family_history" in summary and summary["family_history"]
                    )

                    patients.append(
                        {
                            "note_id": row["id"],
                            "created_at": row["created_at"],
                            "patient_name": patient_name,
                            "patient_age": patient_age,
                            "has_family_history": has_family_history,
                            "summary_keys": list(summary.keys()),
                        }
                    )
            except Exception as e:
                print(f"Error processing note {row['id']}: {e}")
                continue

        conn.close()

        return jsonify({"status": "success", "patients": patients})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/check_specific_patient/<patient_name>", methods=["GET"])
def check_specific_patient(patient_name):
    """Debug endpoint to check a specific patient's records in detail"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
        SELECT n.id, n.created_at, s.summary_data
        FROM notes n
        JOIN summaries s ON n.id = s.note_id
        ORDER BY n.created_at DESC
        """)

        patient_records = []

        for row in cursor.fetchall():
            try:
                if row["summary_data"]:
                    summary = json.loads(row["summary_data"])

                    record_patient_name = None
                    if "patient_details" in summary and summary["patient_details"]:
                        record_patient_name = summary["patient_details"].get("name")

                    # If this record matches the requested patient
                    if (
                        record_patient_name
                        and patient_name.lower() in record_patient_name.lower()
                    ):
                        # Extract all fields for detailed inspection
                        patient_record = {
                            "note_id": row["id"],
                            "created_at": row["created_at"],
                            "patient_name": record_patient_name,
                            "summary_keys": list(summary.keys()),
                        }

                        # Add all the important fields
                        for field in [
                            "allergies",
                            "past_history",
                            "chronic_diseases",
                            "family_history",
                            "lifestyle",
                            "drug_history",
                        ]:
                            if field in summary:
                                patient_record[field] = summary[field]

                        patient_records.append(patient_record)
            except Exception as e:
                print(f"Error processing note {row['id']}: {e}")
                continue

        conn.close()

        if not patient_records:
            return jsonify(
                {
                    "status": "error",
                    "message": f"No records found for patient: {patient_name}",
                }
            ), 404

        return jsonify(
            {
                "status": "success",
                "patient_name": patient_name,
                "record_count": len(patient_records),
                "records": patient_records,
            }
        )

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True)
