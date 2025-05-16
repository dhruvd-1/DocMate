"""
Chatbot Handler module for Health Companion app
"""
import re
import json

class ChatbotHandler:
    """
    Handler for health chatbot interactions
    """
    
    def __init__(self, ai_model=None):
        """
        Initialize the chatbot handler
        
        Args:
            ai_model: Optional AI model for advanced responses (e.g., Gemini)
        """
        self.ai_model = ai_model
        self.system_prompt = self._get_system_prompt()
        
    def _get_system_prompt(self):
        """
        Define the system prompt for the chatbot's behavior
        
        Returns:
            str: System prompt
        """
        return (
            "You are a helpful, friendly health assistant chatbot who gives assurance and strength to users. "
            "You provide general health information and advice, such as tips for managing common symptoms, "
            "improving wellness, maintaining a healthy lifestyle, and addressing mental health concerns. "
            "If a user asks for medical advice or symptoms that may require professional diagnosis, "
            "always recommend they consult a healthcare provider. "
            "Be empathetic, clear, and concise in your responses."
            "\n\nIMPORTANT FORMATTING INSTRUCTIONS: Format your responses using structured HTML. Use:"
            "\n- <p> tags for paragraphs"
            "\n- <b> or <strong> tags for emphasis"
            "\n- <ul> and <li> tags for lists of items"
            "\n- <h4> tags for small headings within your response"
            "\nWhen listing multiple items like symptoms or tips, ALWAYS use <ul> and <li> tags."
        )
    
    def get_response(self, user_message):
        """
        Generate a response to a user message
        
        Args:
            user_message (str): User's message
            
        Returns:
            dict: Response with text and HTML flag
        """
        try:
            # Use AI model if available
            if self.ai_model:
                return self._get_ai_response(user_message)
            else:
                # Fallback to rule-based responses
                return self._get_rule_based_response(user_message)
        except Exception as e:
            print(f"Error getting chatbot response: {str(e)}")
            return {
                'response': "<p>I'm sorry, I couldn't process that request. Please try again.</p>",
                'isHtml': True
            }
    
    def _get_ai_response(self, user_message):
        """
        Generate response using AI model
        
        Args:
            user_message (str): User's message
            
        Returns:
            dict: Response with text and HTML flag
        """
        try:
            # Combine prompts for AI model
            combined_prompt = f"{self.system_prompt}\n\nUser: {user_message}\n\nPlease format your response with proper HTML."
            
            # Generate AI response
            response = self.ai_model.generate_content(combined_prompt)
            
            # Process AI response text
            chatbot_reply = response.text
            
            # Check if the model wrapped the response in code blocks and remove them
            chatbot_reply = re.sub(r'```html|```', '', chatbot_reply)
            
            # Ensure it contains HTML formatting
            if '<p>' not in chatbot_reply and '<li>' not in chatbot_reply:
                # If there's no HTML, add basic formatting
                paragraphs = chatbot_reply.split('\n\n')
                formatted_reply = ""
                
                for para in paragraphs:
                    if not para.strip():
                        continue
                    
                    # Check if this paragraph is a list (starts with * or -)
                    if re.search(r'^\s*[\*\-]', para, re.MULTILINE):
                        # Convert to HTML list
                        items = re.split(r'\s*[\*\-]\s+', para)
                        formatted_reply += '<ul>'
                        for item in items:
                            if item.strip():
                                formatted_reply += f'<li>{item.strip()}</li>'
                        formatted_reply += '</ul>'
                    else:
                        # Regular paragraph
                        formatted_reply += f'<p>{para}</p>'
                
                chatbot_reply = formatted_reply if formatted_reply else f'<p>{chatbot_reply}</p>'
            
            # Format keywords with bold
            health_keywords = ['Rest', 'Hydration', 'Diet', 'Exercise', 'Sleep', 'Water', 'Medication']
            for keyword in health_keywords:
                chatbot_reply = re.sub(fr'\b{keyword}\b', f'<b>{keyword}</b>', chatbot_reply)
            
            return {
                'response': chatbot_reply,
                'isHtml': True
            }
            
        except Exception as e:
            error_msg = str(e)
            
            # Give a more user-friendly error for quota issues
            if "429" in error_msg or "quota" in error_msg.lower():
                return {
                    'response': '<p>I\'m currently experiencing high demand. Please try again in a few minutes.</p>',
                    'isHtml': True
                }
            
            return {
                'response': f"<p>Sorry, I couldn't process that right now. Please try again later.</p>",
                'isHtml': True
            }
    
    def _get_rule_based_response(self, user_message):
        """
        Generate rule-based response when AI is not available
        
        Args:
            user_message (str): User's message
            
        Returns:
            dict: Response with text and HTML flag
        """
        user_message_lower = user_message.lower()
        
        # Check for common health queries
        if any(word in user_message_lower for word in ['headache', 'head ache', 'head pain']):
            return {
                'response': """
                <h4>About Headaches</h4>
                <p>Headaches are common and can be caused by various factors including stress, dehydration, or lack of sleep.</p>
                <h4>Tips for Managing Headaches</h4>
                <ul>
                    <li>Drink plenty of water to stay hydrated</li>
                    <li>Take short breaks if you're working at a computer for long periods</li>
                    <li>Try to maintain regular sleep patterns</li>
                    <li>Consider over-the-counter pain relievers if appropriate</li>
                    <li>Practice stress-reduction techniques like deep breathing</li>
                </ul>
                <p>If your headaches are severe, persistent, or accompanied by other symptoms, please consult a healthcare provider.</p>
                """,
                'isHtml': True
            }
        
        elif any(word in user_message_lower for word in ['cold', 'flu', 'cough', 'fever']):
            return {
                'response': """
                <h4>Cold & Flu Management</h4>
                <p>Common colds and flu are viral infections affecting the respiratory system.</p>
                <h4>Recommendations</h4>
                <ul>
                    <li><b>Rest</b>: Give your body time to fight the infection</li>
                    <li><b>Hydration</b>: Drink plenty of fluids to prevent dehydration</li>
                    <li><b>Over-the-counter medications</b>: These can help relieve symptoms</li>
                    <li>Use a humidifier to ease congestion</li>
                    <li>Gargle with salt water to soothe a sore throat</li>
                </ul>
                <p>If you have a high fever, difficulty breathing, or symptoms that worsen or don't improve, please seek medical attention.</p>
                """,
                'isHtml': True
            }
        
        elif any(word in user_message_lower for word in ['diet', 'nutrition', 'eat', 'food']):
            return {
                'response': """
                <h4>Healthy Eating Guidelines</h4>
                <p>A balanced diet is essential for overall health and wellbeing.</p>
                <h4>Key Principles</h4>
                <ul>
                    <li>Include a variety of fruits and vegetables daily</li>
                    <li>Choose whole grains over refined grains</li>
                    <li>Include lean protein sources like fish, poultry, beans, and nuts</li>
                    <li>Limit added sugars, sodium, and saturated fats</li>
                    <li>Stay hydrated by drinking plenty of water throughout the day</li>
                </ul>
                <p>Individual nutritional needs can vary based on age, gender, activity level, and health conditions. Consider consulting with a registered dietitian for personalized advice.</p>
                """,
                'isHtml': True
            }
        
        elif any(word in user_message_lower for word in ['sleep', 'insomnia', 'tired']):
            return {
                'response': """
                <h4>Sleep Hygiene Tips</h4>
                <p>Quality sleep is essential for physical and mental health.</p>
                <h4>Recommendations for Better Sleep</h4>
                <ul>
                    <li>Maintain a consistent sleep schedule, even on weekends</li>
                    <li>Create a relaxing bedtime routine</li>
                    <li>Make your bedroom comfortable, dark, and quiet</li>
                    <li>Limit screen time before bed</li>
                    <li>Avoid caffeine and large meals close to bedtime</li>
                </ul>
                <p>If you're experiencing persistent sleep problems, consider speaking with a healthcare provider.</p>
                """,
                'isHtml': True
            }
        
        elif any(word in user_message_lower for word in ['stress', 'anxiety', 'worried', 'nervous']):
            return {
                'response': """
                <h4>Managing Stress and Anxiety</h4>
                <p>Stress and anxiety are normal responses to challenging situations, but it's important to manage them effectively.</p>
                <h4>Coping Strategies</h4>
                <ul>
                    <li>Practice deep breathing or meditation</li>
                    <li>Engage in regular physical activity</li>
                    <li>Maintain social connections</li>
                    <li>Get adequate sleep</li>
                    <li>Consider journaling to process thoughts and feelings</li>
                </ul>
                <p>If stress or anxiety is significantly impacting your daily life, please consider reaching out to a mental health professional.</p>
                """,
                'isHtml': True
            }
        
        else:
            # Default response for unrecognized queries
            return {
                'response': """
                <p>I'm here to provide general health information and support. How can I assist you with your health questions today?</p>
                <h4>I can help with topics like:</h4>
                <ul>
                    <li>Managing common symptoms</li>
                    <li>Healthy lifestyle tips</li>
                    <li>General wellness information</li>
                    <li>Stress management techniques</li>
                    <li>Nutrition and exercise basics</li>
                </ul>
                <p>Please note that I'm not a replacement for professional medical advice. For specific health concerns, please consult with a healthcare provider.</p>
                """,
                'isHtml': True
            }