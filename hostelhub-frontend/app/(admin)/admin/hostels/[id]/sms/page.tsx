"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

import {
  ApiError,
  smsApi,
  type SMSBroadcastPreview,
  type SMSLogEntry,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MAX_CHARS = 459;
const SEG1 = 160;
const SEG2 = 306;
const SEG3 = 459;

export default function AdminSMSBroadcastPage() {
  const { id: hostelId } = useParams() as { id: string };

  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SMSBroadcastPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState<SMSLogEntry[]>([]);
  const [logLoading, setLogLoading] = useState(true);

  const chars = message.length;
  const segments = useMemo(() => {
    if (chars === 0) return 0;
    if (chars <= SEG1) return 1;
    if (chars <= SEG2) return 2;
    return 3;
  }, [chars]);
  const overLimit = chars > MAX_CHARS;

  // Debounced preview
  useEffect(() => {
    if (!message.trim()) {
      setPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await smsApi.preview(hostelId, message);
        setPreview(res);
      } catch {
        // Non-fatal — just don't show a cost estimate
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [hostelId, message]);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      const res = await smsApi.log(hostelId);
      setLog(res.results);
    } catch {
      // ignore — the log is a secondary signal
    } finally {
      setLogLoading(false);
    }
  }, [hostelId]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  async function handleSend() {
    setSending(true);
    try {
      const summary = await smsApi.broadcast(hostelId, message);
      toast.success(
        `Broadcast queued to ${summary.audience_count} student${
          summary.audience_count === 1 ? "" : "s"
        }.`
      );
      setMessage("");
      setPreview(null);
      loadLog();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not send.";
      toast.error(msg);
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  const audience = preview?.audience_count ?? 0;
  const cost = preview?.estimated_cost_ghs ?? "0.00";

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-indigo-600" />
          SMS Broadcast
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a single SMS to every student with an active booking on this
          hostel. Limit: 3 broadcasts per hour.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Compose */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Reminder: water will be off Saturday morning 8am–12pm."
              className="min-h-[160px] text-sm resize-none"
              maxLength={MAX_CHARS + 100}
            />

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono ${overLimit ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                >
                  {chars} / {MAX_CHARS}
                </span>
                <Badge variant={segments > 2 ? "destructive" : "secondary"}>
                  {segments} segment{segments === 1 ? "" : "s"}
                </Badge>
              </div>
              <span className="text-muted-foreground">
                SMS splits at 160 / 306 / 459 chars
              </span>
            </div>

            <Progress
              value={Math.min(100, (chars / MAX_CHARS) * 100)}
              className={overLimit ? "[&>div]:bg-destructive" : ""}
            />

            {overLimit && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                Message exceeds the 3-segment cap.
              </div>
            )}

            <div className="pt-2 flex items-center justify-end">
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!message.trim() || overLimit || audience === 0}
                className="gap-1.5"
              >
                <Send className="w-4 h-4" />
                Review &amp; send
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audience + cost */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Audience
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Stat
              label="Students"
              value={previewLoading ? "…" : String(audience)}
              hint="Currently booked (confirmed or checked-in)"
            />
            <Stat
              label="Segments per message"
              value={String(segments)}
              hint="Longer messages cost more to send"
            />
            <Stat
              label="Estimated cost"
              value={previewLoading ? "…" : `GH₵ ${cost}`}
              hint="Arkesel per-segment rate"
              icon={<Wallet className="w-4 h-4 text-emerald-600" />}
            />
            {audience === 0 && !previewLoading && chars > 0 && (
              <div className="rounded-md bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800">
                No active bookers yet — nothing to send. Students' bookings show
                up here once they confirm payment.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Recent broadcasts</span>
            <Button variant="ghost" size="sm" onClick={loadLog} disabled={logLoading}>
              {logLoading ? "Refreshing…" : "Refresh"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : log.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No broadcasts sent yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {log.map((row) => (
                <li key={row.id} className="py-3 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {row.status === "SENT" || row.status === "DELIVERED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : row.status === "FAILED" ? (
                      <XCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground line-clamp-2">{row.body}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      To {row.to_phone} ·{" "}
                      {new Date(row.created_at).toLocaleString()}
                      {row.cost ? ` · GH₵ ${row.cost}` : ""}
                    </p>
                  </div>
                  <Badge
                    variant={
                      row.status === "SENT" || row.status === "DELIVERED"
                        ? "secondary"
                        : row.status === "FAILED"
                        ? "destructive"
                        : "outline"
                    }
                    className="shrink-0"
                  >
                    {row.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to send to <strong>{audience}</strong> student
              {audience === 1 ? "" : "s"}. Estimated cost:{" "}
              <strong>GH₵ {cost}</strong>. This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSend} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Sending…
                </>
              ) : (
                "Send now"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
