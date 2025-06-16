"""
Follow-up Action Items Generator
"""

import json
import sqlite3
import re
from datetime import datetime, timedelta
from .database import DB_PATH


def generate_follow_up_actions(note_id):
    """
    Generate AI-based follow-up action items from a medical note

    Args:
        note_id: ID of the note to analyze

    Returns:
        dict: Generated follow-up actions for both doctor and patient
    """
    # Get the note data
    note = get_note_by_id(note_id)
    if not note:
        return {"error": "Note not found"}

    # Initialize actions structure
    actions = {
        "patient_actions": [],
        "doctor_actions": [],
        "follow_up_date": None,
        "urgency_level": "routine",
        "generated_at": datetime.now().isoformat(),
    }

    # Extract information from the original note (raw conversation text)
    note_text = note.get("original", "")

    # Process the extracted summary (if available)
    if note.get("summary"):
        summary = note["summary"]

        # Process patient details
        patient_name = None
        if summary.get("patient_details"):
            patient_name = summary["patient_details"].get("name")

        # Generate patient actions based on symptoms
        if summary.get("symptoms"):
            actions["patient_actions"].extend(
                generate_symptom_actions(summary["symptoms"], note_text)
            )

        # Generate medication-related actions
        if summary.get("drug_history"):
            actions["patient_actions"].extend(
                generate_medication_actions(summary["drug_history"], note_text)
            )

        # Generate lifestyle-related actions
        if summary.get("lifestyle"):
            actions["patient_actions"].extend(
                generate_lifestyle_actions(summary["lifestyle"], note_text)
            )

        # Generate doctor actions based on chief complaints
        if summary.get("chief_complaints"):
            actions["doctor_actions"].extend(
                generate_complaint_actions(summary["chief_complaints"], note_text)
            )

        # Generate follow-up recommendation based on the overall note
        follow_up_info = generate_follow_up_recommendation(
            summary.get("chief_complaints", []),
            summary.get("symptoms", []),
            summary.get("chronic_diseases", []),
            patient_name,
            note_text,
        )

        actions["follow_up_date"] = follow_up_info["date"]
        actions["urgency_level"] = follow_up_info["urgency"]

        # Add the follow-up visit as a patient action
        if follow_up_info["date"]:
            actions["patient_actions"].append(
                {
                    "action": f"Schedule follow-up appointment on {follow_up_info['date']}",
                    "category": "appointment",
                    "priority": "high"
                    if follow_up_info["urgency"] == "urgent"
                    else "medium",
                    "context": "Based on your condition assessment",
                }
            )

    # Extract all explicit instructions from conversation regardless of summary
    explicit_instructions = extract_explicit_instructions(note_text)

    # Add explicit patient instructions
    for instruction in explicit_instructions.get("patient", []):
        if not any(
            action["action"].lower() == instruction.lower()
            for action in actions["patient_actions"]
        ):
            actions["patient_actions"].append(
                {
                    "action": instruction,
                    "category": "direct_instruction",
                    "priority": "high",
                    "context": "Direct instruction from doctor",
                }
            )

    # Add explicit doctor follow-up actions
    for instruction in explicit_instructions.get("doctor", []):
        if not any(
            action["action"].lower() == instruction.lower()
            for action in actions["doctor_actions"]
        ):
            actions["doctor_actions"].append(
                {
                    "action": instruction,
                    "category": "direct_instruction",
                    "priority": "high",
                    "context": "Self-noted follow-up",
                }
            )

    # Add tests and referrals as both doctor and patient actions
    tests_and_referrals = extract_tests_and_referrals(note_text)
    for item in tests_and_referrals:
        # Add as doctor action
        actions["doctor_actions"].append(
            {
                "action": f"Order {item['type']}: {item['name']}",
                "category": item["type"],
                "priority": "high",
                "context": f"Mentioned during visit",
            }
        )

        # Also add as patient action
        actions["patient_actions"].append(
            {
                "action": f"Complete {item['type']}: {item['name']}",
                "category": item["type"],
                "priority": "high",
                "context": f"Requested during visit",
            }
        )

    # Save the follow-up actions to the database
    save_follow_up_actions(note_id, actions)

    return actions


