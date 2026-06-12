"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import {
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useRetryDelivery,
  useUpdateWebhookEndpoint,
  useWebhookDeliveries,
  useWebhookEndpoints,
} from "@/lib/queries";
import type { WebhookDeliveryStatus } from "@/lib/types";

function deliveryVariant(
  status: WebhookDeliveryStatus,
): "default" | "secondary" | "destructive" {
  if (status === "succeeded") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

export default function WebhooksPage() {
  const endpoints = useWebhookEndpoints();
  const deliveries = useWebhookDeliveries();
  const createEndpoint = useCreateWebhookEndpoint();
  const updateEndpoint = useUpdateWebhookEndpoint();
  const deleteEndpoint = useDeleteWebhookEndpoint();
  const retry = useRetryDelivery();

  const [url, setUrl] = useState("");
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  async function handleCreate() {
    if (!url.trim()) return;
    try {
      await createEndpoint.mutateAsync(url.trim());
      setUrl("");
      toast.success("Endpoint added");
    } catch {
      toast.error("Could not add endpoint (must be a valid URL)");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">
          Receive signed <code>payment.succeeded</code> /{" "}
          <code>payment.failed</code> events. Verify the{" "}
          <code>PayBridge-Signature</code> header with your signing secret.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoints</CardTitle>
          <CardDescription>
            We POST events to each enabled endpoint and retry with backoff.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com/webhooks/paybridge"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={createEndpoint.isPending}>
              Add endpoint
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Signing secret</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No endpoints yet.
                  </TableCell>
                </TableRow>
              )}
              {endpoints.data?.data.map((ep) => (
                <TableRow key={ep.id}>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">
                    {ep.url}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(ep.signingSecret);
                        toast.success("Signing secret copied");
                      }}
                      title="Click to copy"
                    >
                      {revealed[ep.id]
                        ? ep.signingSecret
                        : `${ep.signingSecret.slice(0, 9)}…`}
                    </button>{" "}
                    <button
                      type="button"
                      className="text-xs underline underline-offset-2"
                      onClick={() =>
                        setRevealed((r) => ({ ...r, [ep.id]: !r[ep.id] }))
                      }
                    >
                      {revealed[ep.id] ? "hide" : "reveal"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ep.enabled ? "default" : "outline"}>
                      {ep.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateEndpoint.mutate({ id: ep.id, enabled: !ep.enabled })
                      }
                    >
                      {ep.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEndpoint.mutate(ep.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent deliveries</CardTitle>
          <CardDescription>
            The last 100 delivery attempts across your endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Result</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.data?.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No deliveries yet. Complete a payment to trigger one.
                  </TableCell>
                </TableRow>
              )}
              {deliveries.data?.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <span className="font-mono text-xs">{d.eventType}</span>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(d.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
                    {d.endpoint.url}
                  </TableCell>
                  <TableCell>
                    <Badge variant={deliveryVariant(d.status)}>{d.status}</Badge>
                  </TableCell>
                  <TableCell>{d.attempts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.responseStatus
                      ? `HTTP ${d.responseStatus}`
                      : (d.error ?? "—")}
                  </TableCell>
                  <TableCell className="text-right">
                    {d.status !== "succeeded" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => retry.mutate(d.id)}
                        disabled={retry.isPending}
                      >
                        Retry
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
