/* Main JavaScript for Health Companion app */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips if Bootstrap is used
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
    if (typeof bootstrap !== 'undefined') {
        var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        });
    }
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Example form validation
    const forms = document.querySelectorAll('.needs-validation');
    
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            
            form.classList.add('was-validated');
        }, false);
    });
    
    // Flash message auto-dismiss
    const flashMessages = document.querySelectorAll('.alert-dismissible');
    
    flashMessages.forEach(message => {
        setTimeout(() => {
            const closeButton = message.querySelector('.btn-close');
            if (closeButton) {
                closeButton.click();
            }
        }, 5000); // Auto-dismiss after 5 seconds
    });
});