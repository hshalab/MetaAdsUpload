"use client";

import { useState, useEffect, useCallback } from "react";
import { format, subDays } from "date-fns";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  Trophy,
  ChevronDown,
  ChevronRight,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Banknote,
} from "lucide-react";

interface EditorAd {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
  ctr: number;
  hookRate: number;
  bonus: number;
  bonusTier: string | null;
}

interface EditorData {
  editor: string;
  totalSpend: number;
  totalPurchaseValue: number;
  totalPurchases: number;
  totalImpressions: number;
  roas: number;
  ctr: number;
  totalBonus: number;
  adCount: number;
  ads: EditorAd[];
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function BonusBadge({ bonus }: { bonus: number }) {
  if (bonus === 0) return <span className="text-muted-foreground text-sm">-</span>;
  const color =
    bonus >= 50 ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
    bonus >= 30 ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
    bonus >= 20 ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
    "bg-green-500/20 text-green-400 border-green-500/30";

  return (
    <Badge variant="outline" className={color}>
      <Trophy className="h-3 w-3 mr-1" />
      ${bonus}
    </Badge>
  );
}

function EditorRow({ editor }: { editor: EditorData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {editor.editor}
            <span className="text-xs text-muted-foreground">
              ({editor.adCount} ad{editor.adCount !== 1 ? "s" : ""})
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right">${fmt(editor.totalSpend, 2)}</TableCell>
        <TableCell className="text-right">${fmt(editor.totalPurchaseValue, 2)}</TableCell>
        <TableCell className="text-right">
          <span className={editor.roas >= 2.5 ? "text-green-400" : editor.roas >= 2.0 ? "text-yellow-400" : "text-red-400"}>
            {editor.roas.toFixed(2)}x
          </span>
        </TableCell>
        <TableCell className="text-right">{editor.totalPurchases}</TableCell>
        <TableCell className="text-right">{editor.ctr.toFixed(2)}%</TableCell>
        <TableCell className="text-right">
          <span className="font-semibold text-green-400">${fmt(editor.totalBonus)}</span>
        </TableCell>
      </TableRow>
      {expanded &&
        editor.ads.map((ad) => (
          <TableRow key={ad.id} className="bg-muted/30 text-sm">
            <TableCell className="pl-10 text-muted-foreground">{ad.name}</TableCell>
            <TableCell className="text-right">${fmt(ad.spend, 2)}</TableCell>
            <TableCell className="text-right">${fmt(ad.purchaseValue, 2)}</TableCell>
            <TableCell className="text-right">
              <span className={ad.roas >= 2.5 ? "text-green-400" : ad.roas >= 2.0 ? "text-yellow-400" : "text-red-400"}>
                {ad.roas.toFixed(2)}x
              </span>
            </TableCell>
            <TableCell className="text-right">{ad.purchases}</TableCell>
            <TableCell className="text-right">{ad.ctr.toFixed(2)}%</TableCell>
            <TableCell className="text-right">
              <BonusBadge bonus={ad.bonus} />
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

interface AssignmentStat {
  editorName: string;
  completedAssignments: number;
  avgEditingMinutes: number;
  revisionRate: number;
  totalTrackedHours: number;
}

export default function EditorsPage() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [editors, setEditors] = useState<EditorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStat[]>([]);

  const fetchEditors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
      });
      const [editorsRes, statsRes] = await Promise.all([
        fetch(`/api/editors?${params}`),
        fetch("/api/editors/assignment-stats").catch(() => null),
      ]);
      if (!editorsRes.ok) throw new Error("Failed to fetch");
      const data = await editorsRes.json();
      setEditors(data.editors);

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setAssignmentStats(statsData.editors || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchEditors();
  }, [fetchEditors]);

  const totalSpend = editors.reduce((s, e) => s + e.totalSpend, 0);
  const totalRevenue = editors.reduce((s, e) => s + e.totalPurchaseValue, 0);
  const totalBonus = editors.reduce((s, e) => s + e.totalBonus, 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editor Performance</h1>
          <p className="text-sm text-muted-foreground">
            Ad performance and bonus tracking per video editor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
          <Button variant="outline" size="sm" onClick={fetchEditors} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Editors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${loading ? "animate-pulse" : ""}`}>
              {loading ? "..." : editors.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Ad Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${loading ? "animate-pulse" : ""}`}>
              {loading ? "..." : `$${fmt(totalSpend, 2)}`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall ROAS</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${loading ? "animate-pulse" : ""}`}>
              {loading ? "..." : `${overallRoas.toFixed(2)}x`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bonuses</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold text-green-400 ${loading ? "animate-pulse" : ""}`}>
              {loading ? "..." : `$${fmt(totalBonus)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Card */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            YOUR PAYOUT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-400">
            {loading ? "..." : `$${fmt(totalBonus)}`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Total bonuses earned this period across {editors.length} editor{editors.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Assignment Stats */}
      {assignmentStats.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Assignment Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Editor</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Avg Edit Time</TableHead>
                  <TableHead className="text-right">Revision Rate</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentStats.map((stat) => (
                  <TableRow key={stat.editorName}>
                    <TableCell className="font-medium">{stat.editorName}</TableCell>
                    <TableCell className="text-right">{stat.completedAssignments}</TableCell>
                    <TableCell className="text-right">
                      {stat.avgEditingMinutes > 0
                        ? `${Math.round(stat.avgEditingMinutes)}m`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          stat.revisionRate > 30
                            ? "text-red-400"
                            : stat.revisionRate > 15
                              ? "text-yellow-400"
                              : "text-green-400"
                        }
                      >
                        {stat.revisionRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {stat.totalTrackedHours.toFixed(1)}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Bonus Tiers Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Bonus Tiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              $10 — $500+ spend, 2.5+ ROAS
            </Badge>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              $20 — $1,000+ spend, 2.5+ ROAS
            </Badge>
            <Badge variant="outline" className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              $30 — $3,750+ spend, 2.0+ ROAS
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
              $50 — $7,500+ spend, 2.0+ ROAS
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Editor Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Editor</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
                <TableHead className="text-right">Purchases</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading editor data...
                  </TableCell>
                </TableRow>
              ) : editors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No editor data found. Ads must follow naming convention: &quot;SE EditorName ...&quot;
                  </TableCell>
                </TableRow>
              ) : (
                editors.map((editor) => (
                  <EditorRow key={editor.editor} editor={editor} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
