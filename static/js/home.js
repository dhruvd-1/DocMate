// Initialize functionality when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Fix any missing images by replacing with placeholders
  document.querySelectorAll('img').forEach(function(img) {
    img.addEventListener('error', function() {
      if (!this.src.includes('placeholder')) {
        const alt = this.alt || 'Image';
        this.src = `https://via.placeholder.com/600x400?text=${alt.replace(/\s+/g, '+')}`;
      }
    });
  });

  // Initialize AOS animations if AOS is available
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      offset: 120,
      easing: 'ease-in-out',
      once: true
    });
  }

  // Initialize Feather icons if available
  if (typeof feather !== 'undefined') {
    feather.replace();
  }
  
  // Add custom class to feather star icons
  document.querySelectorAll('.star-filled').forEach(function(star) {
    star.style.color = '#ffb400';
    star.style.fill = '#ffb400';
  });
  
  document.querySelectorAll('.star-empty').forEach(function(star) {
    star.style.color = '#e0e0e0';
    star.style.fill = '#e0e0e0';
  });
  
  // Advanced text typing animations inspired by anime.js
  function typeText(element, text, speed = 70, delay = 0) {
    let index = 0;
    let currentText = '';
    
    // Clear any existing text
    element.textContent = '';
    
    // Add delay before starting typing
    setTimeout(function() {
      let typingInterval = setInterval(function() {
        if (index < text.length) {
          currentText += text.charAt(index);
          element.textContent = currentText;
          index++;
        } else {
          clearInterval(typingInterval);
        }
      }, speed);
    }, delay);
  }
  
  // Patient note content to type
  const patientContent = "Sarah Johnson, 37";
  const symptomsContent = "Persistent headache, fatigue, blurred vision";
  const diagnosisContent = "Migraine with aura, possible hypertension";
  const treatmentContent = "Prescribed sumatriptan, recommended stress management";
  
  // Get elements
  const patientTextElement = document.getElementById('patient-text');
  const symptomsTextElement = document.getElementById('symptoms-text');
  const diagnosisTextElement = document.getElementById('diagnosis-text');
  const treatmentTextElement = document.getElementById('treatment-text');

  // Only proceed if elements exist
  if (patientTextElement && symptomsTextElement && diagnosisTextElement && treatmentTextElement) {
    // Start animations with sequential delays
    typeText(patientTextElement, patientContent, 70, 800);
    typeText(symptomsTextElement, symptomsContent, 50, 2000);
    typeText(diagnosisTextElement, diagnosisContent, 60, 4000);
    typeText(treatmentTextElement, treatmentContent, 40, 6000);
    
    // Repeat the animation sequence every 12 seconds
    setInterval(function() {
      // Clear all text first
      patientTextElement.textContent = '';
      symptomsTextElement.textContent = '';
      diagnosisTextElement.textContent = '';
      treatmentTextElement.textContent = '';
      
      // Restart typing animations
      setTimeout(function() {
        typeText(patientTextElement, patientContent, 70, 100);
        typeText(symptomsTextElement, symptomsContent, 50, 1300);
        typeText(diagnosisTextElement, diagnosisContent, 60, 3300);
        typeText(treatmentTextElement, treatmentContent, 40, 5300);
      }, 500);
    }, 12000);
  }
  
  // Sequential animation for process steps
  function animateProcess() {
    // Only run if we're on the page with process steps
    if (!document.querySelector('.process-steps')) return;
    
    // Add floating effect to process steps on scroll
    const processSteps = document.querySelectorAll('.process-step');
    
    processSteps.forEach((step, index) => {
      // Add hover effect for 3D rotation
      step.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const angleY = (x - centerX) / 20;
        const angleX = (centerY - y) / 20;
        
        this.style.transform = `rotateX(${angleX}deg) rotateY(${angleY}deg) translateZ(10px)`;
      });
      
      step.addEventListener('mouseleave', function() {
        this.style.transform = 'rotateX(0) rotateY(0) translateZ(0)';
      });
    });
  }
  
  // Call the function to activate animations
  setTimeout(function() {
    animateProcess();
  }, 1000);
  
  // Run again if window resizes
  window.addEventListener('resize', function() {
    animateProcess();
  });
});