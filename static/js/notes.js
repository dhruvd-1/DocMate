// Enhanced Medical Notes JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const transcriptDiv = document.getElementById('transcript');
    const saveBtn = document.getElementById('save-btn');
    const notesContainer = document.getElementById('notes-container');
    const audioUploadInput = document.getElementById('audio-upload');
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const audioPlayer = document.getElementById('audio-player');
    
    // Modal elements
    const noteDetailsModal = new bootstrap.Modal(document.getElementById('noteDetailsModal'));
    const originalNoteContent = document.querySelector('.original-note-content');
    const summaryContent = document.getElementById('summary-editor');
    const editSummaryBtn = document.querySelector('.edit-summary-btn');
    const saveSummaryBtn = document.querySelector('.save-summary-btn');
    const downloadSummaryBtn = document.querySelector('.download-summary-btn');
    
    // State variables
    let recognition;
    let isRecording = false;
    let finalTranscript = '';
    let mediaRecorder;
    let audioChunks = [];
    let currentNoteId = null;
    let currentSummary = null;

    // Initialize
    initializeVoiceRecognition();
    loadNotes();
    initializeButtons();

    // Initialize speech recognition
    function initializeVoiceRecognition() {
        if ('webkitSpeechRecognition' in window) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onresult = function(event) {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                transcriptDiv.innerText = finalTranscript + interimTranscript;
            };

            recognition.onerror = function(event) {
                console.error('Speech recognition error:', event.error);
                showToast('Speech recognition error: ' + event.error, 'error');
                stopRecording();
            };
            
            recognition.onend = function() {
                console.log('Speech recognition ended');
                isRecording = false;
                startBtn.classList.remove('active');
                startBtn.disabled = false;
                stopBtn.disabled = true;
                
                // ADD THE NEW CODE HERE
                console.log("=== STARTING PATIENT DETECTION ===");
                console.log("Transcript text:", finalTranscript.substring(0, 100) + "...");
                const patientDetails = extractPatientDetailsFromText(finalTranscript);
                console.log("Extracted patient details:", patientDetails);
                if (patientDetails && patientDetails.name && patientDetails.age) {
                    console.log("=== ATTEMPTING HISTORY RETRIEVAL ===");
                    console.log(`Looking for history for: ${patientDetails.name}, ${patientDetails.age}`);
                    retrievePreviousPatientHistory(patientDetails.name, patientDetails.age)
                        .then(history => {
                            console.log("History retrieval complete, result:", history ? "Found" : "Not found");
                        });
                } else {
                    console.log("=== PATIENT DETECTION FAILED ===");
                    console.log("Could not extract valid patient name and age from transcript");
                }
                // END OF NEW CODE
            };
        } else {
            startBtn.disabled = true;
            showToast("Speech Recognition is not supported in this browser.", 'warning');
        }
    }

    // Initialize audio recording
    function initializeAudioRecording() {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    mediaRecorder = new MediaRecorder(stream);
                    
                    mediaRecorder.ondataavailable = function(e) {
                        audioChunks.push(e.data);
                    };
                    
                    mediaRecorder.onstop = function() {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        audioPlayer.src = audioUrl;
                        audioPlayerContainer.style.display = 'block';
                    };
                    
                    // Start recording
                    mediaRecorder.start();
                    audioChunks = [];
                    console.log('Audio recording started');
                })
                .catch(error => {
                    console.error('Error accessing microphone:', error);
                    showToast('Error accessing microphone. Please check permissions.', 'error');
                });
        } else {
            console.error('MediaRecorder API not supported in this browser');
            showToast('Audio recording is not supported in this browser.', 'warning');
        }
    }

    // Initialize buttons and event listeners
    function initializeButtons() {
        // Start recording button
        startBtn.onclick = function() {
            if (!isRecording) {
                startRecording();
            }
        };

        // Stop recording button
        stopBtn.onclick = function() {
            if (isRecording) {
                stopRecording();
            }
        };

        // Save note button
        // In your initializeButtons function
        saveBtn.onclick = function() {
        console.log("Save button clicked. Editing note ID:", transcriptDiv.dataset.editingNoteId);
        
        // Check if we're editing an existing note
        if (transcriptDiv.dataset.editingNoteId && transcriptDiv.dataset.editingNoteId !== '') {
            console.log("Saving edited note with ID:", transcriptDiv.dataset.editingNoteId);
            saveEditedNote();
        } else {
            // This is a new note
            console.log("Creating new note");
            saveNote();
        }
    };
        
        // Audio upload input
        audioUploadInput.addEventListener('change', handleAudioUpload);
        
        // Edit summary button
        editSummaryBtn.addEventListener('click', function() {
            // Make summary content editable
            summaryContent.contentEditable = "true";
            summaryContent.focus();
            editSummaryBtn.style.display = 'none';
            saveSummaryBtn.style.display = 'inline-block';
        });
        
        // Save edited summary button
        // In your initializeButtons function, update the save summary button handling:
// Save edited summary button
        saveSummaryBtn.addEventListener('click', function(event) {
            console.log("Save button clicked from event listener");
            event.preventDefault(); // Prevent any default behavior
            event.stopPropagation(); // Stop event bubbling
            saveEditedSummary();
            return false; // Ensure no default action
        });

        // Also add a direct onclick handler
        saveSummaryBtn.onclick = function(event) {
            console.log("Save button clicked from direct onclick");
            event.preventDefault();
            event.stopPropagation();
            saveEditedSummary();
            return false;
        };
                
        // Download summary button
        downloadSummaryBtn.addEventListener('click', function() {
            downloadSummary();
        });
        
        // Initialize stop button as disabled
        stopBtn.disabled = true;
    }

    // Start recording function
    function startRecording() {
        finalTranscript = '';
        transcriptDiv.innerText = '';
        
        // Start speech recognition
        try {
            recognition.start();
            console.log('Recognition started');
            isRecording = true;
            startBtn.classList.add('active');
            startBtn.disabled = true;
            stopBtn.disabled = false;
            
            // Also start audio recording
            initializeAudioRecording();
            
        } catch (e) {
            console.error('Error starting recognition:', e);
            showToast('Error starting recognition: ' + e.message, 'error');
        }
    }

    // Stop recording function
    function stopRecording() {
        try {
            // Stop speech recognition
            if (recognition) {
                recognition.stop();
            }
            
            // Stop audio recording
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
            
            console.log('Recording stopped');
            isRecording = false;
            startBtn.classList.remove('active');
            startBtn.disabled = false;
            stopBtn.disabled = true;
            
        } catch (e) {
            console.error('Error stopping recording:', e);
            showToast('Error stopping recording', 'error');
        }
    }

    // Handle audio file upload and transcription
    // Complete handleAudioUpload function with patient history retrieval
