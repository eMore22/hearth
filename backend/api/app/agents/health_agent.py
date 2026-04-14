import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class HealthAgent(BaseHouseholdAgent):
    """
    Module 5: Family Health Triage Agent

    Handles:
    - Symptom triage (NOT diagnosis)
    - Home care recommendations
    - Medication reminders
    - Family health history summaries
    """

    SYSTEM_PROMPT = """You are Hearth's Health Triage Agent.
You provide evidence-based triage guidance, NOT medical diagnosis.
You help families decide between home care, pharmacy, GP visit, or emergency care.
Always err on the side of caution and include clear disclaimers.
Your responses are for informational purposes only."""

    # Hardcoded emergency keywords that bypass AI and return immediate emergency response
    EMERGENCY_KEYWORDS = [
        "chest pain", "difficulty breathing", "unconscious", "severe bleeding",
        "stroke", "heart attack", "seizure", "head injury", "poisoning",
        "suicidal", "overdose", "anaphylaxis", "severe burn"
    ]

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "triage":
            return self.triage_symptoms(input_data["symptoms"], input_data.get("patient_profile", {}))
        elif action == "home_care":
            return self.get_home_care_instructions(input_data["condition"])
        elif action == "medication_reminder":
            return self.create_medication_schedule(input_data["medications"])
        else:
            raise ValueError(f"Unknown action: {action}")

    def triage_symptoms(self, symptoms: str, patient_profile: Dict = None) -> Dict:
        """
        Main triage function. Checks for emergency keywords first, then uses Claude.
        Returns a structured triage recommendation.
        """
        # Emergency keyword check (hardcoded safety)
        symptoms_lower = symptoms.lower()
        for keyword in self.EMERGENCY_KEYWORDS:
            if keyword in symptoms_lower:
                return {
                    "triage_level": "emergency",
                    "recommendation": "Call 911 or go to the nearest emergency room immediately.",
                    "disclaimer": "This is not a diagnosis. If you are experiencing a medical emergency, seek immediate care."
                }

        profile_text = ""
        if patient_profile:
            profile_text = f"Patient age: {patient_profile.get('age', 'unknown')}, existing conditions: {patient_profile.get('conditions', [])}"

        prompt = f"""A user reports these symptoms: "{symptoms}"
{profile_text}

Provide triage guidance (NOT diagnosis). Return ONLY valid JSON:
{{
  "triage_level": "home_care|pharmacy|gp_visit|urgent_care|emergency",
  "recommendation": "clear, actionable next steps",
  "home_care_tips": ["tip1", "tip2"] (if applicable),
  "red_flags": ["symptom that would require escalation"],
  "suggested_otc": "over-the-counter options if appropriate",
  "disclaimer": "This is triage information, not medical advice. Consult a healthcare professional."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            triage = json.loads(response)
        except:
            triage = {
                "triage_level": "gp_visit",
                "recommendation": "Please consult your healthcare provider for personalized advice.",
                "disclaimer": "This is not medical advice."
            }

        self.log_action("triage", symptoms[:50])
        triage["disclaimer"] = "⚠️ Hearth Health Triage is for informational purposes only. Always consult a qualified healthcare professional for medical concerns."
        return triage

    def get_home_care_instructions(self, condition: str) -> Dict:
        """
        Provide evidence-based home care for minor conditions (e.g., common cold, mild fever).
        """
        prompt = f"""Provide safe home care instructions for managing: {condition}.
Include when to seek medical attention.
Return JSON:
{{
  "condition": "{condition}",
  "home_care_steps": ["step1", "step2"],
  "monitoring_advice": "what to watch for",
  "when_to_seek_care": ["red flag 1", "red flag 2"],
  "disclaimer": "..."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            care = json.loads(response)
        except:
            care = {"home_care_steps": ["Rest, hydrate, and monitor symptoms."]}

        self.log_action("home_care", condition)
        return care

    def create_medication_schedule(self, medications: List[Dict]) -> Dict:
        """
        Generate a daily medication schedule from a list of meds with dosages.
        """
        meds_text = "\n".join([f"- {m.get('name')}: {m.get('dosage')}, {m.get('frequency')}" for m in medications])
        prompt = f"""Create a clear daily medication schedule from this list:
{meds_text}

Return JSON:
{{
  "schedule": [
    {{"time": "morning", "medications": ["med1", "med2"]}},
    {{"time": "afternoon", "medications": ["..."]}},
    {{"time": "evening", "medications": ["..."]}},
    {{"time": "bedtime", "medications": ["..."]}}
  ],
  "notes": "any special instructions (with/without food, etc.)"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            schedule = json.loads(response)
        except:
            schedule = {"schedule": [], "notes": "Consult your prescription labels."}

        self.log_action("medication_schedule", f"{len(medications)} meds")
        return schedule