def get_note_by_id(note_id):
    """Get a specific note by its ID"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
    SELECT n.id, n.text, n.created_at, s.summary_data
    FROM notes n
    LEFT JOIN summaries s ON n.id = s.note_id
    WHERE n.id = ?
    """,
        (note_id,),
    )

    row = cursor.fetchone()
    if not row:
        conn.close()
        return None

    note = {"id": row["id"], "original": row["text"], "created_at": row["created_at"]}

    if row["summary_data"]:
        try:
            note["summary"] = json.loads(row["summary_data"])
        except json.JSONDecodeError:
            note["summary"] = None
    else:
        note["summary"] = None

    conn.close()
    return note


def save_follow_up_actions(note_id, actions):
    """Save follow-up actions to the database"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create follow_up_actions table if it doesn't exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS follow_up_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        actions_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
    """)

    # Check if we already have actions for this note
    cursor.execute("SELECT id FROM follow_up_actions WHERE note_id = ?", (note_id,))
    existing = cursor.fetchone()

    actions_json = json.dumps(actions)

    if existing:
        # Update existing actions
        cursor.execute(
            "UPDATE follow_up_actions SET actions_data = ? WHERE note_id = ?",
            (actions_json, note_id),
        )
    else:
        # Insert new actions
        cursor.execute(
            "INSERT INTO follow_up_actions (note_id, actions_data) VALUES (?, ?)",
            (note_id, actions_json),
        )

    conn.commit()
    conn.close()