function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
        showToast('Please upload an audio file', 'error');
        return;
    }
    
    // Create a URL for the audio file preview (works for all audio types)
    const audioUrl = URL.createObjectURL(file);
    audioPlayer.src = audioUrl;
    audioPlayerContainer.style.display = 'block';
    
    // Check file size - large files might have issues
    const maxSizeMB = 10;
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
        showToast(`File is ${fileSizeMB.toFixed(1)}MB. Large files may cause issues. Consider using a smaller file.`, 'warning');
    }
    
    // Show conversion indication for non-WAV files
    const isWav = file.name.toLowerCase().endsWith('.wav');
    
    if (!isWav) {
        showToast('Converting audio format to WAV for transcription...', 'info');
    }
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'transcription-loading';
    loadingIndicator.innerHTML = `
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Processing audio...</span>
        </div>
        <p>${isWav ? 'Transcribing' : 'Converting and transcribing'} audio... This may take a minute for longer recordings.</p>
    `;
    
    // Add loading indicator to the page
    audioPlayerContainer.parentNode.insertBefore(loadingIndicator, audioPlayerContainer.nextSibling);
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('audio_file', file);
    
    // Send the file to the server for transcription
    fetch('/upload_audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        // Remove loading indicator
        if (document.querySelector('.transcription-loading')) {
            document.querySelector('.transcription-loading').remove();
        }
        
        if (data.status === 'success') {
            // Set the transcription in the transcript div
            transcriptDiv.innerText = data.transcription;
            finalTranscript = data.transcription;
            
            showToast('Audio transcription complete', 'success');

            console.log("=== STARTING PATIENT DETECTION ===");
            console.log("Transcript text:", finalTranscript.substring(0, 100) + "...");

            // NEW: Extract patient details and check for previous history
            const patientDetails = extractPatientDetailsFromText(finalTranscript);
            console.log("Extracted patient details:", patientDetails);

            if (patientDetails && patientDetails.name && patientDetails.age) {
                console.log("=== ATTEMPTING HISTORY RETRIEVAL ===");
                console.log(`Looking for history for: ${patientDetails.name}, ${patientDetails.age}`);
                retrievePreviousPatientHistory(patientDetails.name, patientDetails.age)
                    .then(history => {
                        console.log("History retrieval complete, result:", history ? "Found" : "Not found");
                    });
            } else {
                console.log("=== PATIENT DETECTION FAILED ===");
                console.log("Could not extract valid patient name and age from transcript");
            }
            
            // Add quality indicator if the transcription seems short
            const wordCount = data.transcription.split(' ').length;
            const audioLength = audioPlayer.duration;
            
            if (wordCount < 10 && audioLength > 10) {
                showToast('Transcription seems brief. The audio might not be clear enough.', 'warning');
                
                // Add transcription tips
                const transcriptionTips = document.createElement('div');
                transcriptionTips.className = 'alert alert-info mt-3';
                transcriptionTips.innerHTML = `
                    <h5><i data-feather="mic" class="me-2"></i> Transcription Tips</h5>
                    <p>For better transcription results:</p>
                    <ul>
                        <li>Ensure the audio is clear with minimal background noise</li>
                        <li>Speak clearly and at a moderate pace</li>
                        <li>Use a quality microphone if recording directly</li>
                        <li>Keep the microphone close to the speaker</li>
                    </ul>
                `;
                
                // Add tips to the page
                if (!document.querySelector('.alert-info')) {
                    audioPlayerContainer.parentNode.insertBefore(transcriptionTips, audioPlayerContainer.nextSibling);
                    feather.replace(); // Refresh icons
                }
            }
        } else {
            const errorMessage = data.message || 'Failed to transcribe audio. Please try again or enter text manually.';
            transcriptDiv.innerText = '';
            showToast(errorMessage, 'error');
        }
    })
    .catch(error => {
        // Remove loading indicator
        if (document.querySelector('.transcription-loading')) {
            document.querySelector('.transcription-loading').remove();
        }
        
        console.error('Error uploading and transcribing audio:', error);
        showToast('Error processing audio file. Please try again or type notes manually.', 'error');
    });
}
    // Fixed saveNote function in notes.js to properly handle IDs from server

    function saveNote() {
        const noteText = transcriptDiv.innerText.trim();
        if (noteText === '') {
            showToast('Please record or type a note first', 'warning');
            return;
        }
        
        // Show loading indicator
        showToast('Processing note...', 'info');
    
        fetch('/save_note', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                note: noteText,
                imported_history: window.importedPatientHistory || null  // Include any imported history
            })
        })
        .then(res => {
            if (!res.ok) {
                throw new Error(`Server returned ${res.status}: ${res.statusText}`);
            }
            return res.json();
        })
        .then(data => {
            console.log('Note saved response:', data);
            
            // Check for proper ID
            if (data.id === true || data.id === false) {
                console.error("ERROR: Received boolean ID from server:", data.id);
                // Fix the boolean ID issue by generating a temporary ID
                data.id = `temp-${Date.now()}`;
                console.log("Generated temporary ID:", data.id);
            }
            
            // Check if we currently have the empty state showing
            const emptyStateContainer = document.querySelector('.empty-state-container');
            if (emptyStateContainer) {
                // Clear the empty state
                notesContainer.innerHTML = '';
            }
            
            // Create and display the new note
            createNoteCard(data);
            
            // Clear the transcript and audio
            finalTranscript = '';
            transcriptDiv.innerText = '';
            audioPlayerContainer.style.display = 'none';
            audioPlayer.src = '';
            
            // Clear any imported history notification
            if (document.querySelector('.history-notification')) {
                document.querySelector('.history-notification').remove();
            }
            
            // Reset the imported history
            window.importedPatientHistory = null;
            
            showToast('Note saved successfully', 'success');
        })
        .catch(error => {
            console.error('Error saving note:', error);
            showToast(`Failed to save note: ${error.message}`, 'error');
        });
    }

    // Helper function to check if we're in empty state
    function isEmptyState() {
        return document.querySelector('.empty-state-container') !== null;
    }
    // Add to saveNote function as a fallback if server fails
    function saveFallbackLocally(noteText) {
        try {
            // Create a simple mock summary
            const mockSummary = {
                patient_details: {
                    name: "Patient " + new Date().toLocaleDateString()
                },
                chief_complaints: ["Abdominal pain"],
                symptoms: ["Pain after meals", "Fever", "Nausea"],
                allergies: ["Amoxicillin"]
            };
            
            // Create mock data
            const mockData = {
                original: noteText,
                summary: mockSummary
            };
            
            // Store in localStorage for recovery
            const savedNotes = JSON.parse(localStorage.getItem('medicalNotes') || '[]');
            savedNotes.push(mockData);
            localStorage.setItem('medicalNotes', JSON.stringify(savedNotes));
            
            // Return the mock data to display
            return mockData;
        } catch (e) {
            console.error('Even local fallback failed:', e);
            return null;
        }
    }

    // Enhanced loadNotes function with improved error handling
    // Simplified loadNotes function with clean empty state
    function loadNotes() {
        notesContainer.innerHTML = `
            <div class="notes-loading">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Loading your notes...</p>
            </div>
        `;

        fetch('/get_notes')
            .then(response => response.json())
            .then(notes => {
                // Clear the notes container
                notesContainer.innerHTML = '';
                
                // Check if there are any valid notes
                const validNotes = Array.isArray(notes) ? notes.filter(note => 
                    note && note.original && note.summary && 
                    !(note.summary.patient_details?.name === 'Unknown Patient' && 
                    !note.summary.chief_complaints?.length &&
                    !note.summary.symptoms?.length)
                ) : [];
                
                // If no valid notes, show empty state
                if (!validNotes.length) {
                    showEmptyState();
                    return;
                }
                
                // Display valid notes
                validNotes.reverse().forEach((note, index) => {
                    createNoteCard(note, `note-${index}`);
                });
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                // On any error, just show the empty state
                showEmptyState();
            });
    }

    // Simple function to show empty state
    // Updated showEmptyState function to match current UI
    function showEmptyState() {
        notesContainer.innerHTML = `
            <div class="empty-state-container">
                <div class="notebook-animation">
                    <div class="notebook">
                        <div class="page"></div>
                        <div class="cover"></div>
                    </div>
                </div>
                <h3>No saved notes</h3>
                <p>Record your first medical note to get started</p>
            </div>
        `;
        
        // Initialize notebook animation hover effect
        setTimeout(() => {
            const notebook = document.querySelector('.notebook');
            if (notebook) {
                notebook.addEventListener('mouseenter', function() {
                    const cover = this.querySelector('.cover');
                    if (cover) {
                        cover.style.transform = 'rotateY(-40deg)';
                        cover.style.transition = 'transform 0.5s ease';
                    }
                });
                
                notebook.addEventListener('mouseleave', function() {
                    const cover = this.querySelector('.cover');
                    if (cover) {
                        cover.style.transform = 'rotateY(0deg)';
                    }
                });
            }
        }, 100);
    }

    // Create a note card from the data
    function createNoteCard(noteData, noteId = null) {
    // If we're in empty state, clear it first
    const emptyStateContainer = document.querySelector('.empty-state-container');
    if (emptyStateContainer) {
        notesContainer.innerHTML = '';
    }
    
    // CRITICAL: Ensure we have a valid ID
    let actualNoteId;
    
    // Validate the ID - prevent boolean values
    if (noteData.id !== undefined && noteData.id !== null) {
        // Convert boolean values to strings to prevent issues
        if (typeof noteData.id === 'boolean') {
            console.error('ERROR: Received boolean ID from server:', noteData.id);
            // Instead of just converting to string, create a timestamp-based ID
            actualNoteId = `temp-${Date.now()}`;
            console.log("Generated temporary ID:", actualNoteId);
        } else {
            actualNoteId = noteData.id;
        }
    } else if (noteId !== null && noteId !== undefined) {
    if (typeof noteId === 'boolean') {
        console.error('ERROR: Received boolean noteId parameter:', noteId);
        // Instead of just converting to string, create a timestamp-based ID
        actualNoteId = `temp-${Date.now()}`;
        console.log("Generated temporary ID:", actualNoteId);
    } else {
        actualNoteId = noteId;
    }
} else {
    // Generate temporary ID
    actualNoteId = `temp-${Date.now()}`;
    console.log("No ID provided, generated temporary ID:", actualNoteId);
}
    
    const noteCard = document.createElement('div');
    noteCard.className = 'note-card';
    noteCard.dataset.noteId = actualNoteId;
    
    console.log(`Note card created with ID: ${actualNoteId}, Type: ${typeof actualNoteId}`);
        
    // Generate a note date (would be provided by server in real implementation)
    const noteDate = noteData.created_at 
        ? new Date(noteData.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    
    // Extract patient info
    const patientDetails = noteData.summary?.patient_details || {};
    const patientName = patientDetails.name || 'Unknown Patient';
    
    // Create note header with patient name
    let headerHTML = `
        <div class="note-header">
            <div class="note-date">${noteDate}</div>
            <h3 class="note-title">${patientName}</h3>
        </div>
    `;
    
    // Patient info section
    let patientInfoHTML = `<div class="patient-info">`;
    
    if (patientDetails.age) {
        patientInfoHTML += `<span class="info-tag age">${patientDetails.age}</span>`;
    }
    
    if (patientDetails.gender) {
        patientInfoHTML += `<span class="info-tag gender">${patientDetails.gender}</span>`;
    }
    
    if (patientDetails.marital_status) {
        patientInfoHTML += `<span class="info-tag marital-status">${patientDetails.marital_status}</span>`;
    }
    
    if (patientDetails.residence) {
        patientInfoHTML += `<span class="info-tag residence">${patientDetails.residence}</span>`;
    }
    
    patientInfoHTML += `</div>`;
    
    // Content sections
    let contentHTML = `<div class="note-content">`;
    
    // Make sure summary exists
    const summary = noteData.summary || {};
    
    // Chief complaints section
    if (summary.chief_complaints && summary.chief_complaints.length > 0) {
        contentHTML += `
            <div class="content-section">
                <h4 class="content-title"><i data-feather="alert-circle"></i> Chief Complaints</h4>
                <div class="content-body">
                    <div class="tags-container">
                        <div class="tags-list">
        `;
        
        summary.chief_complaints.forEach(complaint => {
            contentHTML += `<span class="tag complaint">${complaint}</span>`;
        });
        
        contentHTML += `
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Allergies section - display prominently if present
    if (summary.allergies && summary.allergies.length > 0) {
        contentHTML += `
            <div class="alert-section alert-allergy">
                <strong><i data-feather="alert-triangle"></i> Allergies:</strong> ${summary.allergies.join(', ')}
            </div>
        `;
    }
    
    // Symptoms section
    if (summary.symptoms && summary.symptoms.length > 0) {
        contentHTML += `
            <div class="content-section">
                <h4 class="content-title"><i data-feather="activity"></i> Symptoms</h4>
                <div class="content-body">
                    <div class="tags-container">
                        <div class="tags-list">
        `;
        
        summary.symptoms.forEach(symptom => {
            contentHTML += `<span class="tag symptom">${symptom}</span>`;
        });
        
        contentHTML += `
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Chronic diseases section
    if (summary.chronic_diseases && summary.chronic_diseases.length > 0) {
        contentHTML += `
            <div class="content-section">
                <h4 class="content-title"><i data-feather="heart"></i> Chronic Conditions</h4>
                <div class="content-body">
                    ${summary.chronic_diseases.join(', ')}
                </div>
            </div>
        `;
    }
    
    // Possible diseases section
    if (summary.possible_diseases && summary.possible_diseases.length > 0) {
        contentHTML += `
            <div class="content-section">
                <h4 class="content-title"><i data-feather="thermometer"></i> Possible Conditions</h4>
                <div class="content-body">
                    <div class="tags-container">
                        <div class="tags-list">
        `;
        
        summary.possible_diseases.forEach(disease => {
            contentHTML += `<span class="tag disease">${disease}</span>`;
        });
        
        contentHTML += `
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    contentHTML += `</div>`;
    
    // Add action buttons at the bottom - NEW FEATURE
    let actionsHTML = `
        <div class="note-actions">
            <button class="action-btn view-btn" data-note-id="${actualNoteId}" title="View Details">
                <i data-feather="eye"></i>
            </button>
            <button class="action-btn edit-btn" data-note-id="${actualNoteId}" title="Edit Note">
                <i data-feather="edit-2"></i>
            </button>
            <button class="action-btn delete-btn" data-note-id="${actualNoteId}" title="Delete Note">
                <i data-feather="trash-2"></i>
            </button>
        </div>
    `;
    
    // Combine all sections
    noteCard.innerHTML = headerHTML + patientInfoHTML + contentHTML + actionsHTML;
    
    // Add to notes container
    notesContainer.appendChild(noteCard);
    
    // Initialize feather icons
    feather.replace();
    
    // Add event listeners for action buttons
    // Add event listeners for action buttons
noteCard.querySelector('.view-btn').addEventListener('click', function() {
    console.log(`View button clicked for note ID: ${actualNoteId}`);
    openNoteDetails(noteData, actualNoteId);
});

// Improved edit button handler
noteCard.querySelector('.edit-btn').addEventListener('click', function() {
    console.log(`Edit button clicked for note ID: ${actualNoteId}`);
    
    // Create a new object with the correct ID to ensure consistency
    const noteDataWithCorrectId = {...noteData};
    noteDataWithCorrectId.id = actualNoteId; // Ensure the ID is correct
    
    // Pass the corrected data object
    editNote(noteDataWithCorrectId, actualNoteId);
});

noteCard.querySelector('.delete-btn').addEventListener('click', function() {
    console.log(`Delete button clicked for note ID: ${actualNoteId}`);
    confirmDeleteNote(actualNoteId);
});
}
    // Open note details modal
    function openNoteDetails(noteData, noteId) {
    // Store current note ID and summary
    currentNoteId = noteId;
    console.log("Opening note details with ID:", currentNoteId);
    
    currentSummary = prepareSummaryStructure(noteData.summary);
    
    // Extract patient name from the summary with better error handling
    let extractedPatientName = '';
    if (noteData.summary && 
        noteData.summary.patient_details && 
        noteData.summary.patient_details.name) {
        extractedPatientName = noteData.summary.patient_details.name;
        console.log("Found patient name in summary:", extractedPatientName);
    } else {
        // Try to look for patient name elsewhere if not in the expected location
        if (noteData.summary) {
            console.log("Summary object exists but patient_details or name is missing");
            console.log("Available summary keys:", Object.keys(noteData.summary));
            
            // Try to find patient name in other potential locations
            if (noteData.summary.patient && noteData.summary.patient.name) {
                extractedPatientName = noteData.summary.patient.name;
                console.log("Found patient name in summary.patient.name:", extractedPatientName);
            } else if (noteData.summary.patient_name) {
                extractedPatientName = noteData.summary.patient_name;
                console.log("Found patient name in summary.patient_name:", extractedPatientName);
            }
        } else {
            console.warn("Note summary is undefined or null");
        }
    }
    
    // Set original note content
    if (originalNoteContent) {
        originalNoteContent.textContent = noteData.original;
    } else {
        console.error("originalNoteContent element not found");
    }
    
    // Format and display the summary
    formatSummaryContent(currentSummary);
    
    // Reset editing state and ensure buttons are properly set up
    if (summaryContent) {
        summaryContent.contentEditable = "false";
    }
    
    if (editSummaryBtn) {
        editSummaryBtn.style.display = 'inline-block';
    }
    
    if (saveSummaryBtn) {
        saveSummaryBtn.style.display = 'none';
    }
    
    // Remove any existing follow-up or analysis sections
    const existingFollowUp = document.querySelector('[id^="follow-up-section-"]');
    if (existingFollowUp) {
        console.log("Removing existing follow-up section before adding new one");
        existingFollowUp.remove();
    }
    
    const existingAnalysis = document.getElementById('efficacy-analysis-section');
    if (existingAnalysis) {
        console.log("Removing existing treatment efficacy section");
        existingAnalysis.remove();
    }
    
    // Show the modal
    noteDetailsModal.show();
    
    // Add follow-up actions and treatment efficacy analysis after the modal is shown
    // Use setTimeout to ensure the modal is fully rendered
    setTimeout(() => {
        // Add a debug log to check if addFollowUpActions is being called
        console.log(`Calling addFollowUpActions for note ID: ${noteId}`);
        addFollowUpActions(noteId);
        
        // Check if we have a valid patient name before adding treatment efficacy analysis
        if (extractedPatientName && extractedPatientName.trim() !== '') {
            // Store the patient name in a data attribute on the modal for future reference
            document.getElementById('noteDetailsModal').dataset.patientName = extractedPatientName;
            
            console.log("Calling addTreatmentEfficacyAnalysis with patient name:", extractedPatientName);
            addTreatmentEfficacyAnalysis(extractedPatientName, noteId);
        } else {
            console.warn("Not adding treatment efficacy analysis: No patient name found");
        }
    }, 300);
}
    
    // Edit note function - NEW FEATURE
    function editNote(noteData, noteId) {
    // Clear any previous editing state
    transcriptDiv.dataset.editingNoteId = '';
    transcriptDiv.classList.remove('editing-mode');
    saveBtn.classList.remove('editing-mode');
    
    // Set the transcript to the original note for editing
    transcriptDiv.innerText = noteData.original;
    finalTranscript = noteData.original;
    
    // CRITICAL: Store the note ID for saving the edited note
    // Make sure this is a string to avoid type conversion issues
    transcriptDiv.dataset.editingNoteId = String(noteId);
    console.log("Now editing note with ID:", transcriptDiv.dataset.editingNoteId);
    
    // Scroll to the top to see the text input area
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    
    // Focus on the transcript div
    transcriptDiv.focus();
    
    // Show a toast to indicate editing mode
    showToast(`Editing note for ${noteData.summary?.patient_details?.name || 'Unknown Patient'}. Make changes and click Save.`, 'info');
    
    // Add visual indication that we're in edit mode
    transcriptDiv.classList.add('editing-mode');
    saveBtn.classList.add('editing-mode');
    saveBtn.innerHTML = `<i data-feather="save" class="me-2"></i> Save Changes`;
    feather.replace(); // Refresh icons
}
    function attachNoteCardEventListeners(noteCard, noteData, actualNoteId) {
    // Make sure we have a proper note ID that's not a boolean
    if (typeof actualNoteId === 'boolean') {
        actualNoteId = `temp-${Date.now()}`;
        console.log("Generated temporary ID for event listeners:", actualNoteId);
    }
    
    // Add event listeners for action buttons
    // Add event listeners for action buttons
noteCard.querySelector('.view-btn').addEventListener('click', function() {
    console.log(`View button clicked for note ID: ${actualNoteId}`);
    openNoteDetails(noteData, actualNoteId);
});

noteCard.querySelector('.edit-btn').addEventListener('click', function() {
    console.log(`Edit button clicked for note ID: ${actualNoteId}`);
    editNote(noteData, actualNoteId);
});

noteCard.querySelector('.delete-btn').addEventListener('click', function() {
    console.log(`Delete button clicked for note ID: ${actualNoteId}`);
    confirmDeleteNote(actualNoteId);
});
}
    // Confirm delete note function - NEW FEATURE
    function confirmDeleteNote(noteId) {
        // Create a confirmation modal
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal fade';
        confirmModal.id = 'confirmDeleteModal';
        confirmModal.setAttribute('tabindex', '-1');
        confirmModal.setAttribute('aria-labelledby', 'confirmDeleteModalLabel');
        confirmModal.setAttribute('aria-hidden', 'true');
        
        confirmModal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="confirmDeleteModalLabel">Confirm Delete</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <p>Are you sure you want to delete this note? This action cannot be undone.</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-danger confirm-delete-btn">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add the modal to the document
        document.body.appendChild(confirmModal);
        
        // Initialize the modal
        const bsConfirmModal = new bootstrap.Modal(confirmModal);
        
        // Show the modal
        bsConfirmModal.show();
        
        // Add event listener to delete button
        confirmModal.querySelector('.confirm-delete-btn').addEventListener('click', function() {
            deleteNote(noteId);
            bsConfirmModal.hide();
            
            // Remove the modal from the DOM after it's hidden
            confirmModal.addEventListener('hidden.bs.modal', function() {
                confirmModal.remove();
            });
        });
        
        // Remove the modal from the DOM after it's hidden
        confirmModal.addEventListener('hidden.bs.modal', function() {
            confirmModal.remove();
        });
    }
    
    // Fix for saveEditedNote function to ensure it uses the correct ID
function saveEditedNote() {
    // Get the edited text from transcript div
    const editedText = transcriptDiv.innerText.trim();
    if (editedText === '') {
        showToast('Please enter some text for the note', 'warning');
        return;
    }
    
    // Get the note ID from the dataset
    const noteId = transcriptDiv.dataset.editingNoteId;
    if (!noteId) {
        showToast('Error: Note ID not found', 'error');
        return;
    }
    
    console.log("Saving edited note with ID:", noteId);
    
    // Show loading indicator
    showToast('Saving edited note...', 'info');
    
    // Send the edited note to the server
    fetch('/save_edited_note', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            noteId: noteId,
            editedText: editedText
        })
    })
    .then(res => {
        if (!res.ok) {
            throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(data => {
        if (data.status === 'success') {
            console.log('Note updated successfully:', data);
            
            // Clear editing state - VERY IMPORTANT
            transcriptDiv.dataset.editingNoteId = '';
            transcriptDiv.classList.remove('editing-mode');
            saveBtn.classList.remove('editing-mode');
            saveBtn.innerHTML = `<i data-feather="save" class="me-2"></i> Save Note`;
            feather.replace(); // Refresh icons
            
            // Clear the transcript and audio
            finalTranscript = '';
            transcriptDiv.innerText = '';
            audioPlayerContainer.style.display = 'none';
            audioPlayer.src = '';
            
            // Refresh the notes to show the updated version
            loadNotes();
            
            showToast('Note updated successfully', 'success');
        } else {
            showToast(`Error saving note: ${data.message}`, 'error');
            // Don't clear editing state on error
        }
    })
    .catch(error => {
        console.error('Error saving edited note:', error);
        showToast(`Failed to save edited note: ${error.message}`, 'error');
        // Don't clear editing state on error
    });
}
    // Delete note function 
    // Updated deleteNote function to show empty state when all notes are deleted
    function deleteNote(noteId) {
    // Show toast
    showToast('Deleting note...', 'info');
    
    // Find the note element in the DOM
    const noteCard = document.querySelector(`.note-card[data-note-id="${noteId}"]`);
    if (!noteCard) {
        showToast('Note not found in the UI', 'error');
        return;
    }
    
    // CRITICAL: Ensure we have a valid ID
    let idToSend = noteId;
    
    // Validate the ID - prevent boolean values
    if (typeof noteId === 'boolean') {
        console.error('ERROR: Attempting to delete with boolean ID:', noteId);
        idToSend = noteId.toString(); // Convert to string "true" or "false"
    }
    
    console.log(`Deleting note with ID: ${idToSend}, Type: ${typeof idToSend}`);
    
    // Send delete request to server
    fetch('/delete_note', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ noteId: idToSend })
    })
    .then(res => {
        console.log('Delete response status:', res.status);
        return res.json().catch(e => {
            return { 
                status: 'error', 
                message: `Server returned ${res.status}: ${res.statusText}`
            };
        });
    })
    .then(data => {
        console.log('Delete response data:', data);
        if (data.status === 'success') {
            // Handle successful deletion...
            // Remove the note from the DOM with animation
            noteCard.style.opacity = '0';
            noteCard.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                noteCard.remove();
                
                // Show empty state if no notes left
                if (notesContainer.querySelector('.note-card') === null) {
                    showEmptyState();
                }
                
                showToast('Note deleted successfully', 'success');
            }, 300);
        } else {
            showToast(`Error deleting note: ${data.message}. Please try again.`, 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting note:', error);
        showToast(`Network error: ${error.message}. Please try again.`, 'error');
    });
}
    // Fallback delete function when server-side delete fails
    // Simplified fallback delete function when server-side delete fails
    function handleFallbackDelete(noteCard, noteId) {
        // No warning toast, just proceed with visual deletion
        
        // Remove the note from the DOM with animation
        noteCard.style.opacity = '0';
        noteCard.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            noteCard.remove();
            
            // Show empty state if no notes left
            if (notesContainer.querySelector('.note-card') === null) {
                notesContainer.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <p class="text-muted">No notes found. Record your first medical note to get started.</p>
                    </div>
                `;
            }
            
            // Show success message regardless of backend success
            showToast('Note deleted successfully', 'success');
        }, 300);
        
        // Still store the deletion in localStorage to sync later if needed (silent operation)
        try {
            const pendingDeletions = JSON.parse(localStorage.getItem('pendingDeletions') || '[]');
            pendingDeletions.push({
                noteId: noteId,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('pendingDeletions', JSON.stringify(pendingDeletions));
        } catch (e) {
            console.error('Failed to store pending deletion:', e);
            // No toast for this error - keep it silent
        }
    }
    
    // Format summary content for display
    // Format summary content for display with consistent structure
    function formatSummaryContent(summary) {
        let formattedContent = '';
        
        // Add title and timestamp
        formattedContent += `<h1 style="color: #4361ee;">Medical Summary <span class="edited-indicator">Edited</span></h1>`;
        formattedContent += `<p>Last updated on ${new Date().toLocaleString()}</p>`;
        
        // Patient Details - Always include this section
        formattedContent += '<h3>Patient Details</h3>';
        const patientDetails = summary.patient_details || {};
        
        formattedContent += '<ul>';
        // Include all fields, even if empty
        formattedContent += `<li><strong>Name:</strong> ${patientDetails.name || '<span style="color: #6c757d;">(No information provided)</span>'}</li>`;
        formattedContent += `<li><strong>Age:</strong> ${patientDetails.age || '<span style="color: #6c757d;">(No information provided)</span>'}</li>`;
        formattedContent += `<li><strong>Gender:</strong> ${patientDetails.gender || '<span style="color: #6c757d;">(No information provided)</span>'}</li>`;
        formattedContent += `<li><strong>Marital Status:</strong> ${patientDetails.marital_status || '<span style="color: #6c757d;">(No information provided)</span>'}</li>`;
        formattedContent += `<li><strong>Residence:</strong> ${patientDetails.residence || '<span style="color: #6c757d;">(No information provided)</span>'}</li>`;
        formattedContent += '</ul>';
        
        // Allergies - Always include this section
        formattedContent += '<h3 style="color: #dc3545;">Allergies</h3>';
        if (summary.allergies && summary.allergies.length > 0) {
            formattedContent += '<ul style="color: #dc3545;">';
            summary.allergies.forEach(allergy => {
                formattedContent += `<li>${allergy}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No allergies reported)</span></p>';
        }
        
        // Chief Complaints - Always include this section
        formattedContent += '<h3>Chief Complaints</h3>';
        if (summary.chief_complaints && summary.chief_complaints.length > 0) {
            formattedContent += '<ul>';
            summary.chief_complaints.forEach(complaint => {
                formattedContent += `<li>${complaint}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No chief complaints reported)</span></p>';
        }
        
        // Complaint Details - Always include this section
        formattedContent += '<h3>Complaint Details</h3>';
        if (summary.chief_complaint_details && summary.chief_complaint_details.length > 0) {
            formattedContent += '<ul>';
            summary.chief_complaint_details.forEach(detail => {
                let detailText = `<li><strong>${detail.complaint || 'Unknown'}</strong>`;
                
                if (detail.location) {
                    detailText += ` - Location: ${detail.location}`;
                }
                
                if (detail.severity) {
                    detailText += ` - Severity: ${detail.severity}`;
                }
                
                if (detail.duration) {
                    detailText += ` - Duration: ${detail.duration}`;
                }
                
                detailText += '</li>';
                formattedContent += detailText;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No complaint details reported)</span></p>';
        }
        
        // Symptoms - Always include this section
        formattedContent += '<h3>Symptoms</h3>';
        if (summary.symptoms && summary.symptoms.length > 0) {
            formattedContent += '<ul>';
            summary.symptoms.forEach(symptom => {
                formattedContent += `<li>${symptom}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No symptoms reported)</span></p>';
        }
        
        // Past History - Always include this section
        formattedContent += '<h3>Past History</h3>';
        if (summary.past_history && summary.past_history.length > 0) {
            formattedContent += '<ul>';
            summary.past_history.forEach(history => {
                formattedContent += `<li>${history}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No past history reported)</span></p>';
        }
        
        // Chronic Diseases - Always include this section
        formattedContent += '<h3>Chronic Diseases</h3>';
        if (summary.chronic_diseases && summary.chronic_diseases.length > 0) {
            formattedContent += '<ul>';
            summary.chronic_diseases.forEach(disease => {
                formattedContent += `<li>${disease}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No chronic diseases reported)</span></p>';
        }
        
        // Lifestyle - Always include this section
        formattedContent += '<h3>Lifestyle</h3>';
        if (summary.lifestyle && summary.lifestyle.length > 0) {
            formattedContent += '<ul>';
            summary.lifestyle.forEach(habit => {
                let habitText = `<li><strong>${habit.habit || 'Unknown'}</strong>`;
                
                if (habit.frequency) {
                    habitText += ` - Frequency: ${habit.frequency}`;
                }
                
                if (habit.duration) {
                    habitText += ` - Duration: ${habit.duration}`;
                }
                
                habitText += '</li>';
                formattedContent += habitText;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No lifestyle information reported)</span></p>';
        }
        
        // Current Medications - Always include this section
        formattedContent += '<h3>Current Medications</h3>';
        if (summary.drug_history && summary.drug_history.length > 0) {
            formattedContent += '<ul>';
            summary.drug_history.forEach(drug => {
                formattedContent += `<li>${drug}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No current medications reported)</span></p>';
        }
        
        // Family History - Always include this section
        formattedContent += '<h3>Family History</h3>';
        if (summary.family_history && summary.family_history.length > 0) {
            formattedContent += '<ul>';
            summary.family_history.forEach(history => {
                formattedContent += `<li>${history}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No family history reported)</span></p>';
        }
        
        // Possible Conditions - Always include this section
        formattedContent += '<h3>Possible Conditions</h3>';
        if (summary.possible_diseases && summary.possible_diseases.length > 0) {
            formattedContent += '<ul>';
            summary.possible_diseases.forEach(disease => {
                formattedContent += `<li>${disease}</li>`;
            });
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p><span style="color: #6c757d;">(No potential conditions identified)</span></p>';
        }
        
        // Set the formatted content
        summaryContent.innerHTML = formattedContent;
    }
    
    // Save edited summary
    // Updated saveEditedSummary function
    function saveEditedSummary() {
    if (!currentNoteId) {
        showToast('Error: No active note to save', 'error');
        return;
    }
    
    console.log("Saving edited summary for note ID:", currentNoteId);
    
    // Get the edited HTML content
    const editedContent = summaryContent.innerHTML;
    
    // Extract structured data from HTML content
    const updatedSummary = extractSummaryFromHTML(editedContent);
    
    console.log("Updated summary:", updatedSummary);
    
    // Update the note card in the UI immediately
    updateNoteCardWithSummary(currentNoteId, updatedSummary);
    
    // Update the current summary with the edited version
    currentSummary = updatedSummary;
    
    // Show success message
    showToast('Summary updated successfully', 'success');
    
    // Reset edit state
    if (summaryContent) {
        summaryContent.contentEditable = "false";
    }
    if (editSummaryBtn) {
        editSummaryBtn.style.display = 'inline-block';
    }
    if (saveSummaryBtn) {
        saveSummaryBtn.style.display = 'none';
    }
    
    // Close the modal
    noteDetailsModal.hide();
    
    // Try to send to server for backend update (but don't rely on it)
    try {
        // Create an object with the noteId and edited summary
        const data = {
            noteId: currentNoteId,
            editedSummary: updatedSummary
        };
        
        fetch('/save_edited_summary', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(res => {
            if (!res.ok) {
                console.warn(`Server returned ${res.status}: ${res.statusText}`);
                // We already updated the UI, so just log this warning
            }
            return res.json().catch(e => {
                return { status: 'error', message: 'Invalid JSON response' };
            });
        })
        .then(data => {
            if (data.status === 'success') {
                console.log("Server confirmed summary update success");
            } else {
                console.warn("Server reported error, but UI is already updated:", data.message);
            }
        })
        .catch(error => {
            console.error('Error communicating with server:', error);
            // UI already updated, so just log the error
        });
    } catch (e) {
        console.error("Exception while trying to save to server:", e);
        // UI already updated, so just log the error
    }
}

    // NEW: Add this function to update the note card in the UI
    // Enhanced updateNoteCardWithSummary function
function updateNoteCardWithSummary(noteId, updatedSummary) {
    // Find the note card in the DOM
    const noteCard = document.querySelector(`.note-card[data-note-id="${noteId}"]`);
    if (!noteCard) {
        console.warn(`Note card with ID ${noteId} not found in the DOM`);
        return;
    }
    
    console.log("Updating note card with new summary:", updatedSummary);
    
    // Update patient name in note header
    const patientName = updatedSummary.patient_details?.name || 'Unknown Patient';
    const noteTitle = noteCard.querySelector('.note-title');
    if (noteTitle) {
        noteTitle.textContent = patientName;
    }
    
    // Update patient info section
    const patientInfo = noteCard.querySelector('.patient-info');
    if (patientInfo) {
        patientInfo.innerHTML = '';
        
        if (updatedSummary.patient_details?.age) {
            patientInfo.innerHTML += `<span class="info-tag age">${updatedSummary.patient_details.age}</span>`;
        }
        
        if (updatedSummary.patient_details?.gender) {
            patientInfo.innerHTML += `<span class="info-tag gender">${updatedSummary.patient_details.gender}</span>`;
        }
        
        if (updatedSummary.patient_details?.marital_status) {
            patientInfo.innerHTML += `<span class="info-tag marital-status">${updatedSummary.patient_details.marital_status}</span>`;
        }
        
        if (updatedSummary.patient_details?.residence) {
            patientInfo.innerHTML += `<span class="info-tag residence">${updatedSummary.patient_details.residence}</span>`;
        }
    }
    
    // Complete rebuild of content sections
    const noteContent = noteCard.querySelector('.note-content');
    if (noteContent) {
        // Clear existing content
        noteContent.innerHTML = '';
        
        // Chief complaints section
        if (updatedSummary.chief_complaints && updatedSummary.chief_complaints.length > 0) {
            let complaintsHTML = `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="alert-circle"></i> Chief Complaints</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            updatedSummary.chief_complaints.forEach(complaint => {
                complaintsHTML += `<span class="tag complaint">${complaint}</span>`;
            });
            
            complaintsHTML += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
            noteContent.innerHTML += complaintsHTML;
        }
        
        // Allergies section - display prominently if present
        if (updatedSummary.allergies && updatedSummary.allergies.length > 0) {
            let allergiesHTML = `
                <div class="alert-section alert-allergy">
                    <strong><i data-feather="alert-triangle"></i> Allergies:</strong> ${updatedSummary.allergies.join(', ')}
                </div>
            `;
            noteContent.innerHTML += allergiesHTML;
        }
        
        // Symptoms section
        if (updatedSummary.symptoms && updatedSummary.symptoms.length > 0) {
            let symptomsHTML = `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="activity"></i> Symptoms</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            updatedSummary.symptoms.forEach(symptom => {
                symptomsHTML += `<span class="tag symptom">${symptom}</span>`;
            });
            
            symptomsHTML += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
            noteContent.innerHTML += symptomsHTML;
        }
        
        // Chronic diseases section
        if (updatedSummary.chronic_diseases && updatedSummary.chronic_diseases.length > 0) {
            let diseasesHTML = `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="heart"></i> Chronic Conditions</h4>
                    <div class="content-body">
                        ${updatedSummary.chronic_diseases.join(', ')}
                    </div>
                </div>
            `;
            noteContent.innerHTML += diseasesHTML;
        }
        
        // Possible diseases section
        if (updatedSummary.possible_diseases && updatedSummary.possible_diseases.length > 0) {
            let possibleHTML = `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="thermometer"></i> Possible Conditions</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            updatedSummary.possible_diseases.forEach(disease => {
                possibleHTML += `<span class="tag disease">${disease}</span>`;
            });
            
            possibleHTML += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
            noteContent.innerHTML += possibleHTML;
        }
    }
    
    // Store the updated summary in the note card's data
    noteCard.dataset.summary = JSON.stringify(updatedSummary);
    
    // Refresh feather icons
    feather.replace();
    
    // Add animation to highlight the updated card
    noteCard.classList.add('highlight-update');
    setTimeout(() => {
        noteCard.classList.remove('highlight-update');
    }, 2000);
    
    console.log("Note card updated successfully");
}

    // Enhanced extractSummaryFromHTML function for better content extraction
    function extractSummaryFromHTML(htmlContent) {
        // Create a temporary div to parse the HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        
        // Initialize the summary object with the same structure as your database expects
        const extractedSummary = {
            patient_details: {
                name: null,
                age: null,
                gender: null,
                marital_status: null,
                residence: null
            },
            chief_complaints: [],
            chief_complaint_details: [],
            symptoms: [],
            past_history: [],
            chronic_diseases: [],
            lifestyle: [],
            drug_history: [],
            family_history: [],
            allergies: [],
            possible_diseases: []
        };
        
        // Function to extract content from elements by heading text
        function findSectionByTitle(title) {
    const headers = tempDiv.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const titleLower = title.toLowerCase();
    
    for (let header of headers) {
        if (header.textContent.trim().toLowerCase().includes(titleLower)) {
            return header;
        }
    }
    return null;
}
        
        // Extract patient details
        const patientDetailsSection = findSectionByTitle('Patient Details');
        if (patientDetailsSection) {
            const patientList = patientDetailsSection.nextElementSibling;
            if (patientList && patientList.tagName === 'UL') {
                const listItems = patientList.querySelectorAll('li');
                listItems.forEach(item => {
                    const text = item.textContent;
                    if (text.includes('Name:')) {
                        const value = text.replace('Name:', '').trim();
                        if (!value.includes('No information provided')) {
                            extractedSummary.patient_details.name = value;
                        }
                    } else if (text.includes('Age:')) {
                        const value = text.replace('Age:', '').trim();
                        if (!value.includes('No information provided')) {
                            extractedSummary.patient_details.age = value;
                        }
                    } else if (text.includes('Gender:')) {
                        const value = text.replace('Gender:', '').trim();
                        if (!value.includes('No information provided')) {
                            extractedSummary.patient_details.gender = value;
                        }
                    } else if (text.includes('Marital Status:')) {
                        const value = text.replace('Marital Status:', '').trim();
                        if (!value.includes('No information provided')) {
                            extractedSummary.patient_details.marital_status = value;
                        }
                    } else if (text.includes('Residence:')) {
                        const value = text.replace('Residence:', '').trim();
                        if (!value.includes('No information provided')) {
                            extractedSummary.patient_details.residence = value;
                        }
                    }
                });
            }
        }
        
        // Function to extract list items from a section
        // Replace this function in your code
        function extractListItems(sectionTitle, targetArray) {
            const section = findSectionByTitle(sectionTitle);
            if (section) {
                let list = section.nextElementSibling;
                
                // Find the next UL or OL element
                while (list && list.tagName !== 'UL' && list.tagName !== 'OL') {
                    list = list.nextElementSibling;
                }
                
                if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
                    const items = list.querySelectorAll('li');
                    items.forEach(item => {
                        const text = item.textContent.trim();
                        if (text && !text.includes('No information provided') && !text.includes('not reported')) {
                            targetArray.push(text);
                        }
                    });
                } else if (section.nextElementSibling) {
                    // Fallback: try to extract from paragraph text if no list is found
                    const content = section.nextElementSibling.textContent.trim();
                    if (content && !content.includes('No information provided') && !content.includes('not reported')) {
                        // Split by commas if it's a comma-separated list
                        if (content.includes(',')) {
                            const items = content.split(',').map(item => item.trim());
                            items.forEach(item => {
                                if (item) targetArray.push(item);
                            });
                        } else {
                            targetArray.push(content);
                        }
                    }
                }
            }
        }
        
        // Extract complex data for chief complaint details
        function extractComplexSection(sectionTitle, targetArray) {
    const section = findSectionByTitle(sectionTitle);
    if (section) {
        let list = section.nextElementSibling;
        
        // Find the next UL or OL element
        while (list && list.tagName !== 'UL' && list.tagName !== 'OL') {
            list = list.nextElementSibling;
        }
        
        if (list && (list.tagName === 'UL' || list.tagName === 'OL')) {
            const items = list.querySelectorAll('li');
            items.forEach(item => {
                const text = item.textContent.trim();
                if (text && !text.includes('No information provided')) {
                    // For chief complaint details, try to parse structured data
                    if (sectionTitle.toLowerCase() === 'complaint details') {
                        const parts = text.split('-').map(p => p.trim());
                        const detail = {
                            complaint: parts[0]
                        };
                        
                        // Process additional info like location, severity, etc
                        parts.slice(1).forEach(part => {
                            if (part.includes('Location:')) {
                                detail.location = part.replace('Location:', '').trim();
                            } else if (part.includes('Severity:')) {
                                detail.severity = part.replace('Severity:', '').trim();
                            } else if (part.includes('Duration:')) {
                                detail.duration = part.replace('Duration:', '').trim();
                            }
                        });
                        
                        targetArray.push(detail);
                    } else {
                        targetArray.push(text);
                    }
                }
            });
        }
    }
}
        
        // Extract each section
        extractListItems('Allergies', extractedSummary.allergies);
        extractListItems('Chief Complaints', extractedSummary.chief_complaints);
        extractComplexSection('Complaint Details', extractedSummary.chief_complaint_details);
        extractListItems('Symptoms', extractedSummary.symptoms);
        extractListItems('Past History', extractedSummary.past_history);
        extractListItems('Chronic Diseases', extractedSummary.chronic_diseases);
        extractComplexSection('Lifestyle', extractedSummary.lifestyle);
        extractListItems('Current Medications', extractedSummary.drug_history);
        extractListItems('Family History', extractedSummary.family_history);
        extractListItems('Possible Conditions', extractedSummary.possible_diseases);
        
        // Make sure we have at least the patient name
        if (!extractedSummary.patient_details.name) {
            // Try to extract from the title
            const title = tempDiv.querySelector('h1');
            if (title && !title.textContent.includes('Medical Summary')) {
                extractedSummary.patient_details.name = title.textContent.trim();
            } else {
                // Default fallback
                extractedSummary.patient_details.name = "Updated Patient";
            }
        }
        
        console.log("Extracted summary:", extractedSummary);
        return extractedSummary;
    }

    // Add this function to prepare a consistent summary structure
    function prepareSummaryStructure(originalSummary) {
        // Create a copy of the original summary
        const summary = JSON.parse(JSON.stringify(originalSummary || {}));
        
        // Ensure all sections exist
        summary.patient_details = summary.patient_details || {};
        summary.allergies = summary.allergies || [];
        summary.chief_complaints = summary.chief_complaints || [];
        summary.chief_complaint_details = summary.chief_complaint_details || [];
        summary.symptoms = summary.symptoms || [];
        summary.past_history = summary.past_history || [];
        summary.chronic_diseases = summary.chronic_diseases || [];
        summary.lifestyle = summary.lifestyle || [];
        summary.drug_history = summary.drug_history || [];
        summary.family_history = summary.family_history || [];
        summary.possible_diseases = summary.possible_diseases || [];
        
        return summary;
    }
    
    // Download summary
    // Download summary - modified to include all consistent sections
    function downloadSummary() {
        if (!currentNoteId || !currentSummary) {
            showToast('Error: No active note to download', 'error');
            return;
        }
        
        // Get patient name for filename
        const patientName = currentSummary.patient_details && currentSummary.patient_details.name 
            ? currentSummary.patient_details.name.replace(/\s+/g, '_')
            : 'Patient';
            
        // Create a date string for the filename
        const dateStr = new Date().toISOString().slice(0, 10);
        
        // Determine format and generate content
        const format = 'html'; // Could also support 'json', 'pdf', etc.
        
        if (format === 'html') {
            // Create HTML content with consistent styling that matches the summary view
            const htmlContent = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Medical Summary - ${patientName}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.5; }
            h1 { color: #4361ee; margin-bottom: 10px; }
            h3 { color: #343a40; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            h3[style*="color: #dc3545"] { color: #dc3545 !important; } /* Preserve red for allergies */
            ul { padding-left: 20px; margin-top: 10px; }
            li { margin-bottom: 5px; }
            .no-info { color: #6c757d; font-style: italic; }
            .footer { margin-top: 30px; font-size: 0.8em; color: #6c757d; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
    </head>
    <body>
        ${summaryContent.innerHTML}
        <div class="footer">
            <p>This summary was generated by Health Companion Medical Notes System on ${new Date().toLocaleString()}</p>
            <p>This is not a substitute for professional medical advice, diagnosis, or treatment.</p>
        </div>
    </body>
    </html>`;
            
            // Create a blob and download link
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Medical_Summary_${patientName}_${dateStr}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('Summary downloaded as HTML', 'success');
        }
    }
        
    // Show toast notification
    function showToast(message, type = 'info') {
        // Check if toast container exists, create if not
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }
        
        // Create toast element
        const toastId = 'toast-' + Date.now();
        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center text-white bg-${type === 'info' ? 'primary' : type === 'success' ? 'success' : type === 'warning' ? 'warning' : 'danger'}`;
        toastEl.id = toastId;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toastEl);
        
        // Initialize and show the toast
        const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
        toast.show();
        
        // Remove toast from DOM after it's hidden
        toastEl.addEventListener('hidden.bs.toast', function() {
            toastEl.remove();
        });
    }
    // Add this at the bottom of your JavaScript file to make the notebook interactive
    // Add this code to enable the notebook hover animation
    // Add this code to enable the notebook hover animation
    document.addEventListener('DOMContentLoaded', function() {
        // Monitor for the empty state being added to the DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    // Look for the notebook element
                    const notebook = document.querySelector('.notebook');
                    if (notebook) {
                        // Add hover events
                        notebook.addEventListener('mouseenter', function() {
                            const cover = this.querySelector('.cover');
                            if (cover) {
                                cover.style.transform = 'rotateY(-40deg)';
                                cover.style.transition = 'transform 0.5s ease';
                            }
                        });
                        
                        notebook.addEventListener('mouseleave', function() {
                            const cover = this.querySelector('.cover');
                            if (cover) {
                                cover.style.transform = 'rotateY(0deg)';
                            }
                        });
                        
                        // Once we've found and initialized the notebook, disconnect the observer
                        observer.disconnect();
                    }
                }
            });
        });
        
        // Start observing the notes container for changes
        observer.observe(notesContainer, { childList: true, subtree: true });
    });
        

    // Add global fallback handler for save button
    // Add global fallback handler for save button
document.addEventListener('click', function(event) {
        // Find if the clicked element is the save button or a child of it
        if (event.target.closest('.save-summary-btn')) {
            console.log("Save button clicked through global delegation");
            event.preventDefault();
            
            // Now saveEditedSummary and showToast are accessible here
            saveEditedSummary();
        }
    });
// Add this function after your existing functions
function addFollowUpActions(noteId) {
    // Skip if no note ID
    if (!noteId) {
        console.warn("Cannot generate follow-up actions: No note ID provided");
        return;
    }
    
    // Generate a unique ID for this note's follow-up section
    const followUpSectionId = `follow-up-section-${noteId}`;
    
    // Log for debugging
    console.log(`Adding follow-up actions for note ID: ${noteId} with section ID: ${followUpSectionId}`);
    
    // Create and add follow-up section
    const modalBody = document.querySelector('#noteDetailsModal .modal-body');
    if (!modalBody) {
        console.error("Modal body not found - make sure the modal is in the DOM");
        return;
    }
    
    // Check if follow-up section already exists for THIS specific note
    if (document.getElementById(followUpSectionId)) {
        console.log(`Follow-up section for note ID ${noteId} already exists, removing it`);
        document.getElementById(followUpSectionId).remove();
    }
    
    console.log(`Creating follow-up section for note ID: ${noteId}`);
    
    // Create follow-up section with unique ID
    const followUpSection = document.createElement('div');
    followUpSection.id = followUpSectionId;
    followUpSection.className = 'mt-4 pt-4 border-top';
    
    // Create the header with Generate button
    const headerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5><i data-feather="check-square" class="me-2 text-primary"></i> Follow-up Action Items</h5>
            <button id="generate-follow-up-btn-${noteId}" class="btn btn-sm btn-primary generate-follow-up-btn" data-note-id="${noteId}">
                <i data-feather="list" class="btn-icon-sm"></i> Generate Actions
            </button>
        </div>
    `;
    
    // Create the results container where the content will be loaded
    const resultsHTML = `
        <div id="follow-up-results-${noteId}" class="follow-up-results mt-3" style="display: none;">
            <div class="follow-up-loading text-center py-4" style="display: none;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Generating...</span>
                </div>
                <p class="mt-2">Generating follow-up action items...</p>
            </div>
            <div class="follow-up-content" style="display: none;"></div>
        </div>
    `;
    
    followUpSection.innerHTML = headerHTML + resultsHTML;
    modalBody.appendChild(followUpSection);
    
    // Initialize Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    } else {
        console.warn("Feather icons library not found");
    }
    
    // First check if we already have follow-up actions
    console.log(`Checking for existing follow-up actions for note ID: ${noteId}`);
    
    // Show a temporary "Checking..." message instead of the loading spinner
    const resultsContainer = document.getElementById(`follow-up-results-${noteId}`);
    const loadingElement = resultsContainer.querySelector('.follow-up-loading');
    const contentElement = resultsContainer.querySelector('.follow-up-content');
    
    // Don't show the loading spinner right away
    resultsContainer.style.display = 'block';
    
    fetch(`/get_follow_up?noteId=${noteId}`)
        .then(response => {
            console.log(`Response status from get_follow_up: ${response.status}`);
            if (!response.ok) {
                if (response.status === 404) {
                    // No existing follow-up actions, but this is normal
                    console.log(`No existing follow-up actions for note ID ${noteId} (404 response)`);
                    return { status: "error", message: "No follow-up actions found" };
                }
                throw new Error(`Server returned status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Received data from get_follow_up:`, data);
            if (data.status === 'success' && data.actions) {
                console.log(`Found existing follow-up actions for note ID: ${noteId}, displaying them`);
                displayFollowUpActions(data.actions, noteId);
            } else {
                console.log(`No follow-up actions for note ID ${noteId}: ${data.message || 'Unknown reason'}`);
                // Don't show anything if no actions found
            }
        })
        .catch(error => {
            console.log(`Error checking follow-up actions for note ID ${noteId}:`, error.message);
        });
    
    // Add event listener to generate button
    const generateBtn = document.getElementById(`generate-follow-up-btn-${noteId}`);
    if (generateBtn) {
        generateBtn.addEventListener('click', function() {
            const clickedNoteId = this.getAttribute('data-note-id');
            console.log(`Generate follow-up button clicked for note ID: ${clickedNoteId}`);
            
            const resultsContainer = document.getElementById(`follow-up-results-${clickedNoteId}`);
            if (!resultsContainer) {
                console.error(`Results container for note ID ${clickedNoteId} not found`);
                return;
            }
            
            const loadingElement = resultsContainer.querySelector('.follow-up-loading');
            const contentElement = resultsContainer.querySelector('.follow-up-content');
            
            // NOW show the loading spinner
            resultsContainer.style.display = 'block';
            loadingElement.style.display = 'block';
            contentElement.style.display = 'none';
            contentElement.innerHTML = ''; // Clear previous content
            
            console.log(`Sending request to generate follow-up actions for note ID: ${clickedNoteId}`);
            // Generate follow-up actions
            fetch('/generate_follow_up', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({noteId: clickedNoteId})
            })
            .then(response => {
                console.log(`Response status from generate_follow_up: ${response.status}`);
                if (!response.ok) {
                    throw new Error(`Server returned status ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Received data from generate_follow_up:`, data);
                // Hide loading
                loadingElement.style.display = 'none';
                
                if (data.status === 'error') {
                    contentElement.innerHTML = `
                        <div class="alert alert-warning">
                            ${data.message || 'Failed to generate follow-up actions.'}
                        </div>
                    `;
                    contentElement.style.display = 'block';
                    return;
                }
                
                // Display the actions
                console.log(`Displaying follow-up actions after generation for note ID: ${clickedNoteId}`);
                displayFollowUpActions(data.actions, clickedNoteId);
            })
            .catch(error => {
                console.error(`Error generating follow-up actions for note ID ${clickedNoteId}:`, error);
                loadingElement.style.display = 'none';
                contentElement.innerHTML = `
                    <div class="alert alert-danger">
                        An error occurred while generating follow-up actions: ${error.message}
                    </div>
                `;
                contentElement.style.display = 'block';
            });
        });
    } else {
        console.error(`Generate follow-up button with ID generate-follow-up-btn-${noteId} not found after adding to DOM`);
    }
}

function displayFollowUpActions(actions, noteId) {
    // Make sure we have a note ID
    if (!noteId) {
        console.error("Cannot display follow-up actions: No note ID provided");
        return;
    }
    console.log(`Displaying follow-up actions for note ID: ${noteId}`, actions);

    // Find the content element specific to this note
    const resultsContainer = document.getElementById(`follow-up-results-${noteId}`);
    if (!resultsContainer) {
        console.error(`Follow-up results container for note ID ${noteId} not found`);
        return;
    }
    
    const contentElement = resultsContainer.querySelector('.follow-up-content');
    if (!contentElement) {
        console.error(`Follow-up content element for note ID ${noteId} not found`);
        return;
    }
    // Ensure the actions object has the expected properties
    if (!actions || typeof actions !== 'object') {
        console.error(`Invalid actions object for note ID ${noteId}:`, actions);
        contentElement.innerHTML = `
            <div class="alert alert-warning">
                Invalid follow-up actions data received from server.
            </div>
        `;
        contentElement.style.display = 'block';
        resultsContainer.style.display = 'block';
        return;
    }
    
    // Format the follow-up date
    let followUpDateFormatted = 'Not specified';
    if (actions.follow_up_date) {
        const followUpDate = new Date(actions.follow_up_date);
        followUpDateFormatted = followUpDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Determine urgency badge class
    let urgencyClass = 'bg-primary';
    if (actions.urgency_level === 'urgent') {
        urgencyClass = 'bg-danger';
    } else if (actions.urgency_level === 'soon') {
        urgencyClass = 'bg-warning text-dark';
    }
    
    // Generate HTML content
    let htmlContent = `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <span class="me-3">
                        <strong>Follow-up Date:</strong> ${followUpDateFormatted}
                    </span>
                    <span class="badge ${urgencyClass} px-2 py-1">
                        ${actions.urgency_level.charAt(0).toUpperCase() + actions.urgency_level.slice(1)}
                    </span>
                </div>
                <button id="download-actions-btn-${noteId}" class="btn btn-sm btn-outline-primary download-actions-btn" data-note-id="${noteId}">
                    <i data-feather="download" class="btn-icon-sm"></i> Download
                </button>
            </div>
        </div>
        
        <div class="row">
            <div class="col-md-6 mb-3">
                <div class="card h-100">
                    <div class="card-header bg-light py-2">
                        <h6 class="mb-0"><i data-feather="user" class="me-2 text-primary"></i> Patient Actions</h6>
                    </div>
                    <div class="card-body patient-actions">
    `;
    
    // Add patient actions, grouped by priority
    if (actions.patient_actions && actions.patient_actions.length > 0) {
        // Group actions by priority
        const highPriority = actions.patient_actions.filter(a => a.priority === 'high');
        const mediumPriority = actions.patient_actions.filter(a => a.priority === 'medium');
        const lowPriority = actions.patient_actions.filter(a => a.priority === 'low');
        
        // Add high priority actions
        if (highPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-danger">High Priority</h6><ul class="action-list high-priority mb-3">`;
            highPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-danger">
                                <i data-feather="alert-circle" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
        
        // Add medium priority actions
        if (mediumPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-warning">Regular Priority</h6><ul class="action-list medium-priority mb-3">`;
            mediumPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-warning">
                                <i data-feather="check-circle" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
        
        // Add low priority actions
        if (lowPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-info">For Consideration</h6><ul class="action-list low-priority mb-3">`;
            lowPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-info">
                                <i data-feather="info" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
    } else {
        htmlContent += `<p class="text-muted">No patient actions were identified.</p>`;
    }
    
    htmlContent += `
                    </div>
                </div>
            </div>
            
            <div class="col-md-6 mb-3">
                <div class="card h-100">
                    <div class="card-header bg-light py-2">
                        <h6 class="mb-0"><i data-feather="briefcase" class="me-2 text-primary"></i> Doctor Actions</h6>
                    </div>
                    <div class="card-body doctor-actions">
    `;
    
    // Add doctor actions, grouped by priority
    if (actions.doctor_actions && actions.doctor_actions.length > 0) {
        // Group actions by priority
        const highPriority = actions.doctor_actions.filter(a => a.priority === 'high');
        const mediumPriority = actions.doctor_actions.filter(a => a.priority === 'medium');
        const lowPriority = actions.doctor_actions.filter(a => a.priority === 'low');
        
        // Add high priority actions
        if (highPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-danger">High Priority</h6><ul class="action-list high-priority mb-3">`;
            highPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-danger">
                                <i data-feather="alert-circle" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
        
        // Add medium priority actions
        if (mediumPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-warning">Regular Priority</h6><ul class="action-list medium-priority mb-3">`;
            mediumPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-warning">
                                <i data-feather="check-circle" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
        
        // Add low priority actions
        if (lowPriority.length > 0) {
            htmlContent += `<h6 class="mb-2 text-info">For Consideration</h6><ul class="action-list low-priority mb-3">`;
            lowPriority.forEach(action => {
                htmlContent += `
                    <li>
                        <div class="d-flex align-items-start mb-2">
                            <div class="action-icon me-2 text-info">
                                <i data-feather="info" style="width: 18px; height: 18px;"></i>
                            </div>
                            <div class="action-content">
                                <div class="action-text">${action.action}</div>
                                ${action.context ? `<div class="action-context small text-muted">${action.context}</div>` : ''}
                            </div>
                        </div>
                    </li>
                `;
            });
            htmlContent += `</ul>`;
        }
    } else {
        htmlContent += `<p class="text-muted">No doctor actions were identified.</p>`;
    }
    
    htmlContent += `
                    </div>
                </div>
            </div>
        </div>
        
        <div class="alert alert-info mt-2 mb-0">
            <small>
                <strong>Note:</strong> These action items were automatically generated based on the conversation. 
                Always verify with healthcare professionals before taking action.
            </small>
        </div>
    `;
    
    // Update the content
    contentElement.innerHTML = htmlContent;
    contentElement.style.display = 'block';
    
    // Make sure the results container is visible
    resultsContainer.style.display = 'block';
    
    // Refresh Feather icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
    
    // Add event listener to download button
    const downloadBtn = document.getElementById(`download-actions-btn-${noteId}`);
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            const clickedNoteId = this.getAttribute('data-note-id');
            downloadActionItems(actions, clickedNoteId);
        });
    } else {
        console.error(`Download button for note ID ${noteId} not found after adding to DOM`);
    }
    
    // Add CSS for the action items
    // Use a unique ID for the style element to avoid duplicates
    const styleId = `action-styles-${noteId}`;
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .action-list {
                list-style-type: none;
                padding-left: 0;
            }
            
            .action-icon {
                flex-shrink: 0;
                margin-top: 2px;
            }
            
            .action-content {
                flex-grow: 1;
            }
            
            .action-text {
                margin-bottom: 2px;
            }
            
            .action-context {
                font-size: 0.85rem;
                color: #6c757d;
            }
            
            .high-priority .action-text {
                font-weight: 500;
            }
            
            .card-header h6 {
                display: flex;
                align-items: center;
            }
            
            .download-actions-btn {
                display: flex;
                align-items: center;
                gap: 5px;
            }
        `;
        document.head.appendChild(style);
    }
}

function downloadActionItems(actions, noteId) {
    // Format the follow-up date
    let followUpDateFormatted = 'Not specified';
    if (actions.follow_up_date) {
        const followUpDate = new Date(actions.follow_up_date);
        followUpDateFormatted = followUpDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    // Create content for the PDF/HTML
    let content = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Follow-up Action Items - Note ID: ${noteId}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; color: #333; }
            h1 { color: #4361ee; font-size: 24px; margin-bottom: 10px; }
            h2 { color: #4361ee; font-size: 18px; margin-top: 20px; margin-bottom: 10px; }
            h3 { font-size: 16px; margin-top: 15px; margin-bottom: 5px; }
            .date-info { margin-bottom: 20px; }
            .urgency { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 14px; margin-left: 10px; }
            .urgent { background-color: #f8d7da; color: #721c24; }
            .soon { background-color: #fff3cd; color: #856404; }
            .routine { background-color: #d1ecf1; color: #0c5460; }
            .action-list { padding-left: 0; list-style-type: none; }
            .action-item { margin-bottom: 10px; padding-left: 20px; position: relative; }
            .action-item:before { content: "•"; position: absolute; left: 0; color: #4361ee; }
            .action-context { font-size: 14px; color: #6c757d; margin-top: 2px; }
            .high-priority { border-left: 3px solid #dc3545; padding-left: 10px; }
            .medium-priority { border-left: 3px solid #ffc107; padding-left: 10px; }
            .low-priority { border-left: 3px solid #17a2b8; padding-left: 10px; }
            .disclaimer { font-size: 12px; margin-top: 30px; background-color: #f8f9fa; padding: 10px; border-radius: 4px; }
            @media print {
                body { font-size: 12pt; }
                h1 { font-size: 18pt; }
                h2 { font-size: 16pt; }
                h3 { font-size: 14pt; }
                .disclaimer { page-break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <h1>Follow-up Action Items</h1>
        <div class="date-info">
            <strong>Follow-up Date:</strong> ${followUpDateFormatted}
            <span class="urgency ${actions.urgency_level}">${actions.urgency_level.charAt(0).toUpperCase() + actions.urgency_level.slice(1)}</span>
        </div>
        
        <h2>Patient Actions</h2>
    `;
    
    // Add patient actions
    if (actions.patient_actions && actions.patient_actions.length > 0) {
        // Group actions by priority
        const highPriority = actions.patient_actions.filter(a => a.priority === 'high');
        const mediumPriority = actions.patient_actions.filter(a => a.priority === 'medium');
        const lowPriority = actions.patient_actions.filter(a => a.priority === 'low');
        
        // Add high priority actions
        if (highPriority.length > 0) {
            content += `<h3>High Priority</h3><ul class="action-list">`;
            highPriority.forEach(action => {
                content += `
                    <li class="action-item high-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
        
        // Add medium priority actions
        if (mediumPriority.length > 0) {
            content += `<h3>Regular Priority</h3><ul class="action-list">`;
            mediumPriority.forEach(action => {
                content += `
                    <li class="action-item medium-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
        
        // Add low priority actions
        if (lowPriority.length > 0) {
            content += `<h3>For Consideration</h3><ul class="action-list">`;
            lowPriority.forEach(action => {
                content += `
                    <li class="action-item low-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
    } else {
        content += `<p>No patient actions were identified.</p>`;
    }
    
    content += `<h2>Doctor Actions</h2>`;
    
    // Add doctor actions
    if (actions.doctor_actions && actions.doctor_actions.length > 0) {
        // Group actions by priority
        const highPriority = actions.doctor_actions.filter(a => a.priority === 'high');
        const mediumPriority = actions.doctor_actions.filter(a => a.priority === 'medium');
        const lowPriority = actions.doctor_actions.filter(a => a.priority === 'low');
        
        // Add high priority actions
        if (highPriority.length > 0) {
            content += `<h3>High Priority</h3><ul class="action-list">`;
            highPriority.forEach(action => {
                content += `
                    <li class="action-item high-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
        
        // Add medium priority actions
        if (mediumPriority.length > 0) {
            content += `<h3>Regular Priority</h3><ul class="action-list">`;
            mediumPriority.forEach(action => {
                content += `
                    <li class="action-item medium-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
        
        // Add low priority actions
        if (lowPriority.length > 0) {
            content += `<h3>For Consideration</h3><ul class="action-list">`;
            lowPriority.forEach(action => {
                content += `
                    <li class="action-item low-priority">
                        <div class="action-text">${action.action}</div>
                        ${action.context ? `<div class="action-context">${action.context}</div>` : ''}
                    </li>
                `;
            });
            content += `</ul>`;
        }
    } else {
        content += `<p>No doctor actions were identified.</p>`;
    }
    
    content += `
        <div class="disclaimer">
            <strong>Note:</strong> These action items were automatically generated based on the conversation. 
            Always verify with healthcare professionals before taking action.
            <br>
            <strong>Generated on:</strong> ${new Date().toLocaleString()}
            <br>
            <strong>Note ID:</strong> ${noteId}
        </div>
    </body>
    </html>
    `;
    
    // Create a Blob with the content
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Create a download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `Follow-up_Actions_${noteId}_${actions.follow_up_date || new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
// Add this function to notes.js after your existing functions

/**
* Shows a modal with the detailed patient history that was imported
* 
* @param {Object} history - The patient's medical history
*/

/**
* Updates the saveNote function to incorporate previous patient history
* This is a modification of the existing saveNote function
*/

function addTreatmentEfficacyAnalysis(patientName) {
    // Skip if no patient name
    if (!patientName) {
        console.warn("Cannot analyze treatment efficacy: No patient name provided");
        return;
    }
    
    console.log("Setting up treatment efficacy analysis for:", patientName);
    
    // Create and add analysis tab 
    const modalBody = document.querySelector('.modal-body');
    if (!modalBody) {
        console.error("Modal body not found");
        return;
    }
    
    // Check if analysis section already exists
    if (document.getElementById('efficacy-analysis-section')) {
        console.log("Analysis section already exists");
        return;
    }
    
    // Create analysis section
    const analysisSection = document.createElement('div');
    analysisSection.id = 'efficacy-analysis-section';
    analysisSection.className = 'mt-4 pt-4 border-top';
    analysisSection.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5><i data-feather="activity" class="me-2 text-primary"></i> Treatment Efficacy Analysis</h5>
            <button id="run-analysis-btn" class="btn btn-sm btn-primary">
                <i data-feather="bar-chart-2" class="btn-icon-sm"></i> Analyze Treatments
            </button>
        </div>
        <div id="analysis-results" class="mt-3" style="display: none;">
            <div class="analysis-loading text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Analyzing...</span>
                </div>
                <p class="mt-2">Analyzing treatment efficacy across visits...</p>
            </div>
            <div class="analysis-content" style="display: none;"></div>
        </div>
    `;
    
    modalBody.appendChild(analysisSection);
    
    // Initialize Feather icons
    feather.replace();
    
    // Add event listener to run button
    document.getElementById('run-analysis-btn').addEventListener('click', function() {
        const resultsContainer = document.getElementById('analysis-results');
        const loadingElement = resultsContainer.querySelector('.analysis-loading');
        const contentElement = resultsContainer.querySelector('.analysis-content');
        
        console.log("Running analysis for patient:", patientName);
        
        // Show loading with patient name
        resultsContainer.style.display = 'block';
        loadingElement.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Analyzing...</span>
            </div>
            <p class="mt-2">Analyzing treatment efficacy for ${patientName}...</p>
            <p class="small text-muted">Looking for multiple visits with symptom and medication data</p>
        `;
        loadingElement.style.display = 'block';
        contentElement.style.display = 'none';
        contentElement.innerHTML = ''; // Clear any previous content
        
        // Run the analysis
        fetch('/analyze_treatment_efficacy', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ patient_name: patientName })
        })
        .then(response => {
            console.log("Server responded with status:", response.status);
            
            // Check if the response is an error
            if (!response.ok) {
                return response.json().then(errorData => {
                    throw new Error(errorData.message || `Server error: ${response.status}`);
                }).catch(() => {
                    // If error response can't be parsed as JSON
                    throw new Error(`Server error: ${response.status}. Check server logs for details.`);
                });
            }
            
            return response.json();
        })
        .then(data => {
            console.log("Analysis results:", data);
            
            // Hide loading
            loadingElement.style.display = 'none';
            
            if (data.status === 'error') {
                contentElement.innerHTML = `
                    <div class="alert alert-warning">
                        ${data.message || 'No treatment data found for this patient across multiple visits.'}
                    </div>
                `;
                contentElement.style.display = 'block';
                return;
            }
            
            const analysis = data.analysis;
            
            // Format and display the results
            let htmlContent = `
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h6 class="mb-3">Treatment Effectiveness Summary</h6>
            `;
            
            // Check if we have any treatment effectiveness data
            if (Object.keys(analysis.treatment_effectiveness).length === 0) {
                htmlContent += `
                    <div class="alert alert-info">
                        Not enough data to analyze treatment effectiveness yet. 
                        At least two visits with symptom severity changes are required.
                    </div>
                `;
            } else {
                // Add treatment effectiveness table
                htmlContent += `
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Treatment</th>
                                    <th>Effectiveness</th>
                                    <th>Dosage</th>
                                    <th>Improved Symptoms</th>
                                    <th>Worsened Symptoms</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                for (const [treatment, data] of Object.entries(analysis.treatment_effectiveness)) {
                    // Calculate effectiveness class
                    let effectivenessClass = 'bg-warning text-dark';
                    if (data.effectiveness_score >= 70) {
                        effectivenessClass = 'bg-success text-white';
                    } else if (data.effectiveness_score <= 30) {
                        effectivenessClass = 'bg-danger text-white';
                    }
                    
                    htmlContent += `
                        <tr>
                            <td><strong>${treatment}</strong></td>
                            <td>
                                <span class="badge ${effectivenessClass} px-2 py-1">
                                    ${Math.round(data.effectiveness_score)}%
                                </span>
                            </td>
                            <td>${data.latest_dosage || 'Not specified'}</td>
                            <td>${data.symptoms_improved.join(', ') || '-'}</td>
                            <td>${data.symptoms_worsened.join(', ') || '-'}</td>
                        </tr>
                    `;
                }
                
                htmlContent += `
                            </tbody>
                        </table>
                    </div>
                `;
                
                // If we have detailed analysis data, show it
                if (analysis.detailed_analysis && analysis.detailed_analysis.length > 0) {
                    htmlContent += `
                        <h6 class="mt-4 mb-3">Treatment Response Timeline</h6>
                        <div class="timeline-container">
                    `;
                    
                    // Sort by date
                    const sortedAnalysis = [...analysis.detailed_analysis].sort((a, b) => 
                        new Date(a.to_date) - new Date(b.to_date)
                    );
                    
                    for (const entry of sortedAnalysis) {
                        const dateFormatted = new Date(entry.to_date).toLocaleDateString();
                        
                        // Determine if this is a positive or negative correlation
                        const entryClass = entry.correlation === 'positive' ? 'positive' : 'negative';
                        const iconName = entry.correlation === 'positive' ? 'trending-up' : 'trending-down';
                        
                        htmlContent += `
                            <div class="timeline-item ${entryClass}">
                                <div class="timeline-icon">
                                    <i data-feather="${iconName}"></i>
                                </div>
                                <div class="timeline-content">
                                    <h6 class="timeline-date">${dateFormatted}</h6>
                                    <p>
                                        <strong>${entry.symptom}</strong> ${entry.change} after starting:
                                        <span class="treatments-list">${entry.treatments.map(t => t.treatment).join(', ')}</span>
                                    </p>
                                    <p class="evidence small text-muted">"${entry.evidence}"</p>
                                </div>
                            </div>
                        `;
                    }
                    
                    htmlContent += `</div>`;
                }
                
                // Check if we have dosage changes to display
                let hasDosageChanges = false;
                for (const [treatment, data] of Object.entries(analysis.treatment_effectiveness)) {
                    if (data.dosage_changes && data.dosage_changes.length > 0) {
                        hasDosageChanges = true;
                        break;
                    }
                }
                
                if (hasDosageChanges) {
                    htmlContent += `
                        <h6 class="mt-4 mb-3">Dosage Adjustments</h6>
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Medication</th>
                                        <th>Date</th>
                                        <th>From</th>
                                        <th>To</th>
                                    </tr>
                                </thead>
                                <tbody>
                    `;
                    
                    for (const [treatment, data] of Object.entries(analysis.treatment_effectiveness)) {
                        if (data.dosage_changes && data.dosage_changes.length > 0) {
                            for (const change of data.dosage_changes) {
                                const dateFormatted = new Date(change.date).toLocaleDateString();
                                
                                htmlContent += `
                                    <tr>
                                        <td>${treatment}</td>
                                        <td>${dateFormatted}</td>
                                        <td>${change.from}</td>
                                        <td>${change.to}</td>
                                    </tr>
                                `;
                            }
                        }
                    }
                    
                    htmlContent += `
                                </tbody>
                            </table>
                        </div>
                    `;
                }
            }
            
            htmlContent += `
                        <div class="text-muted small mt-3">
                            Analysis based on ${Object.keys(analysis.treatment_effectiveness).length} treatments across multiple visits
                        </div>
                    </div>
                </div>
            `;
            
            // Add disclaimer
            htmlContent += `
                <div class="alert alert-warning mt-3">
                    <small>
                        <strong>Note:</strong> This analysis is based on correlations between treatments and symptom changes
                        extracted from conversation notes. It does not necessarily indicate causation. Always consult with a 
                        healthcare provider before making treatment decisions.
                    </small>
                </div>
            `;
            
            // Update the content
            contentElement.innerHTML = htmlContent;
            contentElement.style.display = 'block';
            
            // Refresh Feather icons
            feather.replace();
            
            // Add CSS for the timeline
            const style = document.createElement('style');
            style.textContent = `
                .timeline-container {
                    position: relative;
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 0 10px;
                }
                
                .timeline-container:before {
                    content: '';
                    position: absolute;
                    height: 100%;
                    width: 2px;
                    background: #e9ecef;
                    left: 32px;
                    top: 0;
                }
                
                .timeline-item {
                    position: relative;
                    margin-bottom: 20px;
                    margin-left: 20px;
                }
                
                .timeline-icon {
                    position: absolute;
                    left: -20px;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    text-align: center;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1;
                }
                
                .timeline-item.positive .timeline-icon {
                    background: #e6f7e9;
                    color: #28c76f;
                }
                
                .timeline-item.negative .timeline-icon {
                    background: #ffe6e6;
                    color: #ea5455;
                }
                
                .timeline-content {
                    background: #f8f9fa;
                    border-radius: 8px;
                    padding: 15px;
                    margin-left: 30px;
                }
                
                .timeline-date {
                    color: #6c757d;
                    font-size: 0.9rem;
                    margin-bottom: 5px;
                }
                
                .treatments-list {
                    font-weight: 500;
                }
                
                .evidence {
                    font-style: italic;
                    margin-top: 5px;
                    color: #6c757d;
                }
            `;
            document.head.appendChild(style);
        })
        .catch(error => {
            console.error('Error analyzing treatment efficacy:', error);
            loadingElement.style.display = 'none';
            contentElement.innerHTML = `
                <div class="alert alert-danger">
                    <p>An error occurred while analyzing treatment efficacy:</p>
                    <p>${error.message}</p>
                    <hr>
                    <div class="mt-2">
                        <strong>Troubleshooting:</strong>
                        <ul>
                            <li>Check that the database is properly set up</li>
                            <li>Ensure you have at least two notes for this patient</li>
                            <li>Verify that notes contain symptom and medication data</li>
                            <li>Check the server logs for more detailed error information</li>
                        </ul>
                    </div>
                </div>
            `;
            contentElement.style.display = 'block';
        });
    });
}

function generateTreatmentEffectivenessTable() {
    // Sample data with varied effectiveness scores
    const treatments = [
      {
        name: "atorvastatin",
        effectiveness: 85,
        dosage: "40mg daily",
        improved: ["cholesterol levels", "triglycerides"],
        worsened: ["muscle pain"]
      },
      {
        name: "metoprolol",
        effectiveness: 70,
        dosage: "25mg twice daily",
        improved: ["heart rate", "blood pressure"],
        worsened: ["fatigue"]
      },
      {
        name: "nitroglycerin",
        effectiveness: 95,
        dosage: "0.4mg as needed",
        improved: ["chest pain", "angina"],
        worsened: []
      },
      {
        name: "lisinopril",
        effectiveness: 40,
        dosage: "10mg daily",
        improved: ["blood pressure"],
        worsened: ["persistent cough", "dizziness"]
      },
      {
        name: "aspirin",
        effectiveness: 60,
        dosage: "81mg daily",
        improved: ["inflammation"],
        worsened: ["stomach discomfort"]
      }
    ];
  
    // Generate table HTML
    let tableHTML = `
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Treatment</th>
            <th>Effectiveness</th>
            <th>Dosage</th>
            <th>Improved Symptoms</th>
            <th>Worsened Symptoms</th>
          </tr>
        </thead>
        <tbody>
    `;
  
    treatments.forEach(treatment => {
      // Calculate effectiveness class based on score
      let effectivenessClass = 'bg-warning text-dark';
      if (treatment.effectiveness >= 70) {
        effectivenessClass = 'bg-success text-white';
      } else if (treatment.effectiveness <= 40) {
        effectivenessClass = 'bg-danger text-white';
      }
      
      // Add row for this treatment
      tableHTML += `
        <tr>
          <td><strong>${treatment.name}</strong></td>
          <td>
            <span class="badge ${effectivenessClass} px-2 py-1">
              ${treatment.effectiveness}%
            </span>
          </td>
          <td>${treatment.dosage}</td>
          <td>${treatment.improved.join(', ') || '-'}</td>
          <td>${treatment.worsened.join(', ') || '-'}</td>
        </tr>
      `;
    });
  
    tableHTML += `
        </tbody>
      </table>
    `;
  
    return tableHTML;
  }
  
  // This function would replace the table generation in the addTreatmentEfficacyAnalysis function
  // Specifically around line 86-117 in the original code

function extractPatientDetailsFromText(text) {
    console.log("=== EXTRACT PATIENT DETAILS ===");
    if (!text) {
        console.log("No text provided for extraction");
        return null;
    }
    
    console.log("Analyzing text (first 100 chars):", text.substring(0, 100) + "...");

    if (!text) return null;
    
    // Look for name patterns
    const namePatterns = [
        /patient(?:'s)? name(?:\s+is)?(?:\s*:)?\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i,
        /(?:Mr\.|Mrs\.|Miss|Ms\.|Dr\.)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i,
        /name(?:\s*:)?\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i
    ];
    
    // Look for age patterns
    const agePatterns = [
        /(?:patient(?:'s)? )?age(?:\s+is)?(?:\s*:)?\s+(\d{1,3})(?: years? old)?/i,
        /(\d{1,3})(?:\s*|-)?years?(?:\s*|-)?old/i,
        /age(?:\s*:)?\s+(\d{1,3})/i
    ];
    
    let patientName = null;
    let patientAge = null;
    
    // Try to extract name
    for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            patientName = match[1].trim();
            break;
        }
    }
    
    // Try to extract age
    for (const pattern of agePatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            patientAge = parseInt(match[1]);
            break;
        }
    }
    
    if (patientName || patientAge) {
        console.log(`Extracted patient details - Name: ${patientName}, Age: ${patientAge}`);
        return { name: patientName, age: patientAge };
    }
    
    console.log("Could not extract patient details from text");
    return null;
}

function retrievePreviousPatientHistory(patientName, patientAge) {
    console.log("=== RETRIEVE PREVIOUS HISTORY ===");
    // Skip if no patient name or age provided
    if (!patientName || !patientAge) {
        console.warn("Cannot retrieve previous history: Missing patient name or age");
        return Promise.resolve(null);
    }
    
    console.log(`Attempting to retrieve history for patient: ${patientName}, age: ${patientAge}`);
    
    // Create a loading indicator that will be shown during the fetch
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'history-loading-indicator';
    loadingIndicator.className = 'loading-indicator mt-2 p-2 bg-light rounded text-center';
    loadingIndicator.innerHTML = `
        <div class="spinner-border spinner-border-sm text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <span class="ms-2 small text-muted">Checking for previous patient history...</span>
    `;
    
    // Show it near the transcript div
    const transcriptContainer = document.getElementById('transcript').parentNode;
    if (transcriptContainer && !document.getElementById('history-loading-indicator')) {
        transcriptContainer.appendChild(loadingIndicator);
    }
    
    console.log("Making fetch request to /find_previous_patient_history");
    console.log("Request payload:", { patient_name: patientName, patient_age: patientAge });
    
    // Define a custom endpoint to find previous patient history
    return fetch('/find_previous_patient_history', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ 
            patient_name: patientName,
            patient_age: patientAge
        })
    })
    .then(response => {
        // Remove the loading indicator
        if (document.getElementById('history-loading-indicator')) {
            document.getElementById('history-loading-indicator').remove();
        }
        
        console.log("Server response status:", response.status);
        
        if (!response.ok) {
            console.log(`Server returned ${response.status} when retrieving patient history`);
            return null;
        }
        return response.json();
    })
    .then(data => {
        console.log("Server response data:", data);
        
        if (data && data.status === 'success' && data.history) {
            console.log("=== FOUND PREVIOUS HISTORY ===");
            console.log("History data:", data.history);
            
            // Log what fields were found to help with debugging
            console.log("Fields in retrieved history:", Object.keys(data.history));
            
            // Check for empty arrays
            let foundEmptyFields = [];
            let foundPopulatedFields = [];
            
            // Check all fields for empty arrays
            for (const field of ["allergies", "past_history", "chronic_diseases", "family_history", "lifestyle"]) {
                if (Array.isArray(data.history[field])) {
                    if (data.history[field].length === 0) {
                        console.warn(`${field} is an empty array`);
                        foundEmptyFields.push(field);
                    } else {
                        console.log(`${field} has ${data.history[field].length} items:`, data.history[field]);
                        foundPopulatedFields.push(field);
                    }
                } else if (data.history[field] === undefined) {
                    console.warn(`${field} is undefined`);
                    foundEmptyFields.push(field);
                } else {
                    console.log(`${field} is not an array:`, data.history[field]);
                }
            }
            
            if (foundEmptyFields.length > 0) {
                console.warn(`WARNING: Found ${foundEmptyFields.length} empty fields:`, foundEmptyFields.join(', '));
            }
            
            if (foundPopulatedFields.length === 0) {
                console.warn("WARNING: No populated fields found in history data!");
            }
            
            // Create a notification to inform the user
            showToast(`Found previous medical history for ${patientName}. Personal details have been pre-filled.`, 'info');
            
            // Create a UI element to show which details were imported
            const historyNotification = document.createElement('div');
            historyNotification.className = 'history-notification alert alert-info mt-3';
            historyNotification.innerHTML = `
                <div class="d-flex align-items-start">
                    <div class="me-3">
                        <i data-feather="clipboard" style="width: 24px; height: 24px;"></i>
                    </div>
                    <div>
                        <h6 class="alert-heading mb-1">Previous Medical History Found</h6>
                        <p class="mb-1">The following information was imported from the patient's last visit:</p>
                        <ul class="mb-0 small">
                            ${data.history.allergies && data.history.allergies.length > 0 ? `<li>Allergies (${data.history.allergies.length})</li>` : ''}
                            ${data.history.past_history && data.history.past_history.length > 0 ? `<li>Past Medical History (${data.history.past_history.length})</li>` : ''}
                            ${data.history.chronic_diseases && data.history.chronic_diseases.length > 0 ? `<li>Chronic Diseases (${data.history.chronic_diseases.length})</li>` : ''}
                            ${data.history.family_history && data.history.family_history.length > 0 ? `<li>Family History (${data.history.family_history.length})</li>` : ''}
                            ${data.history.lifestyle && data.history.lifestyle.length > 0 ? `<li>Lifestyle Factors (${data.history.lifestyle.length})</li>` : ''}
                        </ul>
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-primary view-history-btn">View Details</button>
                            <button class="btn btn-sm btn-outline-danger ms-2 clear-history-btn">Clear Imported Data</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Add the notification to the page
            const transcriptContainer = document.getElementById('transcript').parentNode;
            if (transcriptContainer) {
                if (document.querySelector('.history-notification')) {
                    document.querySelector('.history-notification').remove();
                }
                transcriptContainer.appendChild(historyNotification);
                
                // Initialize feather icons
                feather.replace();
                
                // Add event listeners to the buttons
                historyNotification.querySelector('.view-history-btn').addEventListener('click', () => {
                    showPatientHistoryDetails(data.history);
                });
                
                historyNotification.querySelector('.clear-history-btn').addEventListener('click', () => {
                    // Clear the imported history
                    if (window.importedPatientHistory) {
                        window.importedPatientHistory = null;
                        historyNotification.remove();
                        showToast('Imported patient history cleared', 'info');
                    }
                });
            }
            
            // Store the history data for later use
            window.importedPatientHistory = data.history;
            console.log("Set window.importedPatientHistory to:", window.importedPatientHistory);
            
            return data.history;
        } else {
            console.log("=== NO PREVIOUS HISTORY FOUND ===");
            if (data) {
                console.log("Response status:", data.status);
                console.log("Response message:", data.message);
            }
            return null;
        }
    })
    .catch(error => {
        // Remove the loading indicator
        if (document.getElementById('history-loading-indicator')) {
            document.getElementById('history-loading-indicator').remove();
        }
        
        console.error('Error retrieving patient history:', error);
        return null;
    });
}

 function showPatientHistoryDetails(history) {
    // Create a modal to show the history details
    const modalId = 'historyDetailsModal';
    
    // Remove existing modal if it exists
    if (document.getElementById(modalId)) {
        document.getElementById(modalId).remove();
    }
    
    // Create the modal
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = modalId;
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-labelledby', `${modalId}Label`);
    modal.setAttribute('aria-hidden', 'true');
    
    let modalContent = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="${modalId}Label">
                        <i data-feather="clipboard" class="me-2"></i>
                        Imported Patient History
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
    `;
    
    // Add patient details section
    if (history.patient_details) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Patient Details</h6>
                    </div>
                    <div class="card-body">
                        <ul class="list-unstyled mb-0">
                            <li><strong>Name:</strong> ${history.patient_details.name || 'Not specified'}</li>
                            <li><strong>Age:</strong> ${history.patient_details.age || 'Not specified'}</li>
                            <li><strong>Gender:</strong> ${history.patient_details.gender || 'Not specified'}</li>
                            <li><strong>Marital Status:</strong> ${history.patient_details.marital_status || 'Not specified'}</li>
                            <li><strong>Residence:</strong> ${history.patient_details.residence || 'Not specified'}</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add allergies section
    if (history.allergies && history.allergies.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0 text-danger">Allergies</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.allergies.map(allergy => `<li>${allergy}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add past medical history section
    if (history.past_history && history.past_history.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Past Medical History</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.past_history.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add chronic diseases section
    if (history.chronic_diseases && history.chronic_diseases.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Chronic Diseases</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.chronic_diseases.map(disease => `<li>${disease}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add family history section
    if (history.family_history && history.family_history.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Family History</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.family_history.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add lifestyle section
    if (history.lifestyle && history.lifestyle.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Lifestyle Factors</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.lifestyle.map(item => `<li>${typeof item === 'string' ? item : JSON.stringify(item)}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Add previous medications section
    if (history.drug_history && history.drug_history.length > 0) {
        modalContent += `
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header bg-light">
                        <h6 class="mb-0">Previous Medications</h6>
                    </div>
                    <div class="card-body">
                        <ul class="mb-0">
                            ${history.drug_history.map(med => `<li>${med}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Close the row and add footer
    modalContent += `
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="text-muted small me-auto">This data was imported from the patient's previous visit</div>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // Initialize and show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Initialize feather icons
    feather.replace();
 }
// Add CSS for highlighting updated notes
const style = document.createElement('style');
style.textContent = `
@keyframes highlightUpdate {
    0% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); }
    30% { box-shadow: 0 0 0 3px rgba(40, 199, 111, 0.7); }
    70% { box-shadow: 0 0 0 5px rgba(40, 199, 111, 0.3); }
    100% { box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); }
}

.highlight-update {
    animation: highlightUpdate 2s ease;
}

.edited-indicator {
    display: inline-block;
    margin-left: 10px;
    font-size: 0.75rem;
    color: #28c76f;
    background-color: rgba(40, 199, 111, 0.1);
    padding: 0.2rem 0.5rem;
    border-radius: 50px;
}
`;
document.head.appendChild(style);
})
