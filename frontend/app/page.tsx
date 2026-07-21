"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type NetworkEvent = {
  id: number;
  time: string;
  event: string;
  severity: "Normal" | "Warning" | "Critical";
  status: string;
};

export default function Home() {
  const [analyzing, setAnalyzing] = useState(false);

  const [diagnosis, setDiagnosis] = useState(
    "Network performance appears stable. Run an AI diagnosis for deeper analysis."
  );

  const [networkData, setNetworkData] = useState({
    status: "Loading...",
    latency: 0,
    packetLoss: 0,
    hostname: "Loading...",
    localIp: "Loading...",
    bytesSent: 0,
    bytesReceived: 0,
    severity: "Normal",
    incident: "No network issues detected",
  });

  const [latencyHistory, setLatencyHistory] = useState<
    { time: string; latency: number }[]
  >([]);


  const [diagnostics, setDiagnostics] = useState({
    internet: {
      status: "Checking...",
    },
    dns: {
      status: "Checking...",
      resolvedIp: "",
      responseTime: 0,
    },
    gateway: {
      address: "Checking...",
    },
    traffic: {
      bytesSent: 0,
      bytesReceived: 0,
    },
  });

  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);

  useEffect(() => {
    const fetchNetworkData = async () => {
      try {
        const response = await fetch(
          "https://netguard-ai-2.onrender.com/api/network-health"
        );
        if (!response.ok) {
          throw new Error("Failed to fetch network data");
        }

        const data = await response.json();
        setNetworkData(data);
        let eventMessage = "";
        let eventSeverity: NetworkEvent["severity"] = "Normal";

        if (data.status === "Critical") {
          eventMessage = data.incident || "Network connectivity failure detected";
          eventSeverity = "Critical";
        } else if (data.packetLoss > 0) {
          eventMessage = `Packet loss detected: ${data.packetLoss}%`;
          eventSeverity = "Warning";
        } else if (data.latency > 100) {
          eventMessage = `High network latency detected: ${data.latency} ms`;
          eventSeverity = "Warning";
        }

        if (eventMessage) {
          const newEvent: NetworkEvent = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            event: eventMessage,
            severity: eventSeverity,
            status: "Detected",
          };

          setNetworkEvents((previous) => {
            // Prevent the same event being added every 5 seconds
            if (previous[0]?.event === newEvent.event) {
              return previous;
            }

            return [newEvent, ...previous].slice(0, 10);
          });
        }
        setLatencyHistory((previous) => {
          const updated = [
            ...previous,
            {
              time: new Date().toLocaleTimeString(),
              latency: data.latency,
            },
          ];

          return updated.slice(-20);
        });
      } catch (error) {
        console.error("Network API Error:", error);
      }
    };

    const fetchDiagnostics = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/diagnostics`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch diagnostics");
        }

        const data = await response.json();

        setDiagnostics(data);
        if (data.internet.status !== "Connected") {
          const newEvent: NetworkEvent = {
            id: Date.now(),
            time: new Date().toLocaleTimeString(),
            event: "Internet connectivity issue detected",
            severity: "Critical",
            status: "Detected",
          };

          setNetworkEvents((previous) => {
            if (previous[0]?.event === newEvent.event) {
              return previous;
            }

            return [newEvent, ...previous].slice(0, 10);
          });
        }

        if (data.dns.status !== "Healthy") {
          const newEvent: NetworkEvent = {
            id: Date.now() + 1,
            time: new Date().toLocaleTimeString(),
            event: "DNS resolution failure detected",
            severity: "Critical",
            status: "Detected",
          };

          setNetworkEvents((previous) => {
            if (previous[0]?.event === newEvent.event) {
              return previous;
            }

            return [newEvent, ...previous].slice(0, 10);
          });
        }
      } catch (error) {
        console.error("Diagnostics API Error:", error);
      }
    };

    fetchNetworkData();
    fetchDiagnostics();

    const interval = setInterval(fetchNetworkData, 5000);
    const diagnosticsInterval = setInterval(
      fetchDiagnostics,
      10000
    );


    return () => {
      clearInterval(interval);
      clearInterval(diagnosticsInterval);
    };
  }, []);

  const analyzeNetwork = async () => {
    setAnalyzing(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/diagnose`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: networkData.status,
            latency: networkData.latency,
            packetLoss: networkData.packetLoss,
            severity: networkData.severity,
            incident: networkData.incident,
            internetStatus: diagnostics.internet.status,
            dnsStatus: diagnostics.dns.status,
            dnsResponseTime: diagnostics.dns.responseTime,
            gateway: diagnostics.gateway.address,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Backend diagnosis error:", response.status, errorData);
        throw new Error(
          `AI diagnosis failed: ${response.status} ${errorData}`
        );
      }
      const data = await response.json();

      setDiagnosis(data.diagnosis);
    } catch (error) {
      console.error(error);

      setDiagnosis(
        "Unable to analyze the network. Please try again."
      );
    } finally {
      setAnalyzing(false);
    }
  };


  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 bg-slate-900/70 px-8 py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              NetGuard <span className="text-cyan-400">AI</span>
            </h1>
            <p className="text-sm text-slate-400">
              Intelligent Network Observability
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            System Online
          </div>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl p-8">
        <div className="mb-8">
          <p className="text-sm font-medium uppercase tracking-wider text-cyan-400">
            Network Operations Center
          </p>

          <h2 className="mt-2 text-3xl font-bold">
            Network Overview
          </h2>

          <p className="mt-2 text-slate-400">
            Monitor network performance and detect connectivity issues.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Network Health"
            value={networkData.status}
            detail={`Host: ${networkData.hostname}`}
          />

          <MetricCard
            title="Latency"
            value={`${networkData.latency} ms`}
            detail="Live network response time"
          />

          <MetricCard
            title="Packet Loss"
            value={`${networkData.packetLoss}%`}
            detail="Live connectivity monitoring"
          />

          <MetricCard
            title="Local IP"
            value={networkData.localIp}
            detail={networkData.hostname}
          />
        </div>

        {/* Advanced Network Diagnostics */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-cyan-400">
              Advanced Diagnostics
            </p>

            <h3 className="mt-2 text-xl font-semibold">
              Network Diagnostic Center
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Real-time connectivity, DNS, gateway, and traffic diagnostics.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <DiagnosticCard
              title="Internet"
              value={diagnostics.internet.status}
              detail="Internet connectivity status"
            />

            <DiagnosticCard
              title="DNS Health"
              value={diagnostics.dns.status}
              detail={`${diagnostics.dns.responseTime} ms response`}
            />

            <DiagnosticCard
              title="Default Gateway"
              value={diagnostics.gateway.address}
              detail="Primary network gateway"
            />

            <DiagnosticCard
              title="DNS Resolution"
              value={diagnostics.dns.resolvedIp || "Unavailable"}
              detail="Resolved IP address"
            />

            <DiagnosticCard
              title="Data Sent"
              value={`${(diagnostics.traffic.bytesSent / 1024 / 1024).toFixed(2)} MB`}
              detail="Total network traffic sent"
            />

            <DiagnosticCard
              title="Data Received"
              value={`${(diagnostics.traffic.bytesReceived / 1024 / 1024).toFixed(2)} MB`}
              detail="Total network traffic received"
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  Network Performance
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Real-time latency monitoring
                </p>
              </div>

              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
                Live
              </span>
            </div>

            <div className="mt-8 h-64 rounded-xl bg-slate-950 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11 }}
                  />

                  <YAxis
                    unit=" ms"
                    width={60}
                  />

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="latency"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-2xl border border-cyan-900/50 bg-slate-900 p-6">
              <p className="text-sm font-medium text-cyan-400">
                AI NETWORK COPILOT
              </p>

              <h3 className="mt-2 text-xl font-semibold">
                Diagnose your network
              </h3>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Analyze network metrics to identify potential connectivity
                problems and receive recommended actions.
              </p>

              <div className="mt-6 rounded-xl bg-slate-950 p-4">
                <p className="text-sm text-slate-500">Current assessment</p>

                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {diagnosis}
                </p>
              </div>

              <button
                onClick={analyzeNetwork}
                disabled={analyzing}
                className="mt-6 w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
              >
                {analyzing ? "Analyzing Network..." : "Run AI Diagnosis"}
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-xl font-semibold">
              Recent Network Events
            </h3>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-slate-500">
                  <tr>
                    <th className="pb-3">Time</th>
                    <th className="pb-3">Event</th>
                    <th className="pb-3">Severity</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>

                <tbody className="text-slate-300">
                  {networkEvents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-500"
                      >
                        No network incidents detected. System is monitoring.
                      </td>
                    </tr>
                  ) : (
                    networkEvents.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-800/60"
                      >
                        <td className="py-4">
                          {item.time}
                        </td>

                        <td className="py-4">
                          {item.event}
                        </td>

                        <td className="py-4">
                          <span
                            className={
                              item.severity === "Critical"
                                ? "text-red-400"
                                : item.severity === "Warning"
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                            }
                          >
                            {item.severity}
                          </span>
                        </td>

                        <td className="py-4">
                          {item.status}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-3 text-3xl font-bold">{value}</p>

      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function DiagnosticCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className="mt-2 break-words text-lg font-semibold text-slate-200">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}