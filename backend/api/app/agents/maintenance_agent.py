import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class MaintenanceAgent(BaseHouseholdAgent):
    """
    Home Maintenance & Repair Agent
    Handles maintenance scheduling, issue diagnosis, and DIY guidance.
    """

    SYSTEM_PROMPT = """You are Hearth's Home Maintenance Agent.
You help households stay on top of repairs, prevent problems, and provide safe DIY guidance.
Always prioritize safety and recommend professional help when appropriate.
Return valid JSON when generating plans or diagnoses."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "generate_calendar":
            return self.generate_maintenance_calendar(input_data.get("home_profile", {}))
        elif action == "diagnose_problem":
            return self.diagnose_issue(input_data.get("description", ""))
        elif action == "get_diy_instructions":
            return self.get_diy_instructions(input_data.get("task_name", ""))
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_maintenance_calendar(self, profile: Dict) -> List[Dict]:
        """Generate a yearly maintenance schedule."""
        prompt = f"""Create a practical home maintenance calendar based on this property profile:

{json.dumps(profile)}

Return ONLY a JSON array of tasks:
[{{
  "task": "Task name",
  "frequency": "monthly|quarterly|bi-annually|annually",
  "best_months": ["Month1", "Month2"],
  "diy_friendly": true/false,
  "estimated_cost": number,
  "priority": "high|medium|low"
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=3000)
        try:
            clean = self._extract_json(response)
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ Maintenance calendar JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return []

    def diagnose_issue(self, problem: str) -> Dict:
        """
        Diagnose a home maintenance problem: likely causes, immediate
        safety/action steps (the maintenance equivalent of "first aid"),
        urgency, and whether it's DIY-safe.
        """
        prompt = f"""Diagnose this home maintenance issue and provide practical, well-known guidance — the kind of standard troubleshooting information found in a reputable home-repair reference.

Problem: "{problem}"

Return ONLY valid JSON:
{{
  "likely_causes": ["most common, well-known cause 1", "cause 2"],
  "immediate_steps": ["specific, standard first step to take right now", "step 2", "step 3"],
  "urgency": "low|medium|high|emergency",
  "diy_possible": true/false,
  "estimated_repair_cost": "low|medium|high",
  "safety_warning": "any safety note relevant to this issue, or null",
  "disclaimer": "This is general guidance only and not a substitute for an in-person assessment by a licensed professional."
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = self._extract_json(response)
            result = json.loads(clean)
            result.setdefault("immediate_steps", [])
            result.setdefault("diy_possible", False)
            result.setdefault("safety_warning", None)
            result.setdefault(
                "disclaimer",
                "This is general guidance only and not a substitute for an in-person assessment by a licensed professional."
            )
            return result
        except Exception as e:
            print(f"⚠️ Maintenance diagnosis JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return {
                "likely_causes": ["Unable to determine — try describing the issue in more detail"],
                "immediate_steps": [],
                "urgency": "medium",
                "diy_possible": False,
                "estimated_repair_cost": "medium",
                "safety_warning": "Do not attempt repairs if unsure",
                "disclaimer": "This is general guidance only and not a substitute for an in-person assessment by a licensed professional.",
                "_fallback_used": True,
            }

    def get_diy_instructions(self, task: str) -> Dict:
        """Provide step-by-step DIY instructions."""
        prompt = f"""Provide safe, clear DIY instructions for: "{task}"

Return ONLY valid JSON:
{{
  "difficulty": "easy|medium|hard",
  "tools_needed": ["tool 1", "tool 2"],
  "materials_needed": ["material 1"],
  "steps": ["step 1", "step 2", "step 3"],
  "time_estimate": "e.g. 30-60 minutes",
  "safety_tips": ["tip 1"],
  "when_to_call_professional": "condition when to stop and call help"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=1000)
        try:
            clean = self._extract_json(response)
            return json.loads(clean)
        except Exception as e:
            print(f"⚠️ DIY instructions JSON parse failed: {e}")
            print(f"⚠️ Raw Claude response was: {response[:500]}")
            return {
                "difficulty": "medium",
                "tools_needed": [],
                "materials_needed": [],
                "steps": ["Consult a professional for safety"],
                "time_estimate": "Unknown",
                "safety_tips": ["Always prioritize safety"],
                "when_to_call_professional": "If you're unsure at any point"
            }
