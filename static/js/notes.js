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
        
        // Check if it's a WAV file
        const isWav = file.name.toLowerCase().endsWith('.wav');
        
        if (!isWav) {
            showToast('Note: Only WAV files can be transcribed. For best results, use a WAV file.', 'warning');
            
            // Add suggestion for conversion
            const conversionSuggestion = document.createElement('div');
            conversionSuggestion.className = 'alert alert-info mt-3';
            conversionSuggestion.innerHTML = `
                <h5><i data-feather="info" class="me-2"></i> Audio Format Tip</h5>
                <p>To transcribe this audio, please convert it to WAV format using an online converter such as:</p>
                <ul>
                    <li><a href="https://online-audio-converter.com/" target="_blank">Online Audio Converter</a></li>
                    <li><a href="https://convertio.co/audio-converter/" target="_blank">Convertio</a></li>
                </ul>
                <p>Then upload the converted WAV file for transcription.</p>
            `;
            
            // Add this suggestion to the page
            if (audioPlayerContainer.nextElementSibling !== conversionSuggestion) {
                if (document.querySelector('.alert-info')) {
                    document.querySelector('.alert-info').remove();
                }
                audioPlayerContainer.parentNode.insertBefore(conversionSuggestion, audioPlayerContainer.nextSibling);
                feather.replace(); // Refresh icons
            }
            
            return;
        }
        
        // If it's a WAV file, proceed with transcription
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'transcription-loading';
        loadingIndicator.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Transcribing...</span>
            </div>
            <p>Transcribing audio... This may take a minute for longer recordings.</p>
        `;
        
        // Add loading indicator to the page
        audioPlayerContainer.parentNode.insertBefore(loadingIndicator, audioPlayerContainer.nextSibling);
        
        // Show toast
        showToast('Transcribing audio file... Please wait.', 'info');
        
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
                transcriptDiv.innerText = errorMessage;
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

    // Save the current note
    // Save the current note
    // Updated saveNote function to immediately update UI
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
        body: JSON.stringify({ note: noteText })
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
    // In your openNoteDetails function, modify the code to add this:
function openNoteDetails(noteData, noteId) {
    // Store current note ID and summary
    currentNoteId = noteId; // This is critical - use the passed ID, not a hardcoded one
    console.log("Opening note details with ID:", currentNoteId);
    
    currentSummary = prepareSummaryStructure(noteData.summary);
    
    // Set original note content
    originalNoteContent.textContent = noteData.original;
    
    // Format and display the summary
    formatSummaryContent(currentSummary);
    
    // Reset editing state and ensure buttons are properly set up
    summaryContent.contentEditable = "true"; // Changed to true by default to encourage editing
    if (editSummaryBtn) {
        editSummaryBtn.style.display = 'none';
    }
    if (saveSummaryBtn) {
        saveSummaryBtn.style.display = 'inline-block';
        
        // Add these lines to ensure the save button works
        saveSummaryBtn.onclick = null; // Remove any existing handlers
        
        // Add a direct onclick handler
        saveSummaryBtn.onclick = function(event) {
            console.log("Save button clicked directly from modal for note ID:", currentNoteId);
            event.preventDefault();
            event.stopPropagation(); // Stop event bubbling
            saveEditedSummary();
            return false; // Ensure no default action
        };
    }
    
    // Open the modal
    noteDetailsModal.show();
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
