import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class HealthAgent(BaseHouseholdAgent):
    """
    Family Health Agent
    Uses Claude for health-related advice and reminders.
    """

    SYSTEM_PROMPT = """You are Hearth's Health Agent.
You help households track medications, appointments, and general wellness.
Always remind users to consult healthcare professionals for medical advice.
Be caring and responsible."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "triage_symptoms":
            return self.triage_symptoms(input_data.get("symptoms", ""))
        elif action == "generate_health_reminders":
            return self.generate_reminders(input_data.get("health_data", {}))
        else:
            raise ValueError(f"Unknown action: {action}")

    def triage_symptoms(self, symptoms: str) -> Dict:
        """Basic symptom triage - uses Claude (heavy)"""
        prompt = f"""Provide general guidance for these symptoms: "{symptoms}"

Return ONLY valid JSON:
{{
  "severity": "low|medium|high",
  "home_care_tips": ["tip 1", "tip 2"],
  "when_to_see_doctor": "condition",
  "disclaimer": "This is not medical advice. Consult a healthcare professional."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "severity": "medium",
                "home_care_tips": ["Rest and stay hydrated"],
                "when_to_see_doctor": "If symptoms persist or worsen",
                "disclaimer": "This is not medical advice. Please consult a healthcare professional."
            }

    def generate_reminders(self, health_data: Dict) -> List[Dict]:
        """Generate health reminders - uses Claude (heavy)"""
        prompt = f"""Create health reminders based on this data:

{json.dumps(health_data)}

Return ONLY a JSON array:
[{{
  "type": "medication|appointment|checkup",
  "title": "Reminder title",
  "due_date": "YYYY-MM-DD",
  "message": "short message"
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []