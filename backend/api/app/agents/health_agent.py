import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class HealthAgent(BaseHouseholdAgent):
    """
    Family Health & Wellness Agent
    Handles symptom triage, medication reminders, and general wellness guidance.
    """

    SYSTEM_PROMPT = """You are Hearth's Health & Wellness Agent.
You help households track health-related tasks, manage medications, and provide general wellness guidance.
Always include a disclaimer that you are not a doctor and users should consult healthcare professionals for medical advice.
Be caring but responsible.
Respond with ONLY the JSON object requested — no preamble, no explanation, no markdown fences, no text before or after the JSON."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "triage":
            return self.triage(
                input_data.get("symptoms", ""),
                input_data.get("patient_profile", {})
            )
        elif action == "triage_symptoms":
            return self.triage_symptoms(input_data.get("symptoms", ""))
        elif action == "generate_health_reminders":
            return self.generate_reminders(input_data.get("health_data", {}))
        elif action == "medication_check":
            return self.check_medications(input_data.get("medications", []))
        else:
            raise ValueError(f"Unknown action: {action}")

    def triage(self, symptoms: str, patient_profile: Dict = None) -> Dict:
        """
        Provide general, informational guidance for reported symptoms:
        likely common cause, standard first-aid/home-care steps, and a
        care-pathway recommendation. NOT a clinical diagnosis.
        """
        profile_text = ""
        if patient_profile:
            age = patient_profile.get("age", "unknown")
            conditions = patient_profile.get("conditions", [])
            profile_text = f"Patient age: {age}. Existing conditions: {', '.join(conditions) if conditions else 'none'}."

        prompt = f"""A household member is reporting these symptoms. Provide general, informational health guidance — the kind of standard, well-known first-aid and home-care information found in a reputable home health reference (e.g. Mayo Clinic, NHS). Do not provide a clinical diagnosis.

Symptoms: "{symptoms}"
{profile_text}

Return ONLY valid JSON:
{{
  "triage_level": "home_care|pharmacy|gp_visit|urgent_care|emergency",
  "recommendation": "1-2 sentence summary naming the most common, well-known explanation for these symptoms and what to do",
  "home_care_tips": ["specific, standard first-aid/home-care step 1", "step 2", "step 3"],
  "red_flags": ["symptom that would require immediate escalation"],
  "suggested_otc": "commonly used over-the-counter option if relevant, or null",
  "disclaimer": "This is general information only and is not a medical diagnosis. Consult a healthcare professional for medical advice."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = self._extract_json(response)
            result = json.loads(clean)
            # Defensive defaults so the frontend never renders `undefined`
            result.setdefault("triage_level", "home_care")
            result.setdefault("home_care_tips", [])
            result.setdefault("red_flags", [])
            result.setdefault("suggested_otc", None)
            result.setdefault(
                "disclaimer",
                "This is general information only and is not a medical diagnosis. Consult a healthcare professional for medical advice."
            )
            return result
        except Exception as e:
            print(f"⚠️ Health triage JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return {
                "triage_level": "home_care",
                "recommendation": "We couldn't complete a full assessment right now. If symptoms persist or worsen, contact a healthcare professional.",
                "home_care_tips": ["Rest and stay hydrated"],
                "red_flags": [],
                "suggested_otc": None,
                "disclaimer": "This is not medical advice. Please consult a doctor.",
                "_fallback_used": True,
            }

    def triage_symptoms(self, symptoms: str) -> Dict:
        """Backward-compatible wrapper that calls triage without a patient profile."""
        return self.triage(symptoms)

    def generate_reminders(self, health_data: Dict) -> List[Dict]:
        """Generate health-related reminders (medications, checkups, etc.)."""
        prompt = f"""Create health reminders based on this data:

{json.dumps(health_data)}

Return ONLY a JSON array:
[{{
  "type": "medication|appointment|checkup|vaccine",
  "title": "Reminder title",
  "due_date": "YYYY-MM-DD or null",
  "message": "short helpful message",
  "priority": "high|medium|low"
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = self._extract_json(response)
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ Health reminders JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return []

    def check_medications(self, medications: List[Dict]) -> Dict:
        """Check for medication interactions or reminders."""
        if not medications:
            return {"interactions": [], "reminders": []}

        prompt = f"""Review these medications for potential issues:

Medications: {json.dumps(medications)}

Return ONLY valid JSON:
{{
  "potential_interactions": ["interaction warning or null"],
  "upcoming_refills": ["medication that needs refill soon"],
  "general_advice": "short advice"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = self._extract_json(response)
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ Medication check JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return {
                "potential_interactions": [],
                "upcoming_refills": [],
                "general_advice": "Keep track of your medications and consult your doctor regularly."
            }
