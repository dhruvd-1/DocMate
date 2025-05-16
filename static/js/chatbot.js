// Health Chatbot JavaScript functionality

document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chatForm');
    const userMessageInput = document.getElementById('userMessage');
    const chatContainer = document.getElementById('chatContainer');
    const suggestionButtons = document.querySelectorAll('.suggestion');
    const typingIndicator = document.getElementById('typingIndicator');
    
    // Enhanced suggestion topics for health context
    const healthTopics = [
        'Nutrition', 'Mental Health', 'Exercise', 'Sleep', 'Stress Management',
        'Preventive Care', 'First Aid', 'Common Symptoms', 'Medication', 'Fitness',
        'Allergies', 'Vitamins', 'Diet', 'Hydration', 'Immunity', 'Wellness'
    ];
    
    // Update suggestion chips based on context
    function updateSuggestionChips(context) {
        const suggestionsContainer = document.querySelector('.suggestion-chips');
        suggestionsContainer.innerHTML = ''; // Clear existing suggestions
        
        // Generate suggestions based on context or default ones
        const dynamicSuggestions = context ? 
            healthTopics.filter(topic => 
                topic.toLowerCase().includes(context.toLowerCase())
            ).slice(0, 6) : 
            ['Fever', 'Headache', 'Diet', 'Exercise', 'Sleep', 'Stress'];
        
        // Create suggestion buttons
        dynamicSuggestions.forEach(topic => {
            const button = document.createElement('button');
            button.classList.add('suggestion');
            button.textContent = topic;
            button.addEventListener('click', function() {
                userMessageInput.value = `Tell me about ${topic}`;
                chatForm.dispatchEvent(new Event('submit'));
            });
            suggestionsContainer.appendChild(button);
        });
    }
    
    // Voice input functionality with improved error handling
    function initVoiceInput() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            // Create voice button
            const voiceButton = document.createElement('button');
            voiceButton.innerHTML = '<i data-feather="mic"></i>';
            voiceButton.type = 'button';  // Prevent form submission
            voiceButton.classList.add('btn', 'btn-outline-primary', 'ms-2', 'voice-input-btn');
            
            // Voice button click handler
            voiceButton.addEventListener('click', () => {
                try {
                    recognition.start();
                    voiceButton.classList.add('active');
                    voiceButton.disabled = true;
                } catch (error) {
                    console.error('Voice recognition error:', error);
                    alert('Voice input is not supported or microphone access is denied.');
                }
            });
            
            // Recognition result handler
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript.trim();
                if (transcript) {
                    userMessageInput.value = transcript;
                    chatForm.dispatchEvent(new Event('submit'));
                }
            };
            
            // Recognition end handler
            recognition.onend = () => {
                voiceButton.classList.remove('active');
                voiceButton.disabled = false;
            };
            
            // Recognition error handler
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                voiceButton.classList.remove('active');
                voiceButton.disabled = false;
                
                // User-friendly error messages
                switch(event.error) {
                    case 'no-speech':
                        alert('No speech was detected. Please try again.');
                        break;
                    case 'audio-capture':
                        alert('No microphone was found. Ensure microphone is connected.');
                        break;
                    case 'not-allowed':
                        alert('Microphone access is blocked. Please check browser settings.');
                        break;
                    default:
                        alert('An error occurred with voice input. Please try again.');
                }
            };
            
            // Add voice button to the form
            chatForm.appendChild(voiceButton);
            feather.replace(); // Refresh Feather icons
        } else {
            console.warn('Speech recognition not supported');
        }
    }
    
    // Message sentiment analysis for response adaptation
    function analyzeSentiment(message) {
        const positiveKeywords = ['good', 'great', 'happy', 'well', 'better', 'thank', 'thanks', 'helpful'];
        const negativeKeywords = ['bad', 'terrible', 'sick', 'pain', 'worried', 'anxious', 'afraid', 'scared'];
        const urgentKeywords = ['emergency', 'urgent', 'severe', 'intense', 'worst', 'unbearable', 'help'];
        
        const lowerMessage = message.toLowerCase();
        
        // Check for urgent content first
        const urgentScore = urgentKeywords.filter(word => 
            lowerMessage.includes(word)
        ).length;
        
        if (urgentScore > 0) {
            return 'urgent';
        }
        
        // Otherwise assess positive vs negative
        const positiveScore = positiveKeywords.filter(word => 
            lowerMessage.includes(word)
        ).length;
        
        const negativeScore = negativeKeywords.filter(word => 
            lowerMessage.includes(word)
        ).length;
        
        return positiveScore > negativeScore ? 'positive' : 
               negativeScore > positiveScore ? 'negative' : 'neutral';
    }
    
    // Add message to chat container
    function addMessage(message, sender, isHtml = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
        
        if (sender === 'user') {
            const sentiment = analyzeSentiment(message);
            messageDiv.dataset.sentiment = sentiment;
            
            // For urgent messages, add a visual indicator
            if (sentiment === 'urgent') {
                messageDiv.style.borderLeft = '4px solid #ef4444';
            }
        }
        
        if (sender === 'user' || !isHtml) {
            const messagePara = document.createElement('p');
            messagePara.textContent = message;
            messagePara.classList.add('mb-0');
            messageDiv.appendChild(messagePara);
        } else {
            messageDiv.innerHTML = message;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        // Update suggestion chips based on last message context
        if (sender === 'user') {
            updateSuggestionChips(message);
        }
    }
    
    // Simulated typing animation
    function simulateTyping(duration = 1500) {
        typingIndicator.style.display = 'flex';
        setTimeout(() => {
            typingIndicator.style.display = 'none';
        }, duration);
    }
    
    // Add event listeners to suggestion buttons
    suggestionButtons.forEach(button => {
        button.addEventListener('click', function() {
            userMessageInput.value = this.textContent;
            chatForm.dispatchEvent(new Event('submit'));
        });
    });
    
    // Chat form submit handler
    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const userMessage = userMessageInput.value.trim();
        if (!userMessage) return;
        
        // Add user message to chat
        addMessage(userMessage, 'user');
        
        // Clear input
        userMessageInput.value = '';
        
        // Show typing indicator
        simulateTyping(calculateTypingDuration(userMessage));
        
        // Send to backend and get response
        fetch('/get_chatbot_response', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `user_message=${encodeURIComponent(userMessage)}`
        })
        .then(response => response.json())
        .then(data => {
            // Add bot response to chat
            addMessage(data.response, 'bot', data.isHtml || false);
        })
        .catch(error => {
            console.error('Error:', error);
            addMessage('Sorry, I encountered an error. Please try again.', 'bot');
        });
    });
    
    // Calculate typing duration based on response length
    function calculateTypingDuration(message) {
        // Estimate AI response length based on query length
        const estimatedResponseLength = Math.min(message.length * 3, 200);
        // Simulate typing time: 30ms per character with randomness
        return Math.max(1000, estimatedResponseLength * (25 + Math.random() * 10));
    }
    
    // Initialize voice input if available
    initVoiceInput();
    
    // Initial suggestions
    updateSuggestionChips();
});