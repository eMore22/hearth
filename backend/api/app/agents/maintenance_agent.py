import json
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class MaintenanceAgent(BaseHouseholdAgent):
    """
    Home Maintenance Agent
    Uses Claude for diagnosis and planning, NVIDIA for light tasks.
    """

    SYSTEM_PROMPT = """You are Hearth's Maintenance Agent.
You help households with home repairs, maintenance scheduling, and DIY guidance.
Be practical and safety-conscious."""

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "generate_calendar":
            return self.generate_maintenance_calendar(input_data.get("property_profile", {}))
        elif action == "diagnose_problem":
            return self.diagnose_issue(input_data.get("problem_description", ""))
        elif action == "get_diy_instructions":
            return self.get_diy_instructions(input_data.get("task_name", ""))
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_maintenance_calendar(self, profile: Dict) -> List[Dict]:
        """Generate maintenance schedule - uses Claude (heavy)"""
        prompt = f"""Create a home maintenance calendar based on this property profile:

{json.dumps(profile)}

Return ONLY a JSON array of tasks:
[{{
  "name": "Task name",
  "frequency": "monthly|quarterly|yearly",
  "next_due_date": "YYYY-MM-DD",
  "diy_friendly": true/false,
  "estimated_cost": number
}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return []

    def diagnose_issue(self, problem: str) -> Dict:
        """Diagnose a home problem - uses Claude (heavy)"""
        prompt = f"""Diagnose this home maintenance issue: "{problem}"

Return ONLY valid JSON:
{{
  "likely_causes": ["cause 1", "cause 2"],
  "recommendation": "what to do",
  "estimated_cost_range": "low to high",
  "diy_possible": true/false
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"likely_causes": [], "recommendation": "Consult a professional", "estimated_cost_range": "", "diy_possible": False}

    def get_diy_instructions(self, task: str) -> Dict:
        """Get DIY instructions - uses Claude (heavy)"""
        prompt = f"""Provide safe DIY instructions for: "{task}"

Return ONLY valid JSON:
{{
  "steps": ["step 1", "step 2"],
  "tools_needed": ["tool 1"],
  "safety_tips": ["tip 1"],
  "when_to_call_professional": "condition"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            clean = response.replace("```json", "").replace("```", "").strip()
            return json.loads(clean)
        except:
            return {"steps": [], "tools_needed": [], "safety_tips": [], "when_to_call_professional": "If unsure, call a professional"}