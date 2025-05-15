// Symptom Checker JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Quick symptom group selection
    const commonGroups = [
        { name: "Cold/Flu", symptoms: ["Fever", "Cough", "Sore Throat", "Runny Nose", "Fatigue"] },
        { name: "Digestive", symptoms: ["Nausea", "Diarrhea", "Abdominal Pain", "Vomiting"] },
        { name: "Respiratory", symptoms: ["Cough", "Difficulty Breathing", "Chest Pain"] },
        { name: "Pain", symptoms: ["Headache", "Body Aches", "Joint Pain", "Chest Pain", "Abdominal Pain"] }
    ];
    
    // Create quick select buttons if container exists
    const quickSelectContainer = document.querySelector('.quick-select-container');
    if (quickSelectContainer) {
        commonGroups.forEach(group => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'quick-select-btn';
            button.textContent = group.name;
            button.addEventListener('click', () => {
                // Uncheck all checkboxes first
                document.querySelectorAll('input[name="symptoms"]').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Check the symptoms in this group
                group.symptoms.forEach(symptom => {
                    const checkbox = document.getElementById(symptom);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            });
            quickSelectContainer.appendChild(button);
        });
    }
    
    // Symptom search functionality
    const searchInput = document.getElementById('symptom-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            document.querySelectorAll('.symptom-checkbox').forEach(item => {
                const symptomText = item.textContent.toLowerCase();
                if (searchTerm === '' || symptomText.includes(searchTerm)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
    
    // Form validation - require at least one symptom
    const form = document.querySelector('form');
    if (form) {
        form.addEventListener('submit', function(e) {
            const checkedSymptoms = document.querySelectorAll('input[name="symptoms"]:checked');
            if (checkedSymptoms.length === 0) {
                e.preventDefault();
                alert('Please select at least one symptom');
            }
        });
    }
    
    // In prediction result page, add class based on confidence level
    const confidenceElement = document.querySelector('.progress-bar');
    if (confidenceElement) {
        const confidenceValue = parseInt(confidenceElement.getAttribute('aria-valuenow'));
        if (confidenceValue >= 70) {
            confidenceElement.classList.add('bg-success');
        } else if (confidenceValue >= 40) {
            confidenceElement.classList.add('bg-warning');
        } else {
            confidenceElement.classList.add('bg-danger');
        }
    }
});