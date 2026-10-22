"""Test that no private DNS answer is ever used for a TCP connection."""
import asyncio
import socket
import unittest
from unittest.mock import patch

from app.services.ha_bridge import PublicOnlyResolver, HABridgeService


def answer(ip, family=socket.AF_INET):
    return (family, socket.SOCK_STREAM, socket.IPPROTO_TCP, "", (ip, 443))


class SafeResolverTests(unittest.IsolatedAsyncioTestCase):
    async def test_public_dns_is_exact_connect_target(self):
        resolver = PublicOnlyResolver()
        event_loop = asyncio.get_running_loop()
        async def addresses(*args, **kwargs):
            return [answer("8.8.8.8"), answer("1.1.1.1")]
        with patch.object(event_loop, "getaddrinfo", side_effect=addresses):
            rows = await resolver.resolve("home.example.org", 443)
        self.assertEqual({r["host"] for r in rows}, {"8.8.8.8", "1.1.1.1"})
        self.assertEqual({r["hostname"] for r in rows}, {"home.example.org"})

    async def test_mixed_dns_public_and_private_fails_closed(self):
        loop = asyncio.get_running_loop()
        async def answers(*args, **kwargs):
            return [answer("8.8.8.8"), answer("127.0.0.1")]
        with patch.object(loop, "getaddrinfo", side_effect=answers):
            with self.assertRaises(OSError):
                await PublicOnlyResolver().resolve("home.example.org", 443)

    async def test_metadata_and_ipv6_mapped_private_are_blocked(self):
        loop = asyncio.get_running_loop()
        for ip, family in [("169.254.169.254", socket.AF_INET), ("::ffff:127.0.0.1", socket.AF_INET6)]:
            async def answers(*args, **kwargs):
                return [answer(ip, family)]
            with patch.object(loop, "getaddrinfo", side_effect=answers):
                with self.assertRaises(OSError):
                    await PublicOnlyResolver().resolve("home.example.org", 443)

    def test_url_restrictions_do_not_loosen(self):
        from fastapi import HTTPException
        for url in ("https://localhost", "https://192.168.1.10",
                    "http://home.example.org", "https://home.example.org:8123"):
            with self.assertRaises(HTTPException):
                HABridgeService(url, "TEST_TOKEN")


if __name__ == "__main__":
    unittest.main()
