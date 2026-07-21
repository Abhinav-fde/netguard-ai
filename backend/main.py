from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
import subprocess
import platform
import socket
import time
import psutil
import os
import httpx
import re

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
app = FastAPI(
    title="NetGuard AI API",
    description="Network monitoring and intelligent diagnostics API",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class NetworkMetrics(BaseModel):
    status: str
    latency: float
    packetLoss: float
    severity: str
    incident: str
    internetStatus: str
    dnsStatus: str
    dnsResponseTime: float
    gateway: str

@app.get("/")
def root():
    return {
        "service": "NetGuard AI",
        "status": "running"
    }

@app.get("/api/network-health")
def network_health():
    target = "8.8.8.8"

    start_time = time.time()

    try:
        # Try using the system ping command
        ping_parameter = (
            "-n"
            if platform.system().lower() == "windows"
            else "-c"
        )

        result = subprocess.run(
            ["ping", ping_parameter, "1", target],
            capture_output=True,
            text=True,
            timeout=5
        )

        latency = round(
            (time.time() - start_time) * 1000,
            2
        )

        online = result.returncode == 0

    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Render may not provide the ping executable.
        # Use an HTTP connectivity check instead.
        try:
            start_time = time.time()

            response = httpx.get(
                "https://www.google.com",
                timeout=5.0
            )

            latency = round(
                (time.time() - start_time) * 1000,
                2
            )

            online = response.status_code < 500

        except Exception:
            latency = 0
            online = False

    hostname = socket.gethostname()

    try:
        local_ip = socket.gethostbyname(hostname)
    except socket.error:
        local_ip = "Unknown"

    network_stats = psutil.net_io_counters()

    if not online:
        health_status = "Critical"
        severity = "High"
        incident = "Network connection unavailable"

    elif latency > 100:
        health_status = "Warning"
        severity = "Medium"
        incident = "High network latency detected"

    else:
        health_status = "Healthy"
        severity = "Normal"
        incident = "No network issues detected"

    return {
        "status": health_status,
        "latency": latency if online else 0,
        "packetLoss": 0 if online else 100,
        "hostname": hostname,
        "localIp": local_ip,
        "bytesSent": network_stats.bytes_sent,
        "bytesReceived": network_stats.bytes_recv,
        "severity": severity,
        "incident": incident
    }
@app.post("/api/diagnose")
async def diagnose_network(metrics: NetworkMetrics):

    if not OPENROUTER_API_KEY:
        return {
            "diagnosis": "OpenRouter API key is not configured."
        }

    prompt = f"""
You are NetGuard AI, an expert network operations and troubleshooting assistant.

Analyze the following real-time network diagnostic information.

NETWORK HEALTH
--------------
Overall Status: {metrics.status}
Latency: {metrics.latency} ms
Packet Loss: {metrics.packetLoss}%
Severity: {metrics.severity}
Detected Incident: {metrics.incident}

ADVANCED DIAGNOSTICS
--------------------
Internet Connectivity: {metrics.internetStatus}
DNS Status: {metrics.dnsStatus}
DNS Response Time: {metrics.dnsResponseTime} ms
Default Gateway: {metrics.gateway}

Your task is to identify the most likely network condition based only on
the provided metrics.

Return a concise professional diagnosis using exactly these sections:

Overall Health:
Issue Detected:
Root Cause Analysis:
Recommended Actions:

Rules:
- Do not invent problems that are not supported by the metrics.
- If the network is healthy, clearly state that no significant issue is detected.
- Distinguish between DNS failures, internet connectivity failures,
  packet loss, and high latency.
- Prioritize the most likely root cause.
- Provide practical troubleshooting actions.
"""

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30.0
            )

        if response.status_code != 200:
            print("OpenRouter Error Status:", response.status_code)
            print("OpenRouter Error Response:", response.text)


            return {
                "diagnosis": "AI diagnosis service is currently unavailable.",
                "error": response.text
            }

        result = response.json()

        try:
            diagnosis = result["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            return {
                "diagnosis": "Invalid response received from OpenRouter.",
                "error": result
            }

        return {
            "diagnosis": diagnosis
        }

    except Exception as error:
        return {
            "diagnosis": "Unable to complete AI network diagnosis.",
            "error": str(error)
        }
@app.get("/api/diagnostics")
def advanced_diagnostics():
    diagnostics = {}

    # -------------------------------------------------
    # Internet Connectivity
    # -------------------------------------------------
    try:
        start_time = time.time()

        response = httpx.get(
            "https://www.google.com",
            timeout=5.0
        )

        diagnostics["internet"] = {
            "status": (
                "Connected"
                if response.status_code < 500
                else "Disconnected"
            )
        }

    except Exception:
        diagnostics["internet"] = {
            "status": "Disconnected"
        }

    # -------------------------------------------------
    # DNS Resolution
    # -------------------------------------------------
    try:
        start = time.time()

        resolved_ip = socket.gethostbyname("google.com")

        dns_time = round(
            (time.time() - start) * 1000,
            2
        )

        diagnostics["dns"] = {
            "status": "Healthy",
            "resolvedIp": resolved_ip,
            "responseTime": dns_time
        }

    except socket.error:
        diagnostics["dns"] = {
            "status": "Failed",
            "resolvedIp": "Unavailable",
            "responseTime": 0
        }

    # -------------------------------------------------
    # Default Gateway
    # -------------------------------------------------
    gateway = "Cloud Managed"

    try:
        if platform.system().lower() == "windows":

            route_result = subprocess.run(
                ["ipconfig"],
                capture_output=True,
                text=True,
                timeout=5
            )

            match = re.search(
                r"Default Gateway[ .:]*([\d.]+)",
                route_result.stdout
            )

        else:
            route_result = subprocess.run(
                ["ip", "route"],
                capture_output=True,
                text=True,
                timeout=5
            )

            match = re.search(
                r"default via ([\d.]+)",
                route_result.stdout
            )

        if match:
            gateway = match.group(1)

    except (FileNotFoundError, subprocess.TimeoutExpired):
        # Render containers may not provide the "ip" command
        gateway = "Cloud Managed"

    except Exception:
        gateway = "Cloud Managed"

    diagnostics["gateway"] = {
        "address": gateway
    }

    # -------------------------------------------------
    # Network Traffic
    # -------------------------------------------------
    try:
        network_stats = psutil.net_io_counters()

        diagnostics["traffic"] = {
            "bytesSent": network_stats.bytes_sent,
            "bytesReceived": network_stats.bytes_recv
        }

    except Exception:
        diagnostics["traffic"] = {
            "bytesSent": 0,
            "bytesReceived": 0
        }

    # -------------------------------------------------
    # Return Diagnostics
    # -------------------------------------------------
    return diagnostics