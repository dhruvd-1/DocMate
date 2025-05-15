// Lipid Profile JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    // Form validation with visual feedback
    const lipidForm = document.querySelector('form');
    if (lipidForm) {
        const inputs = lipidForm.querySelectorAll('input[type="number"]');
        
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                validateInput(this);
            });
            
            input.addEventListener('blur', function() {
                validateInput(this);
            });
        });
        
        lipidForm.addEventListener('submit', function(e) {
            let isValid = true;
            
            inputs.forEach(input => {
                if (!validateInput(input)) {
                    isValid = false;
                }
            });
            
            if (!isValid) {
                e.preventDefault();
                alert('Please correct the errors in the form.');
            }
        });
    }
    
    // Function to validate each input field
    function validateInput(input) {
        const value = parseFloat(input.value);
        const min = 0;
        const max = 1000; // Set a reasonable maximum
        
        let isValid = true;
        let errorMessage = '';
        
        // Clear previous validation
        input.classList.remove('is-invalid', 'is-valid');
        const errorElement = input.parentElement.querySelector('.invalid-feedback');
        if (errorElement) {
            errorElement.remove();
        }
        
        // Check if empty
        if (input.value === '') {
            isValid = false;
            errorMessage = 'This field is required';
        } 
        // Check if a number
        else if (isNaN(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid number';
        } 
        // Check if within range
        else if (value < min || value > max) {
            isValid = false;
            errorMessage = `Value must be between ${min} and ${max}`;
        }
        
        // Add validation feedback
        if (!isValid) {
            input.classList.add('is-invalid');
            const feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            feedback.textContent = errorMessage;
            input.parentElement.appendChild(feedback);
        } else {
            input.classList.add('is-valid');
        }
        
        return isValid;
    }
    
    // Add additional check for TC > HDL + LDL
    const tcInput = document.getElementById('total_cholesterol');
    const hdlInput = document.getElementById('hdl_cholesterol');
    const ldlInput = document.getElementById('ldl_cholesterol');
    
    if (tcInput && hdlInput && ldlInput) {
        const validateLipidRelation = function() {
            const tc = parseFloat(tcInput.value) || 0;
            const hdl = parseFloat(hdlInput.value) || 0;
            const ldl = parseFloat(ldlInput.value) || 0;
            
            // Remove previous warnings
            const warningElement = document.querySelector('.lipid-relation-warning');
            if (warningElement) {
                warningElement.remove();
            }
            
            // Only validate if all values are entered and valid
            if (tc > 0 && hdl > 0 && ldl > 0) {
                // Check if total cholesterol is less than HDL + LDL
                if (tc < hdl + ldl) {
                    const warning = document.createElement('div');
                    warning.className = 'alert alert-warning lipid-relation-warning mt-3';
                    warning.innerHTML = '<strong>Warning:</strong> Total cholesterol should be greater than or equal to HDL + LDL. Please check your values.';
                    lipidForm.insertBefore(warning, lipidForm.querySelector('.text-center'));
                    return false;
                }
            }
            return true;
        };
        
        [tcInput, hdlInput, ldlInput].forEach(input => {
            input.addEventListener('change', validateLipidRelation);
        });
        
        // Add additional form validation
        lipidForm.addEventListener('submit', function(e) {
            if (!validateLipidRelation()) {
                e.preventDefault();
            }
        });
    }
});

// Function to generate PDF report
function generatePDFReport() {
    const reportContainer = document.getElementById('report-container');
    if (!reportContainer) return;
    
    // Show loading indicator
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Generating PDF...</p>';
    
    document.body.appendChild(loadingOverlay);
    
    // Use html2pdf library to generate PDF
    const opt = {
        margin: 1,
        filename: 'lipid-profile-analysis.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Generate PDF
    html2pdf().set(opt).from(reportContainer).save().then(() => {
        // Remove loading overlay
        document.body.removeChild(loadingOverlay);
    });
}