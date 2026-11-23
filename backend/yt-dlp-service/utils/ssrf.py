import ipaddress
import socket
from typing import Sequence
from urllib.parse import urlparse
from fastapi import HTTPException

BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),       # Loopback IPv4
    ipaddress.ip_network("10.0.0.0/8"),        # Private Class A
    ipaddress.ip_network("172.16.0.0/12"),     # Private Class B
    ipaddress.ip_network("192.168.0.0/16"),    # Private Class C
    ipaddress.ip_network("169.254.0.0/16"),    # Link-local / Cloud metadata (AWS/GCP/Azure)
    ipaddress.ip_network("0.0.0.0/8"),         # Broadcast / current network
    ipaddress.ip_network("100.64.0.0/10"),     # Carrier-grade NAT
    ipaddress.ip_network("198.18.0.0/15"),     # Benchmarking
    ipaddress.ip_network("::1/128"),           # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),          # IPv6 unique local / private
    ipaddress.ip_network("fe80::/10"),         # IPv6 link-local
    ipaddress.ip_network("::ffff:0:0/96"),     # IPv4-mapped IPv6
]

PROHIBITED_HOSTNAMES = {
    "localhost",
    "localhost.localdomain",
    "ip6-localhost",
    "ip6-loopback",
    "metadata.google.internal",
    "metadata.local",
    "instance-data",
}


def validate_safe_url(
    url: str,
    allow_private: bool = False,
    allowed_schemes: Sequence[str] = ("http", "https")
) -> str:
    """
    Validates that a URL is a valid address and does not target
    localhost, private subnets, or cloud metadata services (SSRF protection).
    """
    if not url or not isinstance(url, str):
        raise HTTPException(status_code=400, detail="URL must be a non-empty string.")

    url = url.strip()
    try:
        parsed = urlparse(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Malformed URL: {str(e)}")

    if parsed.scheme.lower() not in allowed_schemes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid URL scheme '{parsed.scheme}'. Allowed schemes: {list(allowed_schemes)}."
        )

    hostname = parsed.hostname
    if not hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: Missing hostname.")

    hostname_clean = hostname.lower().strip()

    if hostname_clean in PROHIBITED_HOSTNAMES:
        raise HTTPException(
            status_code=403,
            detail=f"SSRF protection: access to '{hostname}' is strictly forbidden."
        )

    # Check if hostname directly parses as an IP address
    try:
        ip_direct = ipaddress.ip_address(hostname_clean)
        if not allow_private:
            for net in BLOCKED_IP_NETWORKS:
                if ip_direct in net:
                    raise HTTPException(
                        status_code=403,
                        detail=f"SSRF protection: direct access to private/internal IP {ip_direct} is forbidden."
                    )
        return url
    except ValueError:
        pass  # Hostname is a domain name, proceed to DNS resolution

    if allow_private:
        return url

    # Resolve hostname to IPv4/IPv6 addresses
    try:
        addr_infos = socket.getaddrinfo(hostname_clean, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail=f"Hostname '{hostname}' could not be resolved.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DNS resolution failed: {str(e)}")

    for addr in addr_infos:
        ip_str = addr[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            for net in BLOCKED_IP_NETWORKS:
                if ip_obj in net:
                    raise HTTPException(
                        status_code=403,
                        detail=f"SSRF protection: Hostname '{hostname}' resolves to private/internal IP ({ip_str}). Access denied."
                    )
        except ValueError:
            continue

    return url
