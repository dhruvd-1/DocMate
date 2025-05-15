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
        saveBtn.onclick = function() {
            saveNote();
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
        saveSummaryBtn.addEventListener('click', function() {
            saveEditedSummary();
        });
        
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

    // Handle audio file upload
        // Function to handle audio file upload and transcription
    // Function to handle audio file upload and transcription
    // Enhanced audio upload and transcription handling
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
        .then(res => res.json())
        .then(data => {
            console.log('Note saved:', data);
            
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
            showToast('Failed to save note. Please try again.', 'error');
        });
    }

    // Load existing notes
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
                notesContainer.innerHTML = '';
                
                if (notes.length === 0) {
                    notesContainer.innerHTML = `
                        <div class="col-12 text-center py-5">
                            <p class="text-muted">No notes found. Record your first medical note to get started.</p>
                        </div>
                    `;
                    return;
                }
                
                // Create note cards in reverse order (newest first)
                notes.reverse().forEach((note, index) => {
                    createNoteCard(note, `note-${index}`);
                });
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                notesContainer.innerHTML = `
                    <div class="col-12 text-center py-4">
                        <p class="text-danger">Error loading notes. Please refresh the page.</p>
                    </div>
                `;
            });
    }

    // Create a note card from the data
    function createNoteCard(noteData, noteId = `note-${Date.now()}`) {
        const noteCard = document.createElement('div');
        noteCard.className = 'note-card';
        noteCard.dataset.noteId = noteId;
        
        // Generate a note date (would be provided by server in real implementation)
        const noteDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Extract patient info
        const patientDetails = noteData.summary.patient_details || {};
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
        
        // Chief complaints section
        if (noteData.summary.chief_complaints && noteData.summary.chief_complaints.length > 0) {
            contentHTML += `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="alert-circle"></i> Chief Complaints</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            noteData.summary.chief_complaints.forEach(complaint => {
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
        if (noteData.summary.allergies && noteData.summary.allergies.length > 0) {
            contentHTML += `
                <div class="alert-section alert-allergy">
                    <strong><i data-feather="alert-triangle"></i> Allergies:</strong> ${noteData.summary.allergies.join(', ')}
                </div>
            `;
        }
        
        // Symptoms section
        if (noteData.summary.symptoms && noteData.summary.symptoms.length > 0) {
            contentHTML += `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="activity"></i> Symptoms</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            noteData.summary.symptoms.forEach(symptom => {
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
        if (noteData.summary.chronic_diseases && noteData.summary.chronic_diseases.length > 0) {
            contentHTML += `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="heart"></i> Chronic Conditions</h4>
                    <div class="content-body">
                        ${noteData.summary.chronic_diseases.join(', ')}
                    </div>
                </div>
            `;
        }
        
        // Possible diseases section
        if (noteData.summary.possible_diseases && noteData.summary.possible_diseases.length > 0) {
            contentHTML += `
                <div class="content-section">
                    <h4 class="content-title"><i data-feather="thermometer"></i> Possible Conditions</h4>
                    <div class="content-body">
                        <div class="tags-container">
                            <div class="tags-list">
            `;
            
            noteData.summary.possible_diseases.forEach(disease => {
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
        
        // Footer with view details button
        let footerHTML = `
            <div class="note-footer">
                <button class="btn btn-view-details" data-note-id="${noteId}">
                    <i data-feather="eye"></i> View Complete Details
                </button>
            </div>
        `;
        
        // Combine all sections
        noteCard.innerHTML = headerHTML + patientInfoHTML + contentHTML + footerHTML;
        
        // Add to notes container
        notesContainer.appendChild(noteCard);
        
        // Initialize feather icons
        feather.replace();
        
        // Add event listener to view details button
        noteCard.querySelector('.btn-view-details').addEventListener('click', function() {
            openNoteDetails(noteData, noteId);
        });
    }

    // Open note details modal
    function openNoteDetails(noteData, noteId) {
        // Store current note ID and summary
        currentNoteId = noteId;
        currentSummary = noteData.summary;
        
        // Set original note content
        originalNoteContent.textContent = noteData.original;
        
        // Format and display the summary
        formatSummaryContent(noteData.summary);
        
        // Reset editing state
        summaryContent.contentEditable = "false";
        editSummaryBtn.style.display = 'inline-block';
        saveSummaryBtn.style.display = 'none';
        
        // Open the modal
        noteDetailsModal.show();
    }
    
    // Format summary content for display
    function formatSummaryContent(summary) {
        let formattedContent = '';
        
        // Patient Details
        formattedContent += '<h4>Patient Details</h4>';
        const patientDetails = summary.patient_details || {};
        
        if (patientDetails.name || patientDetails.age || patientDetails.gender || 
            patientDetails.marital_status || patientDetails.residence) {
            
            formattedContent += '<ul>';
            
            if (patientDetails.name) {
                formattedContent += `<li><strong>Name:</strong> ${patientDetails.name}</li>`;
            }
            
            if (patientDetails.age) {
                formattedContent += `<li><strong>Age:</strong> ${patientDetails.age}</li>`;
            }
            
            if (patientDetails.gender) {
                formattedContent += `<li><strong>Gender:</strong> ${patientDetails.gender}</li>`;
            }
            
            if (patientDetails.marital_status) {
                formattedContent += `<li><strong>Marital Status:</strong> ${patientDetails.marital_status}</li>`;
            }
            
            if (patientDetails.residence) {
                formattedContent += `<li><strong>Residence:</strong> ${patientDetails.residence}</li>`;
            }
            
            formattedContent += '</ul>';
        } else {
            formattedContent += '<p>No patient details available</p>';
        }
        
        // Allergies (highlighted)
        if (summary.allergies && summary.allergies.length > 0) {
            formattedContent += '<h4 style="color: #dc3545;">Allergies</h4>';
            formattedContent += '<ul style="color: #dc3545; font-weight: bold;">';
            summary.allergies.forEach(allergy => {
                formattedContent += `<li>${allergy}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Chief Complaints
        if (summary.chief_complaints && summary.chief_complaints.length > 0) {
            formattedContent += '<h4>Chief Complaints</h4>';
            formattedContent += '<ul>';
            summary.chief_complaints.forEach(complaint => {
                formattedContent += `<li>${complaint}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Chief Complaint Details
        if (summary.chief_complaint_details && summary.chief_complaint_details.length > 0) {
            formattedContent += '<h4>Complaint Details</h4>';
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
        }
        
        // Symptoms
        if (summary.symptoms && summary.symptoms.length > 0) {
            formattedContent += '<h4>Symptoms</h4>';
            formattedContent += '<ul>';
            summary.symptoms.forEach(symptom => {
                formattedContent += `<li>${symptom}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Past History
        if (summary.past_history && summary.past_history.length > 0) {
            formattedContent += '<h4>Past History</h4>';
            formattedContent += '<ul>';
            summary.past_history.forEach(history => {
                formattedContent += `<li>${history}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Chronic Diseases
        if (summary.chronic_diseases && summary.chronic_diseases.length > 0) {
            formattedContent += '<h4>Chronic Diseases</h4>';
            formattedContent += '<ul>';
            summary.chronic_diseases.forEach(disease => {
                formattedContent += `<li>${disease}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Lifestyle
        if (summary.lifestyle && summary.lifestyle.length > 0) {
            formattedContent += '<h4>Lifestyle</h4>';
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
        }
        
        // Drug History
        if (summary.drug_history && summary.drug_history.length > 0) {
            formattedContent += '<h4>Current Medications</h4>';
            formattedContent += '<ul>';
            summary.drug_history.forEach(drug => {
                formattedContent += `<li>${drug}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Family History
        if (summary.family_history && summary.family_history.length > 0) {
            formattedContent += '<h4>Family History</h4>';
            formattedContent += '<ul>';
            summary.family_history.forEach(history => {
                formattedContent += `<li>${history}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Possible Diseases
        if (summary.possible_diseases && summary.possible_diseases.length > 0) {
            formattedContent += '<h4>Possible Conditions</h4>';
            formattedContent += '<ul>';
            summary.possible_diseases.forEach(disease => {
                formattedContent += `<li>${disease}</li>`;
            });
            formattedContent += '</ul>';
        }
        
        // Set the formatted content
        summaryContent.innerHTML = formattedContent;
    }
    
    // Save edited summary
    function saveEditedSummary() {
        if (!currentNoteId || !currentSummary) {
            showToast('Error: No active note to save', 'error');
            return;
        }
        
        // Get the edited HTML content
        const editedContent = summaryContent.innerHTML;
        
        // Create an object with the noteId and edited summary
        const data = {
            noteId: currentNoteId,
            editedSummary: editedContent,
            originalSummary: currentSummary
        };
        
        // Send to server
        fetch('/save_edited_summary', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                showToast('Summary saved successfully', 'success');
                
                // Reset edit state
                summaryContent.contentEditable = "false";
                editSummaryBtn.style.display = 'inline-block';
                saveSummaryBtn.style.display = 'none';
            } else {
                showToast('Error saving summary: ' + data.message, 'error');
            }
        })
        .catch(error => {
            console.error('Error saving edited summary:', error);
            showToast('Failed to save summary. Please try again.', 'error');
        });
    }
    
    // Download summary
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
            // Create HTML content
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Medical Summary - ${patientName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #4361ee; }
        h2 { color: #3a0ca3; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
        .allergies { color: #dc3545; font-weight: bold; }
        .footer { margin-top: 30px; font-size: 0.8em; color: #6c757d; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
</head>
<body>
    <h1>Medical Summary</h1>
    <p>Generated on ${new Date().toLocaleString()}</p>
    ${summaryContent.innerHTML}
    <div class="footer">
        <p>This summary was generated by Health Companion Medical Notes System.</p>
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
});