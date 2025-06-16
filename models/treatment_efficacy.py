# models/treatment_efficacy.py
"""
Treatment Efficacy Analyzer module for Health Companion app
"""

import json
import sqlite3
import re
from datetime import datetime
from models.database import DB_PATH


def get_patient_notes(patient_name):
    """Get all notes for a specific patient"""
    # Try to use the imported DB_PATH or define it if import fails
    try:
        # Try to use the imported DB_PATH
        use_db_path = DB_PATH
        print(f"Using imported DB_PATH: {DB_PATH}")
    except NameError:
        # If DB_PATH is not defined, create a fallback path
        import os

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        use_db_path = os.path.join(base_dir, "instance", "health_companion.db")
        print(f"Import failed, using fallback DB_PATH: {use_db_path}")

    # Check if the database file exists
    import os

    if not os.path.exists(use_db_path):
        print(f"WARNING: Database file not found at {use_db_path}")
        # Try to locate it
        possible_locations = [
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)), "health_companion.db"
            ),
            os.path.join(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                "health_companion.db",
            ),
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "instance",
                "health_companion.db",
            ),
            "medical_notes.db",  # Try in current directory
        ]

        for loc in possible_locations:
            if os.path.exists(loc):
                use_db_path = loc
                print(f"Found database at alternative location: {use_db_path}")
                break

    try:
        conn = sqlite3.connect(use_db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
        SELECT n.id, n.text, n.created_at, s.summary_data
        FROM notes n
        LEFT JOIN summaries s ON n.id = s.note_id
        ORDER BY n.created_at
        """)

        notes = []
        patient_name_lower = patient_name.lower().strip() if patient_name else ""

        print(f"Looking for notes for patient: {patient_name}")

        for row in cursor.fetchall():
            note = {
                "id": row["id"],
                "original": row["text"],
                "created_at": row["created_at"],
            }

            if row["summary_data"]:
                try:
                    summary = json.loads(row["summary_data"])

                    # Print summary structure for debugging
                    print(f"Note {row['id']} summary keys: {', '.join(summary.keys())}")

                    # Check if the summary has patient details
                    if "patient_details" in summary:
                        # Make sure patient_details is not None before accessing
                        if summary["patient_details"] is not None:
                            # Get name with fallback to empty string
                            db_patient_name = (
                                (summary["patient_details"].get("name") or "")
                                .lower()
                                .strip()
                            )

                            # Debug output
                            print(
                                f"Found note with patient: '{db_patient_name}', comparing to: '{patient_name_lower}'"
                            )

                            # More flexible matching - if the patient name from the database
                            # contains or is contained by the requested patient name
                            if db_patient_name and (
                                db_patient_name == patient_name_lower
                                or db_patient_name in patient_name_lower
                                or patient_name_lower in db_patient_name
                            ):
                                note["summary"] = summary
                                notes.append(note)
                                print(
                                    f"Added note id {row['id']} for patient matching: {db_patient_name}"
                                )
                        else:
                            print(f"Note {row['id']} has patient_details=None")

                    # Try alternative patient name locations if standard location not found
                    elif (
                        "patient" in summary
                        and isinstance(summary["patient"], dict)
                        and "name" in summary["patient"]
                    ):
                        # Get name with fallback to empty string
                        db_patient_name = (
                            (summary["patient"].get("name") or "").lower().strip()
                        )

                        print(
                            f"Found note with patient in alternative location: '{db_patient_name}'"
                        )

                        if db_patient_name and (
                            db_patient_name == patient_name_lower
                            or db_patient_name in patient_name_lower
                            or patient_name_lower in db_patient_name
                        ):
                            # Create a compatible structure
                            summary["patient_details"] = {
                                "name": summary["patient"].get("name") or ""
                            }
                            note["summary"] = summary
                            notes.append(note)
                            print(
                                f"Added note id {row['id']} using alternative patient location"
                            )

                    elif "patient_name" in summary:
                        # Get value with fallback to empty string
                        db_patient_name = (
                            (summary["patient_name"] or "").lower().strip()
                        )

                        print(
                            f"Found note with direct patient_name field: '{db_patient_name}'"
                        )

                        if db_patient_name and (
                            db_patient_name == patient_name_lower
                            or db_patient_name in patient_name_lower
                            or patient_name_lower in db_patient_name
                        ):
                            # Create a compatible structure
                            summary["patient_details"] = {
                                "name": summary["patient_name"] or ""
                            }
                            note["summary"] = summary
                            notes.append(note)
                            print(
                                f"Added note id {row['id']} using direct patient_name field"
                            )

                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON for note {row['id']}: {e}")
                    continue
                except Exception as e:
                    print(f"Error processing note {row['id']}: {e}")
                    continue

        conn.close()
        print(f"Found {len(notes)} notes for patient: {patient_name}")
        return notes

    except Exception as e:
        print(f"Error in get_patient_notes: {str(e)}")
        import traceback

        traceback.print_exc()
        return []


def extract_symptom_severity(note_text, symptom):
    """
    Extract the severity of a symptom from the note text

    Args:
        note_text (str): The full note text
        symptom (str): The symptom to look for

    Returns:
        str: Severity level or None if not found
    """
    # Guard against None values
    if note_text is None or symptom is None:
        return None

    # Look for severity indicators near the symptom in the text
    patterns = [
        rf"{symptom}.*?(mild|moderate|severe|extreme)",
        rf"{symptom}.*?(\d+)/10",
        rf"{symptom}.*?intensity of (\d+)",
        rf"{symptom}.*?(?:rated|scale|score)[^\d]*(\d+)",
        rf"(mild|moderate|severe|extreme).*?{symptom}",
    ]

    for pattern in patterns:
        try:
            match = re.search(pattern, note_text, re.IGNORECASE)
            if match:
                return match.group(1).lower()
        except Exception as e:
            print(f"Error in regex search for severity: {e}")
            continue

    # Look for severity keywords in context
    keywords = {
        "mild": 1,
        "minimal": 1,
        "slight": 1,
        "moderate": 2,
        "significant": 2,
        "severe": 3,
        "extreme": 4,
        "intense": 3,
        "debilitating": 4,
        "worst": 4,
    }

    symptom_context = extract_symptom_context(note_text, symptom)
    if symptom_context:
        for keyword, value in keywords.items():
            if keyword in symptom_context.lower():
                return str(value)

    return None


def extract_symptom_context(note_text, symptom, window_size=100):
    """Extract text around the symptom for context"""
    # Guard against None values
    if note_text is None or symptom is None:
        return None

    # Escape regex special characters in the symptom
    try:
        safe_symptom = re.escape(symptom)

        match = re.search(
            rf"(.{{0,{window_size}}}{safe_symptom}.{{0,{window_size}}})",
            note_text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1)
    except Exception as e:
        print(f"Error extracting symptom context: {e}")

    return None


def extract_improvement_mentions(note_text):
    """
    Extract mentions of symptoms improving or worsening

    Args:
        note_text (str): The note text to analyze

    Returns:
        list: List of improvement/worsening mentions
    """
    # Guard against None values
    if note_text is None:
        return []

    mentions = []

    # Patterns for improvement
    improvement_patterns = [
        r"(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:has|have|is|are)\s+(?:improved|better|decreased|reduced|subsided)",
        r"(?:improvement|decrease|reduction)\s+in\s+(?:the|my|her|his|their)\s+([^\.]+)",
        r"(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:is|are)\s+(?:less|not as)\s+(?:severe|intense|painful|frequent)",
        r"(?:report|mention|note)\s+(?:that|of)\s+(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:is|has|have)\s+(?:improved|better)",
    ]

    # Patterns for worsening
    worsening_patterns = [
        r"(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:has|have|is|are)\s+(?:worse|worsened|increased|intensified)",
        r"(?:worsening|increase|intensification)\s+in\s+(?:the|my|her|his|their)\s+([^\.]+)",
        r"(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:is|are)\s+(?:more)\s+(?:severe|intense|painful|frequent)",
        r"(?:report|mention|note)\s+(?:that|of)\s+(?:the|my|her|his|their)\s+([^\.]+?)\s+(?:is|has|have)\s+(?:worse|worsened)",
    ]

    # Extract improvements
    for pattern in improvement_patterns:
        try:
            matches = re.finditer(pattern, note_text, re.IGNORECASE)
            for match in matches:
                symptom_text = match.group(1).strip()
                # Filter out non-symptom matches
                if len(symptom_text) > 3 and not symptom_text.lower().startswith(
                    ("i ", "he ", "she ", "they ", "we ")
                ):
                    mentions.append(
                        {
                            "symptom": clean_symptom_name(symptom_text),
                            "change": "improved",
                            "text": match.group(0),
                        }
                    )
        except Exception as e:
            print(f"Error extracting improvement mentions: {e}")
            continue

    # Extract worsenings
    for pattern in worsening_patterns:
        try:
            matches = re.finditer(pattern, note_text, re.IGNORECASE)
            for match in matches:
                symptom_text = match.group(1).strip()
                # Filter out non-symptom matches
                if len(symptom_text) > 3 and not symptom_text.lower().startswith(
                    ("i ", "he ", "she ", "they ", "we ")
                ):
                    mentions.append(
                        {
                            "symptom": clean_symptom_name(symptom_text),
                            "change": "worsened",
                            "text": match.group(0),
                        }
                    )
        except Exception as e:
            print(f"Error extracting worsening mentions: {e}")
            continue

    return mentions


def analyze_treatment_efficacy(patient_name):
    """
    Analyze the efficacy of treatments across multiple visits for a specific patient

    Args:
        patient_name (str): Name of the patient to analyze

    Returns:
        dict: Analysis of treatment efficacy
    """
    # Fetch all notes for this patient
    notes = get_patient_notes(patient_name)
    if not notes or len(notes) < 2:
        return {
            "error": "Insufficient notes found for this patient. At least two visits are required for analysis."
        }

    # Sort notes by date
    notes.sort(key=lambda x: x.get("created_at", ""))

    # Extract treatments and symptoms over time
    treatments_timeline = []
    symptoms_timeline = []

    for note in notes:
        visit_date = note.get("created_at")
        note_id = note.get("id")
        note_text = note.get("original", "")

        # Get medications/treatments from this visit
        if note.get("summary") and note["summary"].get("drug_history"):
            for treatment in note["summary"]["drug_history"]:
                treatments_timeline.append(
                    {
                        "date": visit_date,
                        "treatment": treatment,
                        "note_id": note_id,
                        "dosage": extract_dosage(treatment, note_text),
                    }
                )

        # Get symptoms from this visit
        if note.get("summary") and note["summary"].get("symptoms"):
            for symptom in note["summary"]["symptoms"]:
                severity = extract_symptom_severity(note_text, symptom)
                symptoms_timeline.append(
                    {
                        "date": visit_date,
                        "symptom": symptom,
                        "severity": severity,
                        "note_id": note_id,
                        "raw_text": extract_symptom_context(note_text, symptom, 150),
                    }
                )

        # Also look for explicit mentions of improvement/worsening in the text
        improvement_mentions = extract_improvement_mentions(note_text)
        for mention in improvement_mentions:
            # Check if this mention matches any known symptom
            matched_symptom = None
            for symptom_entry in symptoms_timeline:
                if symptom_entry["symptom"].lower() in mention["text"].lower():
                    matched_symptom = symptom_entry["symptom"]
                    break

            # If no match, use the extracted symptom from the mention
            if not matched_symptom:
                matched_symptom = mention.get("symptom", "Unnamed symptom")

            symptoms_timeline.append(
                {
                    "date": visit_date,
                    "symptom": matched_symptom,
                    "severity": None,  # No explicit severity
                    "note_id": note_id,
                    "change": mention["change"],  # 'improved' or 'worsened'
                    "raw_text": mention["text"],
                }
            )

    # Analyze the correlation between treatments and symptom changes
    efficacy_analysis = []

    # Group symptoms by name to track over time
    symptom_groups = {}
    for entry in symptoms_timeline:
        symptom = entry["symptom"]
        if symptom not in symptom_groups:
            symptom_groups[symptom] = []
        symptom_groups[symptom].append(entry)

    # For each symptom, analyze treatments that might have affected it
    for symptom, occurrences in symptom_groups.items():
        if len(occurrences) < 2:
            continue  # Need at least two occurrences to analyze change

        # Sort by date
        sorted_occurrences = sorted(occurrences, key=lambda x: x["date"])

        for i in range(1, len(sorted_occurrences)):
            current = sorted_occurrences[i]
            previous = sorted_occurrences[i - 1]

            # Determine if the symptom improved or worsened
            if "change" in current:
                # If we have an explicit change mention, use that
                severity_change = current["change"]
            else:
                # Otherwise compare severities
                severity_change = compare_severity(
                    current.get("severity"), previous.get("severity")
                )

            # Skip if no change detected
            if severity_change == "unchanged":
                continue

            # Find treatments that were started between these two visits
            new_treatments = find_treatments_between_dates(
                treatments_timeline, previous["date"], current["date"]
            )

            if new_treatments:
                efficacy_analysis.append(
                    {
                        "symptom": symptom,
                        "change": severity_change,
                        "from_date": previous["date"],
                        "to_date": current["date"],
                        "treatments": new_treatments,
                        "correlation": "positive"
                        if severity_change == "improved"
                        else "negative",
                        "evidence": current.get("raw_text", ""),
                    }
                )

    # Generate an overall effectiveness report
    treatment_effectiveness = {}

    for entry in efficacy_analysis:
        for treatment in entry["treatments"]:
            treatment_name = extract_base_med_name(treatment["treatment"])

            if treatment_name not in treatment_effectiveness:
                treatment_effectiveness[treatment_name] = {
                    "positive": 0,
                    "negative": 0,
                    "symptoms_improved": [],
                    "symptoms_worsened": [],
                    "latest_dosage": treatment.get("dosage"),
                    "evidence": [],
                }

            if entry["correlation"] == "positive":
                treatment_effectiveness[treatment_name]["positive"] += 1
                if (
                    entry["symptom"]
                    not in treatment_effectiveness[treatment_name]["symptoms_improved"]
                ):
                    treatment_effectiveness[treatment_name]["symptoms_improved"].append(
                        entry["symptom"]
                    )
                # Add the evidence text
                treatment_effectiveness[treatment_name]["evidence"].append(
                    {
                        "type": "improvement",
                        "symptom": entry["symptom"],
                        "text": entry["evidence"],
                    }
                )
            # Continuing models/treatment_efficacy.py
            else:
                treatment_effectiveness[treatment_name]["negative"] += 1
                if (
                    entry["symptom"]
                    not in treatment_effectiveness[treatment_name]["symptoms_worsened"]
                ):
                    treatment_effectiveness[treatment_name]["symptoms_worsened"].append(
                        entry["symptom"]
                    )
                # Add the evidence text
                treatment_effectiveness[treatment_name]["evidence"].append(
                    {
                        "type": "worsening",
                        "symptom": entry["symptom"],
                        "text": entry["evidence"],
                    }
                )

    # Calculate effectiveness scores
    for treatment, data in treatment_effectiveness.items():
        total_effects = data["positive"] + data["negative"]
        if total_effects > 0:
            data["effectiveness_score"] = (data["positive"] / total_effects) * 100
        else:
            data["effectiveness_score"] = 0

    # Get dosage change information
    dosage_changes = track_dosage_changes(treatments_timeline)

    # Add dosage changes to the analysis
    for treatment, changes in dosage_changes.items():
        if treatment in treatment_effectiveness:
            treatment_effectiveness[treatment]["dosage_changes"] = changes

    return {
        "patient_name": patient_name,
        "analysis_date": datetime.now().isoformat(),
        "treatment_effectiveness": treatment_effectiveness,
        "detailed_analysis": efficacy_analysis,
    }


def clean_symptom_name(symptom_text):
    """Clean up extracted symptom text"""
    # Guard against None values
    if symptom_text is None:
        return ""

    # Remove common non-symptom words
    stopwords = ["a", "an", "the", "this", "that", "these", "those", "some", "any"]

    words = symptom_text.split()
    if words and words[0].lower() in stopwords:
        symptom_text = " ".join(words[1:])

    return symptom_text


def find_treatments_between_dates(treatments_timeline, start_date, end_date):
    """Find treatments that were started between two dates"""
    treatments = []

    for entry in treatments_timeline:
        if start_date < entry["date"] <= end_date:
            # Check if this treatment is already in the list
            if not any(t["treatment"] == entry["treatment"] for t in treatments):
                treatments.append(entry)

    return treatments


def compare_severity(current, previous):
    """Compare symptom severities to determine if condition improved or worsened"""
    if current is None or previous is None:
        return "unchanged"

    # If the severity is a number out of 10
    if (
        isinstance(current, str)
        and "/" in current
        and isinstance(previous, str)
        and "/" in previous
    ):
        try:
            current_num = int(current.split("/")[0])
            previous_num = int(previous.split("/")[0])
            if current_num < previous_num:
                return "improved"
            elif current_num > previous_num:
                return "worsened"
            else:
                return "unchanged"
        except (ValueError, IndexError):
            pass

    # If the severity is a numeric value
    try:
        current_val = int(current)
        previous_val = int(previous)
        if current_val < previous_val:
            return "improved"
        elif current_val > previous_val:
            return "worsened"
        else:
            return "unchanged"
    except (ValueError, TypeError):
        pass

    # If the severity is a string
    severity_ranks = {
        "mild": 1,
        "minimal": 1,
        "slight": 1,
        "moderate": 2,
        "significant": 2,
        "severe": 3,
        "extreme": 4,
        "intense": 3,
        "debilitating": 4,
    }

    if isinstance(current, str) and isinstance(previous, str):
        current_rank = severity_ranks.get(current.lower(), 0)
        previous_rank = severity_ranks.get(previous.lower(), 0)

        if current_rank < previous_rank:
            return "improved"
        elif current_rank > previous_rank:
            return "worsened"

    return "unchanged"


def extract_dosage(medication, note_text):
    """Extract dosage information for a medication"""
    # Extract the base medication name (without dosage)
    base_name = extract_base_med_name(medication)

    # Look for dosage information in the text
    dosage_patterns = [
        rf"{base_name}\s+(\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill)(?:/day|/daily|daily|twice daily|BID|TID|QID)?)",
        rf"{base_name}[^\.]*?(\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill)(?:/day|/daily|daily|twice daily|BID|TID|QID)?)",
        rf"(?:prescribed|taking|started|initiated)\s+{base_name}\s+(\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill)(?:/day|/daily|daily|twice daily|BID|TID|QID)?)",
        rf"(?:prescribed|taking|started|initiated)[^\.]*?{base_name}[^\.]*?(\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill)(?:/day|/daily|daily|twice daily|BID|TID|QID)?)",
    ]

    for pattern in dosage_patterns:
        match = re.search(pattern, note_text, re.IGNORECASE)
        if match:
            return match.group(1).strip()

    # If no dosage found in text but it's in the medication string
    dosage_match = re.search(
        r"(\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill))", medication, re.IGNORECASE
    )
    if dosage_match:
        return dosage_match.group(1).strip()

    return None


def extract_base_med_name(medication):
    """Extract the base medication name without dosage"""
    # Remove dosage information
    base_name = re.sub(
        r"\s+\d+\s*(?:mg|mcg|g|ml|tablet|tabs|cap|pill).*",
        "",
        medication,
        flags=re.IGNORECASE,
    )

    # Remove frequency information
    base_name = re.sub(
        r"\s+(?:once|twice|three times|daily|BID|TID|QID).*",
        "",
        base_name,
        flags=re.IGNORECASE,
    )

    return base_name.strip()


def track_dosage_changes(treatments_timeline):
    """
    Track changes in medication dosages over time

    Args:
        treatments_timeline (list): List of treatments with dates

    Returns:
        dict: Dictionary of treatments with dosage changes
    """
    dosage_changes = {}

    # Group treatments by base name
    grouped_treatments = {}
    for treatment in treatments_timeline:
        base_name = extract_base_med_name(treatment["treatment"])
        if base_name not in grouped_treatments:
            grouped_treatments[base_name] = []
        grouped_treatments[base_name].append(treatment)

    # For each medication, track dosage changes
    for med_name, treatments in grouped_treatments.items():
        # Sort by date
        sorted_treatments = sorted(treatments, key=lambda x: x["date"])

        # Track changes
        changes = []
        previous_dosage = None

        for treatment in sorted_treatments:
            current_dosage = treatment.get("dosage")

            if current_dosage and previous_dosage and current_dosage != previous_dosage:
                changes.append(
                    {
                        "date": treatment["date"],
                        "from": previous_dosage,
                        "to": current_dosage,
                    }
                )

            if current_dosage:
                previous_dosage = current_dosage

        if changes:
            dosage_changes[med_name] = changes

    return dosage_changes