def get_follow_up_actions(note_id):
    """Get follow-up actions for a note"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute(
        """
    SELECT actions_data
    FROM follow_up_actions
    WHERE note_id = ?
    """,
        (note_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if row and row["actions_data"]:
        try:
            return json.loads(row["actions_data"])
        except json.JSONDecodeError:
            return None

    return None


def generate_symptom_actions(symptoms, note_text):
    """Generate action items based on reported symptoms"""
    actions = []

    # Common symptoms and their standard monitoring/management actions
    symptom_actions = {
        "fever": {
            "action": "Monitor temperature daily",
            "priority": "medium",
            "context": "For fever management",
        },
        "headache": {
            "action": "Track headache frequency, intensity, and triggers",
            "priority": "medium",
            "context": "For headache management",
        },
        "cough": {
            "action": "Monitor cough characteristics and note any changes",
            "priority": "medium",
            "context": "For respiratory symptom tracking",
        },
        "pain": {
            "action": "Rate pain level daily on a scale of 1-10",
            "priority": "medium",
            "context": "For pain management",
        },
        "dizziness": {
            "action": "Avoid driving and hazardous activities while experiencing dizziness",
            "priority": "high",
            "context": "For safety",
        },
        "breathing": {
            "action": "Monitor breathing difficulty and seek immediate care if it worsens",
            "priority": "high",
            "context": "For respiratory safety",
        },
        "chest pain": {
            "action": "Seek emergency care immediately if chest pain occurs",
            "priority": "high",
            "context": "For cardiac safety",
        },
        "blood pressure": {
            "action": "Measure blood pressure daily and keep a log",
            "priority": "high",
            "context": "For blood pressure management",
        },
    }

    # Add actions for each recognized symptom
    for symptom in symptoms:
        # Convert to lowercase for matching
        symptom_lower = symptom.lower()

        # Find specific instructions in note text related to this symptom
        custom_instruction = find_symptom_instruction(note_text, symptom)
        if custom_instruction:
            actions.append(
                {
                    "action": custom_instruction,
                    "category": "symptom_management",
                    "priority": "high",
                    "related_to": symptom,
                    "context": "Specific instruction from doctor",
                }
            )
            continue

        # Otherwise use standard actions
        matched = False
        for key, action_info in symptom_actions.items():
            if key in symptom_lower:
                actions.append(
                    {
                        "action": action_info["action"],
                        "category": "symptom_management",
                        "priority": action_info["priority"],
                        "related_to": symptom,
                        "context": action_info["context"],
                    }
                )
                matched = True
                break

        # If no match found, add a generic monitoring action
        if not matched:
            actions.append(
                {
                    "action": f"Monitor {symptom} and report any changes or worsening",
                    "category": "symptom_management",
                    "priority": "medium",
                    "related_to": symptom,
                    "context": "General symptom monitoring",
                }
            )

    return actions


def find_symptom_instruction(note_text, symptom):
    """Find specific instructions for managing a symptom in the note text"""
    # Common instruction phrases
    instruction_patterns = [
        rf"(?:for|with) (?:the|your) {symptom}[,\s]+(?:you should|please) ([^\.]+)",
        rf"(?:to manage|to treat|to handle|for) (?:the|your) {symptom}[,\s]+([^\.]+)",
        rf"(?:I recommend|I suggest|try|consider) ([^\.]+) for (?:the|your) {symptom}",
        rf"{symptom}[^\.]+ (?:can be managed by|can be treated with|should be) ([^\.]+)",
    ]

    for pattern in instruction_patterns:
        match = re.search(pattern, note_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return None


def generate_medication_actions(medications, note_text):
    """Generate action items based on medications"""
    actions = []

    for medication in medications:
        # Extract medication name from potentially complex string
        med_parts = medication.split(" ")
        med_name = med_parts[0]  # Default to first word as medication name

        # Look for dosing instructions in the original text
        dosing_instruction = find_medication_instruction(note_text, med_name)

        # Create the action based on whether we found specific instructions
        if dosing_instruction:
            action_text = f"Take {med_name} {dosing_instruction}"
        else:
            action_text = f"Take {medication} as prescribed"

        # Add medication adherence action
        actions.append(
            {
                "action": action_text,
                "category": "medication",
                "priority": "high",
                "related_to": med_name,
                "context": "Medication adherence",
            }
        )

        # Check if it's a new medication (look for keywords in note)
        new_med_pattern = rf"(?:start|begin|new|prescrib\w+|initiat\w+)[^\.]*{med_name}"
        if re.search(new_med_pattern, note_text, re.IGNORECASE):
            actions.append(
                {
                    "action": f"Watch for side effects from {med_name} and report them to your doctor",
                    "category": "medication_monitoring",
                    "priority": "high",
                    "related_to": med_name,
                    "context": "New medication monitoring",
                }
            )

        # Check for refill instructions
        refill_pattern = (
            rf"(?:refill|renew)[^\.]*{med_name}[^\.]* (?:in|after|before) ([^\.]+)"
        )
        refill_match = re.search(refill_pattern, note_text, re.IGNORECASE)
        if refill_match:
            actions.append(
                {
                    "action": f"Refill {med_name} {refill_match.group(1)}",
                    "category": "medication_refill",
                    "priority": "medium",
                    "related_to": med_name,
                    "context": "Medication refill",
                }
            )

    return actions


def find_medication_instruction(note_text, medication):
    """Find specific dosing instructions for a medication in the note text"""
    # Common dosing instruction patterns
    instruction_patterns = [
        rf"{medication}[^\.]* (\d+\s*\w+(?:\s+\d+\s*\w+)?\s+(?:once|twice|three times|every|daily|weekly|monthly)[^\.]+)",
        rf"[tT]ake[^\.]* {medication}[^\.]* (\d+\s*\w+(?:\s+\d+\s*\w+)?\s+(?:once|twice|three times|every|daily|weekly|monthly)[^\.]+)",
        rf"{medication}[^\.]* (\d+\s*\w+(?:\s+\d+\s*\w+)?)[^\.]* (?:once|twice|three times|every|daily|weekly|monthly)[^\.]+",
        rf"[pP]rescrib\w+[^\.]* {medication}[^\.]* (\d+\s*\w+(?:\s+\d+\s*\w+)?)[^\.]* (?:once|twice|three times|every|daily|weekly|monthly)[^\.]+",
    ]

    for pattern in instruction_patterns:
        match = re.search(pattern, note_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    return None


def generate_lifestyle_actions(lifestyle_info, note_text):
    """Generate action items based on lifestyle recommendations"""
    actions = []

    # Extract explicit lifestyle recommendations from the note text
    lifestyle_patterns = [
        r"(?:recommend|suggest|advise)[^\.]* (?:to) ([^\.]+) (?:for|to improve)",
        r"(?:increase|decrease|reduce|limit|avoid|quit)[^\.]* ([^\.]+)",
        r"(?:exercise|diet|nutrition|sleep|stress)[^\.]* (?:should|need to|must) ([^\.]+)",
        r"(?:important|essential|crucial|critical) (?:to|that you) ([^\.]+)",
    ]

    lifestyle_recommendations = []

    for pattern in lifestyle_patterns:
        matches = re.finditer(pattern, note_text, re.IGNORECASE)
        for match in matches:
            recommendation = match.group(1).strip()
            if len(recommendation) > 10:  # Ensure it's a substantial recommendation
                lifestyle_recommendations.append(recommendation)

    # Add the extracted lifestyle recommendations
    for recommendation in lifestyle_recommendations:
        actions.append(
            {
                "action": recommendation.capitalize()
                if not recommendation[0].isupper()
                else recommendation,
                "category": "lifestyle",
                "priority": "medium",
                "context": "Lifestyle recommendation",
            }
        )

    # Process structured lifestyle data if available
    if isinstance(lifestyle_info, list):
        for habit in lifestyle_info:
            if isinstance(habit, dict) and "habit" in habit:
                habit_name = habit.get("habit")

                # Handle common habits with standard recommendations
                if habit_name:
                    habit_lower = habit_name.lower()

                    if "smoking" in habit_lower or "smoke" in habit_lower:
                        actions.append(
                            {
                                "action": "Work on reducing or quitting smoking",
                                "category": "lifestyle",
                                "priority": "high",
                                "related_to": habit_name,
                                "context": "For improved health",
                            }
                        )

                    elif "alcohol" in habit_lower or "drinking" in habit_lower:
                        actions.append(
                            {
                                "action": "Limit alcohol consumption as discussed",
                                "category": "lifestyle",
                                "priority": "medium",
                                "related_to": habit_name,
                                "context": "For improved health",
                            }
                        )

                    elif "drug" in habit_lower:
                        actions.append(
                            {
                                "action": "Avoid recreational drug use",
                                "category": "lifestyle",
                                "priority": "high",
                                "related_to": habit_name,
                                "context": "For health and safety",
                            }
                        )

    return actions


def generate_complaint_actions(complaints, note_text):
    """Generate action items for the doctor based on chief complaints"""
    actions = []

    for complaint in complaints:
        # Default action for follow-up
        actions.append(
            {
                "action": f"Follow up on {complaint} at next visit",
                "category": "follow_up",
                "priority": "medium",
                "related_to": complaint,
                "context": "Chief complaint follow-up",
            }
        )

        # Look for specific doctor actions mentioned in the note for this complaint
        complaint_patterns = [
            rf"(?:I'll|I will|we'll|we will|need to)[^\.]* (?:check|evaluate|assess|monitor|review)[^\.]* {complaint}[^\.]* (?:at|during|in|next)[^\.]+",
            rf"(?:let's|let us|will)[^\.]* (?:see|check|evaluate|assess|review)[^\.]* {complaint}[^\.]* (?:again|next)[^\.]+",
            rf"(?:important|essential|critical|crucial)[^\.]* (?:to|that I)[^\.]* (?:review|check|evaluate|monitor|follow up on)[^\.]* {complaint}",
        ]

        for pattern in complaint_patterns:
            match = re.search(pattern, note_text, re.IGNORECASE)
            if match:
                action_text = match.group(0).strip()
                actions.append(
                    {
                        "action": action_text,
                        "category": "specific_follow_up",
                        "priority": "high",
                        "related_to": complaint,
                        "context": "Explicit doctor note",
                    }
                )
                break

        # Check for specific conditions that might need tests
        lower_complaint = complaint.lower()

        if (
            "chest pain" in lower_complaint
            or "chest discomfort" in lower_complaint
            or "heart" in lower_complaint
        ):
            actions.append(
                {
                    "action": "Consider EKG or cardiac evaluation",
                    "category": "diagnostic",
                    "priority": "high",
                    "related_to": complaint,
                    "context": "For cardiac evaluation",
                }
            )

        elif (
            "breath" in lower_complaint
            or "cough" in lower_complaint
            or "lung" in lower_complaint
        ):
            actions.append(
                {
                    "action": "Consider pulmonary function tests or chest imaging",
                    "category": "diagnostic",
                    "priority": "medium",
                    "related_to": complaint,
                    "context": "For respiratory evaluation",
                }
            )

        elif "headache" in lower_complaint or "migraine" in lower_complaint:
            actions.append(
                {
                    "action": "Monitor headache frequency and intensity",
                    "category": "monitoring",
                    "priority": "medium",
                    "related_to": complaint,
                    "context": "For headache management",
                }
            )

        elif "pain" in lower_complaint:
            actions.append(
                {
                    "action": f"Evaluate pain management effectiveness for {complaint}",
                    "category": "treatment",
                    "priority": "high",
                    "related_to": complaint,
                    "context": "For pain management",
                }
            )

    return actions


def generate_follow_up_recommendation(
    complaints, symptoms, chronic_diseases, patient_name, note_text
):
    """Generate follow-up recommendation based on the medical context"""
    today = datetime.now()

    # First check for explicit follow-up timing in the note
    follow_up_match = re.search(
        r"(?:follow up|follow-up|see me|come back)[^\.]* (?:in|after) ([^\.,]+)",
        note_text,
        re.IGNORECASE,
    )

    if follow_up_match:
        time_frame = follow_up_match.group(1).strip().lower()

        # Calculate date based on time frame
        if "week" in time_frame:
            weeks = extract_number_from_text(time_frame)
            follow_up_date = (today + timedelta(weeks=weeks or 1)).strftime("%Y-%m-%d")
            return {
                "date": follow_up_date,
                "urgency": "soon" if weeks and weeks <= 2 else "routine",
            }

        elif "month" in time_frame:
            months = extract_number_from_text(time_frame)
            follow_up_date = (today + timedelta(days=(months or 1) * 30)).strftime(
                "%Y-%m-%d"
            )
            return {"date": follow_up_date, "urgency": "routine"}

        elif "day" in time_frame:
            days = extract_number_from_text(time_frame)
            follow_up_date = (today + timedelta(days=days or 7)).strftime("%Y-%m-%d")
            return {
                "date": follow_up_date,
                "urgency": "urgent" if days and days <= 7 else "soon",
            }

    # If no explicit mention, use heuristics

    # Initialize with a default follow-up
    follow_up = {
        "date": (today + timedelta(days=30)).strftime("%Y-%m-%d"),
        "urgency": "routine",
    }

    # Check for urgent conditions that require immediate follow-up
    urgent_keywords = ["severe", "acute", "intense", "worst", "emergency", "unbearable"]
    urgent_symptoms = [
        "chest pain",
        "difficulty breathing",
        "shortness of breath",
        "severe pain",
    ]

    # Check complaints and symptoms for urgent conditions
    all_issues = complaints + symptoms

    for issue in all_issues:
        issue_lower = issue.lower()

        # Check for urgent keywords
        if any(keyword in issue_lower for keyword in urgent_keywords):
            follow_up["date"] = (today + timedelta(days=7)).strftime("%Y-%m-%d")
            follow_up["urgency"] = "urgent"
            break

        # Check for urgent symptoms
        if any(symptom in issue_lower for symptom in urgent_symptoms):
            follow_up["date"] = (today + timedelta(days=7)).strftime("%Y-%m-%d")
            follow_up["urgency"] = "urgent"
            break

    # If patient has chronic diseases, recommend a sooner follow-up
    if chronic_diseases and not follow_up["urgency"] == "urgent":
        follow_up["date"] = (today + timedelta(days=14)).strftime("%Y-%m-%d")

    return follow_up


def extract_number_from_text(text):
    """Extract a number from text like 'two weeks' or '3 months'"""
    # First try to find numeric value
    num_match = re.search(r"(\d+)", text)
    if num_match:
        return int(num_match.group(1))

    # If no numeric value, check for written numbers
    word_to_num = {
        "one": 1,
        "two": 2,
        "three": 3,
        "four": 4,
        "five": 5,
        "six": 6,
        "seven": 7,
        "eight": 8,
        "nine": 9,
        "ten": 10,
        "eleven": 11,
        "twelve": 12,
        "couple": 2,
        "few": 3,
        "several": 4,
    }

    for word, num in word_to_num.items():
        if word in text:
            return num

    # Default to None if no number found
    return None


def extract_explicit_instructions(note_text):
    """Extract explicit instructions from the note text"""
    instructions = {"patient": [], "doctor": []}

    # Patterns for patient instructions
    patient_patterns = [
        r"(?:you should|you need to|make sure to|be sure to|remember to|don't forget to|please) ([^\.]+)",
        r"(?:I want you to|I'd like you to|I recommend|I suggest) ([^\.]+)",
        r"(?:it's important|it is important|it's crucial|it is crucial) (?:to|that you) ([^\.]+)",
    ]

    # Patterns for doctor's own reminders
    doctor_patterns = [
        r"(?:I should|I need to|I'll|I will|we should|we need to|we'll|we will) ([^\.]+)",
        r"(?:need to|should|must|have to|let's|we'll) (?:check|follow up on|remember|monitor|track|review) ([^\.]+)",
        r"(?:remember to|don't forget to|make a note to) ([^\.]+)",
    ]

    # Extract patient instructions
    for pattern in patient_patterns:
        matches = re.finditer(pattern, note_text, re.IGNORECASE)
        for match in matches:
            instruction = match.group(1).strip()
            if len(instruction) > 5 and not any(
                i.lower() == instruction.lower() for i in instructions["patient"]
            ):
                instructions["patient"].append(instruction)

    # Extract doctor reminders
    for pattern in doctor_patterns:
        matches = re.finditer(pattern, note_text, re.IGNORECASE)
        for match in matches:
            try:
                # Different patterns may have the instruction in different capture groups
                instruction = (
                    match.group(1).strip() if match.group(1) else match.group(0).strip()
                )
                if len(instruction) > 5 and not any(
                    i.lower() == instruction.lower() for i in instructions["doctor"]
                ):
                    instructions["doctor"].append(instruction)
            except IndexError:
                continue

    return instructions


def extract_tests_and_referrals(note_text):
    """Extract mentioned tests or referrals from the note text"""
    test_referrals = []

    # Look for test patterns
    test_patterns = [
        r"(?:order|get|need|require|recommend)(?:\s+an?)?\s+([\w\s]+(?:test|scan|x-ray|mri|ct|ultrasound|blood\s+work))",
        r"(?:refer|send)(?:\s+to)?\s+(?:a|an)?\s+([\w\s]+(?:specialist|doctor|cardiologist|neurologist|dermatologist|surgeon))",
    ]

    for pattern in test_patterns:
        matches = re.finditer(pattern, note_text, re.IGNORECASE)
        for match in matches:
            item_name = match.group(1).strip()

            # Determine if it's a test or referral
            item_type = (
                "test"
                if any(
                    word in item_name.lower()
                    for word in [
                        "test",
                        "scan",
                        "x-ray",
                        "mri",
                        "ct",
                        "ultrasound",
                        "blood",
                    ]
                )
                else "referral"
            )

            test_referrals.append({"name": item_name, "type": item_type})

    return test_referrals
