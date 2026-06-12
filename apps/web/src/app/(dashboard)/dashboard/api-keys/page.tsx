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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/lib/queries";
import type { CreatedApiKey } from "@/lib/types";

export default function ApiKeysPage() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);

  const keys = data?.data ?? [];

  async function handleCreate() {
    try {
      const created = await createKey.mutateAsync("secret");
      setRevealed(created);
    } catch {
      toast.error("Could not create key");
    }
  }

  async function handleRevoke(id: string) {
    try {
      await revokeKey.mutateAsync(id);
      toast.success("Key revoked");
    } catch {
      toast.error("Could not revoke key");
    }
  }

  function copyKey() {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed.key);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
          <p className="text-muted-foreground">
            Use a secret key as a bearer token against the <code>/v1</code> API.
          </p>
        </div>
        <Button onClick={handleCreate} disabled={createKey.isPending}>
          {createKey.isPending ? "Creating…" : "Create secret key"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your keys</CardTitle>
          <CardDescription>
            Secret keys are shown once at creation and stored hashed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && keys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No keys yet. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-sm">
                    {k.prefix}…
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{k.type}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(k.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {k.revokedAt ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(k.id)}
                        disabled={revokeKey.isPending}
                      >
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your secret key</DialogTitle>
            <DialogDescription>
              This is the only time the full key is shown. Store it somewhere
              safe.
            </DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded-md bg-muted p-3 font-mono text-sm">
            {revealed?.key}
          </code>
          <DialogFooter>
            <Button variant="outline" onClick={copyKey}>
              Copy
            </Button>
            <Button onClick={() => setRevealed(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
