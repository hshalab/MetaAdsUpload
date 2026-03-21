"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  SlidersHorizontal,
  Tag,
  Package,
  Film,
  Globe,
  Gift,
  Users,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type OptionType = "angles" | "products" | "formats" | "countries" | "offerTypes" | "customerAvatars";

interface OptionItem {
  id: string;
  name: string;
  code?: string;
  description?: string | null;
  isActive: boolean;
  order: number;
}

interface AllOptions {
  angles: OptionItem[];
  products: OptionItem[];
  formats: OptionItem[];
  countries: OptionItem[];
  offerTypes: OptionItem[];
  customerAvatars: OptionItem[];
}

const TABS_CONFIG: {
  key: OptionType;
  label: string;
  icon: React.ElementType;
  hasCode: boolean;
  hasDescription: boolean;
}[] = [
  { key: "angles", label: "Angles", icon: Tag, hasCode: false, hasDescription: false },
  { key: "products", label: "Products", icon: Package, hasCode: true, hasDescription: false },
  { key: "formats", label: "Formats", icon: Film, hasCode: false, hasDescription: false },
  { key: "countries", label: "Countries", icon: Globe, hasCode: true, hasDescription: false },
  { key: "offerTypes", label: "Offer Types", icon: Gift, hasCode: false, hasDescription: false },
  { key: "customerAvatars", label: "Avatars", icon: Users, hasCode: true, hasDescription: true },
];

// API endpoint mapping
function getApiPath(type: OptionType): string {
  const map: Record<OptionType, string> = {
    angles: "angles",
    products: "products",
    formats: "formats",
    countries: "countries",
    offerTypes: "offer-types",
    customerAvatars: "customer-avatars",
  };
  return map[type];
}

export default function OptionsPage() {
  const [options, setOptions] = useState<AllOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OptionType>("angles");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: "", code: "", description: "" });

  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", code: "", description: "" });
  const [creating, setCreating] = useState(false);

  const fetchOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/options");
      if (!res.ok) throw new Error("Failed to fetch options");
      const data = await res.json();
      setOptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const currentConfig = TABS_CONFIG.find((t) => t.key === activeTab)!;
  const currentItems = options ? (options[activeTab] as OptionItem[]) || [] : [];

  const handleCreate = async () => {
    if (!newItem.name.trim()) return;
    if (currentConfig.hasCode && !newItem.code.trim()) return;

    setCreating(true);
    try {
      const body: Record<string, string | undefined> = { name: newItem.name };
      if (currentConfig.hasCode) body.code = newItem.code;
      if (currentConfig.hasDescription) body.description = newItem.description || undefined;

      const res = await fetch(`/api/options/${getApiPath(activeTab)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create");
      setNewItem({ name: "", code: "", description: "" });
      setShowCreate(false);
      fetchOptions();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const body: Record<string, string | undefined> = { name: editValues.name };
      if (currentConfig.hasCode) body.code = editValues.code;
      if (currentConfig.hasDescription) body.description = editValues.description || undefined;

      const res = await fetch(`/api/options/${getApiPath(activeTab)}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditingId(null);
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/options/${getApiPath(activeTab)}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this option?")) return;
    try {
      const res = await fetch(`/api/options/${getApiPath(activeTab)}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReorder = async (id: string, direction: "up" | "down") => {
    const idx = currentItems.findIndex((item) => item.id === id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === currentItems.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const swapItem = currentItems[swapIdx];

    try {
      await Promise.all([
        fetch(`/api/options/${getApiPath(activeTab)}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: swapItem.order }),
        }),
        fetch(`/api/options/${getApiPath(activeTab)}/${swapItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: currentItems[idx].order }),
        }),
      ]);
      fetchOptions();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (item: OptionItem) => {
    setEditingId(item.id);
    setEditValues({
      name: item.name,
      code: item.code || "",
      description: item.description || "",
    });
  };

  if (loading && !options) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !options) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Could not load options</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchOptions}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <SlidersHorizontal className="h-7 w-7" />
            Options Manager
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage dropdown options for assignments
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOptions} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OptionType)}>
        <TabsList className="grid grid-cols-6">
          {TABS_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const count = options ? (options[tab.key] as OptionItem[])?.length || 0 : 0;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 text-xs">
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                <Badge variant="secondary" className="text-[10px] ml-1 px-1 py-0">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABS_CONFIG.map((tab) => (
          <TabsContent key={tab.key} value={tab.key} className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {tab.label}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowCreate(true);
                    setNewItem({ name: "", code: "", description: "" });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add {tab.label.replace(/s$/, "")}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {tab.hasCode && <TableHead>Code</TableHead>}
                      {tab.hasDescription && <TableHead>Description</TableHead>}
                      <TableHead className="w-[80px]">Active</TableHead>
                      <TableHead className="w-[80px]">Order</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3 + (tab.hasCode ? 1 : 0) + (tab.hasDescription ? 1 : 0)}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No {tab.label.toLowerCase()} yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentItems.map((item) => (
                        <TableRow key={item.id} className={cn(!item.isActive && "opacity-50")}>
                          <TableCell>
                            {editingId === item.id ? (
                              <Input
                                value={editValues.name}
                                onChange={(e) =>
                                  setEditValues({ ...editValues, name: e.target.value })
                                }
                                className="h-8"
                              />
                            ) : (
                              <span className="font-medium">{item.name}</span>
                            )}
                          </TableCell>
                          {tab.hasCode && (
                            <TableCell>
                              {editingId === item.id ? (
                                <Input
                                  value={editValues.code}
                                  onChange={(e) =>
                                    setEditValues({ ...editValues, code: e.target.value })
                                  }
                                  className="h-8 w-24"
                                />
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  {item.code}
                                </Badge>
                              )}
                            </TableCell>
                          )}
                          {tab.hasDescription && (
                            <TableCell>
                              {editingId === item.id ? (
                                <Input
                                  value={editValues.description}
                                  onChange={(e) =>
                                    setEditValues({ ...editValues, description: e.target.value })
                                  }
                                  className="h-8"
                                />
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {item.description || "-"}
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <Switch
                              checked={item.isActive}
                              onCheckedChange={(checked) => handleToggleActive(item.id, checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleReorder(item.id, "up")}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleReorder(item.id, "down")}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === item.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-400"
                                  onClick={() => handleUpdate(item.id)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => startEdit(item)}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {currentConfig.label.replace(/s$/, "")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="Name"
                autoFocus
              />
            </div>
            {currentConfig.hasCode && (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={newItem.code}
                  onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                  placeholder="Code (e.g. SE, LP)"
                />
              </div>
            )}
            {currentConfig.hasDescription && (
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Description (optional)"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
