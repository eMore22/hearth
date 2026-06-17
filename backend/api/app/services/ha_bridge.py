"""
Home Assistant Bridge Service
Handles all outbound communication with a household's HA instance.
Called by the automation router and the Chief of Staff agent.
"""
import httpx
import json
from typing import Any, Dict, List, Optional
from datetime import datetime


class HABridgeService:
    """
    Thin async wrapper around Home Assistant's REST API.
    Each method maps to one HA endpoint.
    """

    def __init__(self, ha_url: str, access_token: str):
        # Strip trailing slash so we can always append paths cleanly
        self.base_url = ha_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        # 10s timeout — HA is local so anything slower means something is wrong
        self.timeout = httpx.Timeout(10.0)

    # ── Connection test ───────────────────────────────────────────────────────
    async def ping(self) -> bool:
        """Return True if the HA instance is reachable and the token is valid."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(
                    f"{self.base_url}/api/",
                    headers=self.headers,
                )
                return resp.status_code == 200
        except Exception:
            return False

    # ── Device discovery ──────────────────────────────────────────────────────
    async def get_all_states(self) -> List[Dict]:
        """
        Fetch the full state list from HA.
        Returns every entity with its current state and attributes.
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.base_url}/api/states",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_entity_state(self, entity_id: str) -> Dict:
        """Fetch the current state of a single entity."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.base_url}/api/states/{entity_id}",
                headers=self.headers,
            )
            resp.raise_for_status()
            return resp.json()

    # ── Command execution ─────────────────────────────────────────────────────
    async def call_service(
        self,
        domain: str,
        service: str,
        entity_id: str,
        extra_data: Optional[Dict] = None,
    ) -> Dict:
        """
        Call a Home Assistant service (the mechanism behind all device control).
        Examples:
          call_service("switch", "turn_off", "switch.garage_door")
          call_service("light", "turn_on", "light.kitchen", {"brightness": 128})
          call_service("lock", "lock", "lock.front_door")
          call_service("cover", "close_cover", "cover.garage")
        """
        payload = {"entity_id": entity_id}
        if extra_data:
            payload.update(extra_data)

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/services/{domain}/{service}",
                headers=self.headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json() if resp.content else {"status": "ok"}

    # ── Convenience wrappers ──────────────────────────────────────────────────
    async def turn_on(self, entity_id: str) -> Dict:
        domain = entity_id.split(".")[0]
        return await self.call_service(domain, "turn_on", entity_id)

    async def turn_off(self, entity_id: str) -> Dict:
        domain = entity_id.split(".")[0]
        return await self.call_service(domain, "turn_off", entity_id)

    async def close_cover(self, entity_id: str) -> Dict:
        return await self.call_service("cover", "close_cover", entity_id)

    async def open_cover(self, entity_id: str) -> Dict:
        return await self.call_service("cover", "open_cover", entity_id)

    async def lock(self, entity_id: str) -> Dict:
        return await self.call_service("lock", "lock", entity_id)

    async def unlock(self, entity_id: str) -> Dict:
        return await self.call_service("lock", "unlock", entity_id)

    # ── Device list builder ───────────────────────────────────────────────────
    @staticmethod
    def parse_devices_from_states(states: List[Dict]) -> List[Dict]:
        """
        Convert the raw HA states list into a clean device list
        that we store in ha_devices and show in the app.
        Only includes domains that Hearth cares about.
        """
        ACTIONABLE_DOMAINS = {
            "switch", "light", "lock", "cover",
            "input_boolean", "fan", "climate",
        }
        SENSOR_DOMAINS = {
            "sensor", "binary_sensor", "water_heater",
        }
        RELEVANT_DOMAINS = ACTIONABLE_DOMAINS | SENSOR_DOMAINS

        devices = []
        for state in states:
            entity_id = state.get("entity_id", "")
            domain = entity_id.split(".")[0]
            if domain not in RELEVANT_DOMAINS:
                continue

            attrs = state.get("attributes", {})
            devices.append({
                "entity_id": entity_id,
                "friendly_name": attrs.get("friendly_name", entity_id),
                "domain": domain,
                "device_class": attrs.get("device_class"),
                "area": attrs.get("area_id"),
                "last_state": state.get("state"),
                "last_state_at": state.get("last_changed"),
                "is_actionable": domain in ACTIONABLE_DOMAINS,
            })

        return devices


def build_ha_bridge(ha_url: str, access_token: str) -> HABridgeService:
    return HABridgeService(ha_url=ha_url, access_token=access_token)