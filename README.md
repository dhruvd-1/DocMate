# 🏥 DocMate

A Flask-based healthcare assistant web app offering AI-powered tools to support medical professionals and users. It features a **symptom checker**, **lipid profile analyzer**, a **Gemini-powered chatbot**, and a secure **note-taking system for doctors**.

---

## 🚀 Features

### 1. 📝 Doctor Notes System
- Secure login system for doctors.
- Doctors can create, view, and manage their own patient notes.
- Each doctor's notes are isolated from others for privacy.
- Important information is extracted from notes.

### 2. 🧠 AI-Powered Chatbot (Gemini)
- Uses **Google Gemini** to provide intelligent health-related responses.
- Natural conversation interface.
- Ask questions about symptoms, medications, and general health.

### 3. 🧪 Lipid Profile Analyzer
- Analyze lipid test results (Total Cholesterol, HDL, LDL, Triglycerides).
- Get automated interpretation and health advice.
- Visual indicators for cardiovascular risk levels.

---

## 🛠️ Tech Stack

- **Backend**: Python, Flask
- **Frontend**: HTML, CSS, JavaScript (Jinja templating)
- **AI Integration**: Google Gemini (via API)
- **Authentication**: Flask-Login

---

## 🧰 Installation & Setup

### Prerequisites
- Python 3.8+
- Google account with Gemini API access

### Clone the Repository
```bash
git clone https://github.com/yourusername/health-assistant-app.git
cd health-assistant-app
````

### Create a Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```




### Run the App

```bash
python3 app.py
```

The app will be available at `http://localhost:5000`.

---

## 🧭 Usage Guide

### Symptom Checker

* Navigate to `/symptom-checker`
* Enter symptoms like "fever, cough"
* View suggestions

### Lipid Profile Analyzer

* Go to `/lipid-analyzer`
* Input lipid profile values
* Get a quick health interpretation

### Gemini Chatbot

* Chat with Gemini at `/chatbot`
* Ask general health questions

### Doctor Note System

* Sign up or log in as a doctor at `/login` or `/register`
* Access personal dashboard at `/dashboard`
* Create and manage private notes for your patients

---

## 📁 Project Structure

```
Directory structure:
└── dhruvd-1-docmate.git/
    ├── README.md
    ├── app.py
    ├── LICENSE
    ├── notes.txt
    ├── requirements.txt
    ├── models/
    │   ├── __init__.py
    │   ├── chatbot_handler.py
    │   ├── lipid_analyzer.py
    │   ├── notes_processor.py
    │   └── symptom_checker.py
    ├── static/
    │   ├── css/
    │   │   ├── chatbot.css
    │   │   ├── home.css
    │   │   ├── lipid_profile.css
    │   │   ├── main.css
    │   │   ├── notes.css
    │   │   └── symptom_checker.css
    │   └── js/
    │       ├── chatbot.js
    │       ├── lipid_profile.js
    │       ├── main.js
    │       ├── notes.js
    │       └── symptom_checker.js
    └── templates/
        ├── base.html
        ├── chatbot.html
        ├── index.html
        ├── lipid_profile.html
        ├── lipid_result.html
        ├── note.html
        ├── prediction_result.html
        └── symptom_checker.html

```

---
