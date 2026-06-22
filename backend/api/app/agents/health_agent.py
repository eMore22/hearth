import json
import re
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

    @staticmethod
    def _extract_json(text: str) -> str:
        """
        Pull a JSON object/array out of a Claude response even if it added
        stray prose around it. Claude is told not to, but occasionally does
        anyway — this makes parsing resilient instead of failing on the
        first character that isn't '{'.
        """
        cleaned = text.replace("```json", "").replace("```", "").strip()
        # If there's leading/trailing prose, grab the outermost {...} or [...]
        match = re.search(r'(\{.*\}|\[.*\])', cleaned, re.DOTALL)
        return match.group(1) if match else cleaned

    def triage(self, symptoms: str, patient_profile: Dict = None) -> Dict:
        """Provide general guidance for reported symptoms (uses patient_profile if given)."""
        profile_text = ""
        if patient_profile:
            age = patient_profile.get("age", "unknown")
            conditions = patient_profile.get("conditions", [])
            profile_text = f"Patient age: {age}. Existing conditions: {', '.join(conditions) if conditions else 'none'}."

        prompt = f"""Provide general, non-diagnostic guidance for these symptoms:

Symptoms: "{symptoms}"
{profile_text}

Return ONLY valid JSON:
{{
  "severity_level": "low|medium|high",
  "home_care_suggestions": ["suggestion 1", "suggestion 2"],
  "when_to_see_doctor": "specific conditions",
  "urgent_care_warning": "symptoms that require immediate attention or null",
  "disclaimer": "This is general information only. Consult a healthcare professional."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = self._extract_json(response)
            return json.loads(clean)
        except Exception as e:
            # Log the REAL failure reason and Claude's raw output, instead
            # of silently swallowing it. This is what made the previous bug
            # invisible — a generic except: meant we never knew Claude's
            # actual response, or why it failed to parse.
            print(f"⚠️ Health triage JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return {
                "severity_level": "medium",
                "home_care_suggestions": ["Rest and stay hydrated"],
                "when_to_see_doctor": "If symptoms persist beyond 48 hours",
                "urgent_care_warning": None,
                "disclaimer": "This is not medical advice. Please consult a doctor.",
                "_fallback_used": True,  # lets the frontend/logs know this was a fallback, not a real answer
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