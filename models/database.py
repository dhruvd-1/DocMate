# models/database.py
import sqlite3
import json
import os
from datetime import datetime

# Database file path
DB_PATH = 'medical_notes.db'

def init_db():
    """Initialize the database with required tables"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create notes table with proper AUTOINCREMENT
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    # Create summaries table with proper FOREIGN KEY
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        summary_data TEXT NOT NULL,
        is_edited BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
    ''')
    
    conn.commit()
    conn.close()


def save_note(note_text):
    """Save a new note to the database"""
    try:
        # Generate a unique ID first
        unique_id = generate_unique_id()
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Use the unique ID explicitly
        cursor.execute('INSERT INTO notes (id, text) VALUES (?, ?)', (unique_id, note_text))
        
        conn.commit()
        conn.close()
        
        print(f"Note saved with unique ID: {unique_id}")
        return unique_id
        
    except Exception as e:
        print(f"Error in save_note: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def generate_unique_id():
    """Generate a guaranteed unique ID for a new note"""
    import time
    import random
    
    # Create a timestamp-based ID with random component to ensure uniqueness
    timestamp = int(time.time() * 1000)  # Milliseconds since epoch
    random_part = random.randint(1000, 9999)  # Add some randomness
    unique_id = timestamp + random_part
    
    # Verify this ID doesn't exist in the database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM notes WHERE id = ?', (unique_id,))
    if cursor.fetchone():
        # In the extremely unlikely case of a collision, add more randomness
        unique_id += random.randint(10000, 99999)
    
    conn.close()
    
    return unique_id

def save_summary(note_id, summary_data, is_edited=False):
    """Save a summary for a note"""
    try:
        if not summary_data:
            print("Warning: Attempt to save empty summary")
            # Create a minimal summary
            summary_data = {
                "patient_details": {"name": "Unknown Patient"},
                "chief_complaints": [],
                "symptoms": [],
                "allergies": []
            }
            
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Ensure the summaries table exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            summary_data TEXT NOT NULL,
            is_edited BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes(id)
        )
        ''')
        
        conn.commit()
        
        # Convert dict to JSON string for storage
        summary_json = json.dumps(summary_data)
        
        # Check if a summary already exists for this note
        cursor.execute('SELECT id FROM summaries WHERE note_id = ?', (note_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update the existing summary
            cursor.execute(
                'UPDATE summaries SET summary_data = ?, is_edited = ? WHERE note_id = ?', 
                (summary_json, 1 if is_edited else 0, note_id)
            )
        else:
            # Insert a new summary
            cursor.execute(
                'INSERT INTO summaries (note_id, summary_data, is_edited) VALUES (?, ?, ?)',
                (note_id, summary_json, 1 if is_edited else 0)
            )
        
        conn.commit()
        conn.close()
        
        # Print a confirmation message for debugging
        print(f"Summary saved for note ID: {note_id}, Is edited: {is_edited}")
        
        return True
        
    except Exception as e:
        print(f"Error in save_summary: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def get_all_notes():
    """Get all notes with their summaries"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # This enables column access by name
        cursor = conn.cursor()
        
        # Ensure the notes table exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Ensure the summaries table exists
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            note_id INTEGER NOT NULL,
            summary_data TEXT NOT NULL,
            is_edited BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (note_id) REFERENCES notes(id)
        )
        ''')
        
        conn.commit()
        
        cursor.execute('''
        SELECT n.id, n.text, n.created_at, s.summary_data
        FROM notes n
        LEFT JOIN summaries s ON n.id = s.note_id
        ORDER BY n.created_at DESC
        ''')
        
        notes = []
        for row in cursor.fetchall():
            note = {
                'id': row['id'],
                'original': row['text'],
                'created_at': row['created_at']
            }
            
            if row['summary_data']:
                try:
                    note['summary'] = json.loads(row['summary_data'])
                except json.JSONDecodeError:
                    print(f"Warning: Invalid JSON in summary_data for note {row['id']}")
                    note['summary'] = {
                        "patient_details": {"name": "Unknown Patient"},
                        "chief_complaints": [],
                        "symptoms": [],
                        "allergies": []
                    }
            else:
                note['summary'] = None
                
            notes.append(note)
        
        conn.close()
        return notes
        
    except Exception as e:
        print(f"Error in get_all_notes: {str(e)}")
        import traceback
        traceback.print_exc()
        return []

def update_note_text(note_id, new_text):
    """Update the text of an existing note
    
    Args:
        note_id (int): ID of the note to update
        new_text (str): New text content
        
    Returns:
        bool: True if update successful, False otherwise
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Update the note text
        cursor.execute('UPDATE notes SET text = ? WHERE id = ?', (new_text, note_id))
        
        success = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        return success
    except Exception as e:
        print(f"Error updating note text: {str(e)}")
        return False
    
def get_note_by_id(note_id):
    """Get a specific note by its ID"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
    SELECT n.id, n.text, n.created_at, s.summary_data
    FROM notes n
    LEFT JOIN summaries s ON n.id = s.note_id
    WHERE n.id = ?
    ''', (note_id,))
    
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
        
    note = {
        'id': row['id'],
        'original': row['text'],
        'created_at': row['created_at']
    }
    
    if row['summary_data']:
        note['summary'] = json.loads(row['summary_data'])
    else:
        note['summary'] = None
        
    conn.close()
    return note

def delete_note(note_id):
    """Delete a note and its summaries"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # First delete related summaries (because of foreign key constraint)
    cursor.execute('DELETE FROM summaries WHERE note_id = ?', (note_id,))
    
    # Then delete the note
    cursor.execute('DELETE FROM notes WHERE id = ?', (note_id,))
    
    deleted = cursor.rowcount > 0
    
    conn.commit()
    conn.close()
    
    return deleted

# Import existing notes from notes.txt if it exists
def import_existing_notes():
    """Import existing notes from notes.txt into the database"""
    if not os.path.exists('notes.txt'):
        return
        
    with open('notes.txt', 'r') as f:
        content = f.read()
        notes = content.split('---\n')
        notes = [note.strip() for note in notes if note.strip()]
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    for note in notes:
        cursor.execute('INSERT INTO notes (text) VALUES (?)', (note,))
    
    conn.commit()
    conn.close()

