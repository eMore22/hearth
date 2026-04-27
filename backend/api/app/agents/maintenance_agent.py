import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional
from app.agents.base_agent import BaseHouseholdAgent


class MaintenanceAgent(BaseHouseholdAgent):
    """
    Module 4: Home Maintenance & Repair Agent

    Handles:
    - Personalized maintenance calendar
    - Reminders with DIY instructions
    - Problem diagnosis from user description (text + photo)
    - Repair history and cost tracking
    - Vision-based diagnosis using NVIDIA
    """

    SYSTEM_PROMPT = """You are Hearth's Home Maintenance Agent.
You help homeowners stay on top of seasonal maintenance tasks.
You provide DIY instructions when safe and recommend professionals when needed.
Be practical, safety-conscious, and empowering."""

    DEFAULT_TASKS = {
        "HVAC filter replacement": {"interval_days": 90, "season": None},
        "Smoke detector battery test": {"interval_days": 180, "season": None},
        "Gutter cleaning": {"interval_days": 365, "season": "fall"},
        "Water heater flush": {"interval_days": 365, "season": None},
        "Refrigerator coil cleaning": {"interval_days": 180, "season": None},
        "Dryer vent cleaning": {"interval_days": 365, "season": None},
        "Roof inspection": {"interval_days": 365, "season": "spring"},
        "AC service": {"interval_days": 365, "season": "spring"},
        "Furnace service": {"interval_days": 365, "season": "fall"},
        "Chimney sweep": {"interval_days": 365, "season": "fall"},
    }

    def run(self, input_data: Any) -> Any:
        action = input_data.get("action")
        if action == "generate_calendar":
            return self.generate_maintenance_calendar(input_data["home_profile"])
        elif action == "diagnose_problem":
            # If there's an image, use vision-based diagnosis
            if input_data.get("image_bytes"):
                return self.diagnose_with_photo(
                    input_data.get("description", ""),
                    input_data["image_bytes"]
                )
            else:
                return self.diagnose_problem(input_data.get("description", ""), input_data.get("photos", []))
        elif action == "estimate_cost":
            return self.estimate_repair_cost(input_data["appliance"], input_data["issue"])
        elif action == "get_diy_instructions":
            return self.get_diy_instructions(input_data["task_name"])
        else:
            raise ValueError(f"Unknown action: {action}")

    def generate_maintenance_calendar(self, home_profile: Dict) -> Dict:
        """Create a personalized maintenance schedule."""
        property_type = home_profile.get("property_type", "house")
        appliances = home_profile.get("appliances", [])
        location_climate = home_profile.get("climate", "temperate")

        tasks = []
        today = date.today()

        for task_name, config in self.DEFAULT_TASKS.items():
            due_date = today + timedelta(days=config["interval_days"])
            tasks.append({
                "name": task_name,
                "due_date": due_date.isoformat(),
                "interval_days": config["interval_days"],
                "season": config.get("season"),
                "diy_friendly": True
            })

        for app in appliances:
            if "HVAC" in app or "AC" in app:
                tasks.append({
                    "name": f"Service {app}",
                    "due_date": (today + timedelta(days=365)).isoformat(),
                    "interval_days": 365,
                    "diy_friendly": False
                })

        prompt = f"""Given this home profile:
Property: {property_type}
Climate: {location_climate}
Appliances: {appliances}

Suggest any additional important maintenance tasks specific to this home/climate.
Return JSON list of tasks like:
[{{"name": "...", "interval_days": number, "diy_friendly": true/false, "reason": "..."}}]"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            extra_tasks = json.loads(response)
            for t in extra_tasks:
                t["due_date"] = (today + timedelta(days=t.get("interval_days", 180))).isoformat()
            tasks.extend(extra_tasks)
        except:
            pass

        self.log_action("generate_calendar", f"{len(tasks)} tasks")
        return {
            "home_profile_id": home_profile.get("id"),
            "generated_on": today.isoformat(),
            "tasks": tasks
        }

    def diagnose_problem(self, description: str, photos: List[str] = None) -> Dict:
        """Text-based diagnosis."""
        photo_context = ""
        if photos:
            photo_context = f"User has uploaded {len(photos)} photo(s) of the issue."

        prompt = f"""A homeowner reports this issue:
"{description}"
{photo_context}

Provide a structured diagnosis:
Return JSON:
{{
  "likely_causes": ["cause1", "cause2"],
  "diy_check_steps": ["step1", "step2"],
  "professional_needed": true/false,
  "tradesperson_type": "plumber/electrician/hvac/general handyman",
  "urgency": "emergency|soon|whenever",
  "estimated_cost_range": "e.g., $100-$300"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            return json.loads(response)
        except:
            return {
                "likely_causes": ["Unable to diagnose remotely"],
                "professional_needed": True,
                "tradesperson_type": "general handyman"
            }

    def diagnose_with_photo(self, description: str, image_bytes: bytes) -> Dict:
        """Vision-based diagnosis using NVIDIA."""
        try:
            from app.services.nvidia_client import get_nvidia_client
            import base64
            client = get_nvidia_client()
            img_b64 = base64.b64encode(image_bytes).decode()
            prompt = f"""A homeowner reports this issue: "{description}".
Look at the photo and provide a structured diagnosis.
Return JSON with: likely_causes (list), diy_check_steps (list), professional_needed (bool), tradesperson_type, urgency, estimated_cost_range."""
            response = client.complete(
                task="vision",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}}
                    ]
                }],
                max_tokens=1024
            )
            return json.loads(response)
        except Exception as e:
            self.log_action("vision_diagnose_failed", str(e))
            return self.diagnose_problem(description)

    def estimate_repair_cost(self, appliance: str, issue: str) -> Dict:
        prompt = f"""Estimate the cost to repair a {appliance} with issue: "{issue}".
Also suggest if replacement makes more sense.
Return JSON:
{{
  "repair_cost_low": number,
  "repair_cost_high": number,
  "replace_cost_low": number,
  "replace_cost_high": number,
  "recommendation": "repair|replace|depends",
  "reasoning": "short explanation"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT)
        try:
            return json.loads(response)
        except:
            return {"recommendation": "Get a professional quote"}

    def get_diy_instructions(self, task_name: str) -> Dict:
        prompt = f"""Provide safe, clear DIY instructions for a homeowner to: {task_name}.
Include safety warnings, tools needed, and estimated time.
Return JSON:
{{
  "tools_needed": ["tool1", "tool2"],
  "estimated_time_minutes": number,
  "difficulty": "easy|moderate|hard",
  "steps": ["step 1", "step 2", ...],
  "safety_warnings": ["warning1"],
  "video_search_query": "YouTube search terms"
}}"""

        response = self.ask_claude(prompt, system=self.SYSTEM_PROMPT, max_tokens=1024)
        try:
            return json.loads(response)
        except:
            return {"steps": ["Consult a professional for this task."]}