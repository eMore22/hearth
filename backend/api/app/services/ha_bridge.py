"""Outbound Home Assistant REST bridge with DNS-rebinding-safe socket resolution.

The connection's actual TCP address is selected from checked public addresses;
TLS SNI and certificate verification still use the original HTTPS hostname.
No redirects, proxy inheritance, private-network targets or custom ports.
"""
import asyncio
import ipaddress
import json
import socket
import ssl
from typing import Any, Dict, List, Optional
from urllib.parse import quote

import aiohttp
from aiohttp.abc import AbstractResolver
from fastapi import HTTPException

from app.services.ha_security import public_https_host


def _public_ip(raw: str) -> bool:
    try:
        ip = ipaddress.ip_address(raw)
        return ip.is_global and not (ip.version == 6 and ip.ipv4_mapped and not ip.ipv4_mapped.is_global)
    except ValueError:
        return False


class PublicOnlyResolver(AbstractResolver):
    """The addresses used for TCP connect are exactly the vetted DNS answers."""

    async def resolve(self, host: str, port: int = 0, family: int = socket.AF_INET):
        public_https_host("https://" + host)
        if port != 443:
            raise OSError("Only standard HTTPS port is allowed")
        try:
            addresses = await asyncio.wait_for(
                asyncio.get_running_loop().getaddrinfo(
                    host, port, type=socket.SOCK_STREAM, family=socket.AF_UNSPEC),
                timeout=3.0)
        except Exception as exc:
            raise OSError("Home Assistant DNS resolution unavailable") from exc
        if not addresses or any(not _public_ip(a[4][0]) for a in addresses):
            raise OSError("Home Assistant resolves to disallowed network address")
        unique = {}
        for family_id, _type, _proto, _canon, addr in addresses:
            resolved = addr[0]
            unique[(resolved, family_id)] = {
                "hostname": host, "host": resolved, "port": port,
                "family": family_id, "proto": socket.IPPROTO_TCP, "flags": 0,
            }
        return list(unique.values())

    async def close(self) -> None:
        return None


class HABridgeService:
    def __init__(self, ha_url: str, access_token: str):
        host = public_https_host(ha_url)
        self.base_url = f"https://{host}"
        self.headers = {"Authorization": f"Bearer {access_token}",
                        "Content-Type": "application/json"}
        self.timeout = aiohttp.ClientTimeout(total=10.0, connect=5.0)

    async def _request(self, method: str, path: str, payload: Optional[dict] = None):
        connector = aiohttp.TCPConnector(
            resolver=PublicOnlyResolver(), use_dns_cache=False,
            ssl=ssl.create_default_context(), force_close=True, limit=4)
        async with aiohttp.ClientSession(
                connector=connector, timeout=self.timeout, trust_env=False) as client:
            async with client.request(
                    method, self.base_url + path, headers=self.headers,
                    json=payload, allow_redirects=False) as response:
                # Never follow a 3xx to an unvalidated internal address.
                if 300 <= response.status < 400:
                    raise OSError("Home Assistant redirects are not permitted")
                response.raise_for_status()
                if response.status == 204:
                    return {}
                return await response.json(content_type=None)

    async def ping(self) -> bool:
        try:
            await self._request("GET", "/api/")
            return True
        except Exception:
            return False

    async def get_all_states(self) -> List[Dict]:
        return await self._request("GET", "/api/states")

    async def get_entity_state(self, entity_id: str) -> Dict:
        return await self._request("GET", "/api/states/" + quote(entity_id, safe="._-"))

    async def call_service(
        self, domain: str, service: str, entity_id: str,
        extra_data: Optional[Dict] = None,
    ) -> Dict:
        payload = {"entity_id": entity_id}
        if extra_data:
            payload.update(extra_data)
        domain = quote(domain, safe="")
        service = quote(service, safe="")
        return await self._request("POST", f"/api/services/{domain}/{service}", payload)

    async def turn_on(self, entity_id: str) -> Dict:
        return await self.call_service(entity_id.split(".")[0], "turn_on", entity_id)

    async def turn_off(self, entity_id: str) -> Dict:
        return await self.call_service(entity_id.split(".")[0], "turn_off", entity_id)

    async def close_cover(self, entity_id: str) -> Dict:
        return await self.call_service("cover", "close_cover", entity_id)

    async def open_cover(self, entity_id: str) -> Dict:
        return await self.call_service("cover", "open_cover", entity_id)

    async def lock(self, entity_id: str) -> Dict:
        return await self.call_service("lock", "lock", entity_id)

    async def unlock(self, entity_id: str) -> Dict:
        return await self.call_service("lock", "unlock", entity_id)

    @staticmethod
    def parse_devices_from_states(states: List[Dict]) -> List[Dict]:
        actionable = {"switch", "light", "lock", "cover", "input_boolean", "fan", "climate"}
        relevant = actionable | {"sensor", "binary_sensor", "water_heater"}
        devices = []
        for state in states:
            entity_id = state.get("entity_id", "")
            domain = entity_id.split(".")[0]
            if domain not in relevant:
                continue
            attrs = state.get("attributes", {})
            devices.append({
                "entity_id": entity_id, "friendly_name": attrs.get("friendly_name", entity_id),
                "domain": domain, "device_class": attrs.get("device_class"),
                "area": attrs.get("area_id"), "last_state": state.get("state"),
                "last_state_at": state.get("last_changed"),
                "is_actionable": domain in actionable,
            })
        return devices


def build_ha_bridge(ha_url: str, access_token: str) -> HABridgeService:
    return HABridgeService(ha_url, access_token)
