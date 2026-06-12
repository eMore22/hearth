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
Be caring but responsible."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "triage_symptoms":
            return self.triage_symptoms(input_data.get("symptoms", ""))
        elif action == "generate_health_reminders":
            return self.generate_reminders(input_data.get("health_data", {}))
        elif action == "medication_check":
            return self.check_medications(input_data.get("medications", []))
        else:
            raise ValueError(f"Unknown action: {action}")

    def triage_symptoms(self, symptoms: str) -> Dict:
        """Provide general guidance for reported symptoms."""
        prompt = f"""Provide general, non-diagnostic guidance for these symptoms:

Symptoms: "{symptoms}"

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
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "severity_level": "medium",
                "home_care_suggestions": ["Rest and stay hydrated"],
                "when_to_see_doctor": "If symptoms persist beyond 48 hours",
                "urgent_care_warning": None,
                "disclaimer": "This is not medical advice. Please consult a doctor."
            }

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
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
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
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {
                "potential_interactions": [],
                "upcoming_refills": [],
                "general_advice": "Keep track of your medications and consult your doctor regularly."
            }