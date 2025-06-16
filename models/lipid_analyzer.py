"""
Lipid Analyzer module for Health Companion app
"""


def analyze_lipid_profile(total_cholesterol, hdl, ldl, triglycerides):
    """
    Analyze lipid profile values and provide risk assessment
    Based on standard medical guidelines
    """
    # Safety check: ensure all values are numeric
    try:
        total_cholesterol = float(total_cholesterol)
        hdl = float(hdl)
        ldl = float(ldl)
        triglycerides = float(triglycerides)
    except (ValueError, TypeError):
        raise ValueError("All lipid values must be numeric")

    # Risk classification based on values
    risk_level = "Low Risk"
    result = "Your lipid profile is within normal ranges."
    recommendations = []

    # Total Cholesterol analysis
    if total_cholesterol < 200:
        total_status = "Optimal"
    elif 200 <= total_cholesterol < 240:
        total_status = "Borderline High"
        risk_level = max(risk_level, "Moderate Risk")
        recommendations.append("Consider dietary changes to reduce total cholesterol.")
    else:  # >= 240
        total_status = "High"
        risk_level = "High Risk"
        recommendations.append(
            "Consult with a healthcare provider about your high total cholesterol."
        )

    # HDL (Good) Cholesterol analysis
    if hdl >= 60:
        hdl_status = "Optimal (Protective)"
    elif 40 <= hdl < 60:
        hdl_status = "Normal"
    else:  # < 40
        hdl_status = "Low"
        risk_level = max(risk_level, "Moderate Risk")
        recommendations.append("Work on increasing your HDL through exercise and diet.")

    # LDL (Bad) Cholesterol analysis
    if ldl < 100:
        ldl_status = "Optimal"
    elif 100 <= ldl < 130:
        ldl_status = "Near Optimal"
    elif 130 <= ldl < 160:
        ldl_status = "Borderline High"
        risk_level = max(risk_level, "Moderate Risk")
        recommendations.append("Consider dietary changes to reduce LDL cholesterol.")
    elif 160 <= ldl < 190:
        ldl_status = "High"
        risk_level = "High Risk"
        recommendations.append(
            "Consult with a healthcare provider about your high LDL cholesterol."
        )
    else:  # >= 190
        ldl_status = "Very High"
        risk_level = "Very High Risk"
        recommendations.append(
            "Urgent: Consult with a healthcare provider about your very high LDL cholesterol."
        )

    # Triglycerides analysis
    if triglycerides < 150:
        trig_status = "Normal"
    elif 150 <= triglycerides < 200:
        trig_status = "Borderline High"
        risk_level = max(risk_level, "Moderate Risk")
        recommendations.append("Consider dietary changes to reduce triglycerides.")
    elif 200 <= triglycerides < 500:
        trig_status = "High"
        risk_level = "High Risk"
        recommendations.append(
            "Consult with a healthcare provider about your high triglycerides."
        )
    else:  # >= 500
        trig_status = "Very High"
        risk_level = "Very High Risk"
        recommendations.append(
            "Urgent: Consult with a healthcare provider about your very high triglycerides."
        )

    # TC/HDL Ratio Analysis - with safety checks
    try:
        ratio = total_cholesterol / hdl
        if ratio < 3.5:
            ratio_status = "Optimal"
        elif 3.5 <= ratio < 5:
            ratio_status = "Normal"
        else:  # >= 5
            ratio_status = "High Risk"
            risk_level = max(risk_level, "High Risk")
            recommendations.append(
                "Your Total Cholesterol to HDL ratio indicates elevated risk. Consider lifestyle modifications."
            )
    except ZeroDivisionError:
        ratio = "N/A"
        ratio_status = "Could not calculate"

    # Non-HDL Cholesterol Analysis
    non_hdl = total_cholesterol - hdl
    if non_hdl < 130:
        non_hdl_status = "Optimal"
    elif 130 <= non_hdl < 160:
        non_hdl_status = "Above Optimal"
        risk_level = max(risk_level, "Moderate Risk")
    elif 160 <= non_hdl < 190:
        non_hdl_status = "High"
        risk_level = max(risk_level, "High Risk")
    else:  # >= 190
        non_hdl_status = "Very High"
        risk_level = max(risk_level, "Very High Risk")
        recommendations.append(
            "Your Non-HDL cholesterol is high, indicating increased risk for heart disease."
        )

    # If no specific recommendations were added, provide general advice
    if not recommendations and risk_level == "Low Risk":
        recommendations = [
            "Continue maintaining a healthy lifestyle with balanced diet and regular exercise.",
            "Get your lipid profile checked annually.",
        ]
    elif not recommendations:
        recommendations += [
            "Increase physical activity.",
            "Follow a heart-healthy diet low in saturated fats.",
            "Consider discussing medication options with your doctor.",
        ]

    # Add specific lifestyle recommendations based on lipid profile
    if ldl >= 130 or triglycerides >= 150:
        recommendations.append(
            "Reduce intake of processed foods, sugars, and saturated fats."
        )
        recommendations.append(
            "Increase consumption of fiber-rich foods like fruits, vegetables, and whole grains."
        )

    if hdl < 40:
        recommendations.append("Regular aerobic exercise can help raise HDL levels.")
        recommendations.append(
            "Consider including healthy fats like olive oil, nuts, and avocados in your diet."
        )

    if triglycerides >= 200:
        recommendations.append("Limit alcohol consumption.")
        recommendations.append("Reduce intake of simple carbohydrates and sugars.")

    # Compile detailed result - with safer formatting
    ratio_display = f"{ratio:.2f}" if isinstance(ratio, float) else ratio

    detailed_result = f"""
    <h5>Detailed Analysis of Your Lipid Profile:</h5>
    
    <div class="mb-4">
        <p><strong>Total Cholesterol:</strong> {total_cholesterol} mg/dL - <span class="{"text-success" if total_cholesterol < 200 else "text-warning" if total_cholesterol < 240 else "text-danger"}">{total_status}</span></p>
        <p class="small text-muted">Total cholesterol measures all cholesterol in your blood, including both LDL (harmful) and HDL (beneficial) types.</p>
    </div>
    
    <div class="mb-4">
        <p><strong>HDL Cholesterol:</strong> {hdl} mg/dL - <span class="{"text-success" if hdl >= 60 else "text-warning" if hdl >= 40 else "text-danger"}">{hdl_status}</span></p>
        <p class="small text-muted">HDL (High-Density Lipoprotein) is often called "good cholesterol" as it helps remove other forms of cholesterol from your bloodstream.</p>
    </div>
    
    <div class="mb-4">
        <p><strong>LDL Cholesterol:</strong> {ldl} mg/dL - <span class="{"text-success" if ldl < 100 else "text-warning" if ldl < 160 else "text-danger"}">{ldl_status}</span></p>
        <p class="small text-muted">LDL (Low-Density Lipoprotein) is often called "bad cholesterol" as it can build up in your artery walls and increase risk of heart disease.</p>
    </div>
    
    <div class="mb-4">
        <p><strong>Triglycerides:</strong> {triglycerides} mg/dL - <span class="{"text-success" if triglycerides < 150 else "text-warning" if triglycerides < 200 else "text-danger"}">{trig_status}</span></p>
        <p class="small text-muted">Triglycerides are a type of fat found in your blood that can contribute to hardening of the arteries when levels are elevated.</p>
    </div>
    
    <div class="mb-4">
        <p><strong>Total Cholesterol to HDL Ratio:</strong> {ratio_display} - <span class="{"text-success" if isinstance(ratio, float) and ratio < 3.5 else "text-warning" if isinstance(ratio, float) and ratio < 5 else "text-danger"}">{ratio_status}</span></p>
        <p class="small text-muted">This ratio is a stronger predictor of cardiovascular disease risk than total cholesterol alone.</p>
    </div>
    
    <div class="mb-4">
        <p><strong>Non-HDL Cholesterol:</strong> {non_hdl} mg/dL - <span class="{"text-success" if non_hdl < 130 else "text-warning" if non_hdl < 160 else "text-danger"}">{non_hdl_status}</span></p>
        <p class="small text-muted">Non-HDL cholesterol represents all the "bad" types of cholesterol combined and is an important risk factor for heart disease.</p>
    </div>
    """

    return detailed_result, risk_level, recommendations


def get_population_percentile(
    total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides
):
    """Get population percentiles for lipid values"""
    # This is a simplified implementation
    # In a real application, this would use actual population statistics

    # Total cholesterol percentile calculation (example)
    if total_cholesterol < 150:
        tc_percentile = 10
    elif total_cholesterol < 170:
        tc_percentile = 25
    elif total_cholesterol < 200:
        tc_percentile = 50
    elif total_cholesterol < 240:
        tc_percentile = 75
    else:
        tc_percentile = 90

    # HDL cholesterol (higher is better, so reverse scale)
    if hdl_cholesterol >= 70:
        hdl_percentile = 90
    elif hdl_cholesterol >= 60:
        hdl_percentile = 75
    elif hdl_cholesterol >= 50:
        hdl_percentile = 50
    elif hdl_cholesterol >= 40:
        hdl_percentile = 25
    else:
        hdl_percentile = 10

    # LDL cholesterol
    if ldl_cholesterol < 90:
        ldl_percentile = 10
    elif ldl_cholesterol < 110:
        ldl_percentile = 25
    elif ldl_cholesterol < 130:
        ldl_percentile = 50
    elif ldl_cholesterol < 160:
        ldl_percentile = 75
    else:
        ldl_percentile = 90

    # Triglycerides
    if triglycerides < 90:
        trig_percentile = 10
    elif triglycerides < 120:
        trig_percentile = 25
    elif triglycerides < 150:
        trig_percentile = 50
    elif triglycerides < 200:
        trig_percentile = 75
    else:
        trig_percentile = 90

    return {
        "total_cholesterol": tc_percentile,
        "hdl_cholesterol": hdl_percentile,
        "ldl_cholesterol": ldl_percentile,
        "triglycerides": trig_percentile,
    }


def extract_data_from_pdf(filepath):
    """Extract medical data from uploaded PDF files"""
    # This would be implemented with PDF parsing libraries like PyPDF2 or pdfplumber
    # For demonstration, return sample data
    try:
        # In a real implementation, this would parse the PDF
        # and extract the values using pattern matching or OCR

        # Placeholder sample data
        return {
            "total_cholesterol": 180,
            "hdl_cholesterol": 55,
            "ldl_cholesterol": 90,
            "triglycerides": 172,
            "additional_data": {"tc_hdl_ratio": 3.6, "non_hdl": 130},
        }
    except Exception as e:
        print(f"Error extracting data from PDF: {str(e)}")
        return None


def is_valid_extraction(data):
    """Check if extracted data is valid"""
    if not data:
        return False

    required_fields = [
        "total_cholesterol",
        "hdl_cholesterol",
        "ldl_cholesterol",
        "triglycerides",
    ]
    return all(key in data and data[key] is not None for key in required_fields)
