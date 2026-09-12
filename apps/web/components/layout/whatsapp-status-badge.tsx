"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff, QrCode, AlertCircle } from "lucide-react";

type ConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTH_REQUIRED"
  | "ERROR";

export function WhatsAppStatusBadge() {
  const [state, setState] = useState<ConnectionState>("DISCONNECTED");

  useEffect(() => {
    // Poll connection state
    const check = async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (res.ok) {
          const data = await res.json() as { state: ConnectionState };
          setState(data.state);
        }
      } catch {
        setState("ERROR");
      }
    };

    check();
    const interval = setInterval(check, 10000); // check every 10s
    return () => clearInterval(interval);
  }, []);

  const config: Record<
    ConnectionState,
    { label: string; color: string; icon: typeof Wifi }
  > = {
    CONNECTED: {
      label: "WhatsApp Connected",
      color: "text-green-500",
      icon: Wifi,
    },
    CONNECTING: {
      label: "Connecting...",
      color: "text-amber-500",
      icon: Wifi,
    },
    AUTH_REQUIRED: {
      label: "Scan QR Code",
      color: "text-amber-500",
      icon: QrCode,
    },
    DISCONNECTED: {
      label: "WhatsApp Offline",
      color: "text-muted-foreground",
      icon: WifiOff,
    },
    ERROR: {
      label: "Connection Error",
      color: "text-red-500",
      icon: AlertCircle,
    },
  };

  const { label, color, icon: Icon } = config[state];

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        {state === "CONNECTED" && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>
      <span className={cn("text-xs font-medium truncate", color)}>{label}</span>
    </div>
  );
}
