import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../../../plugin/axios";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, BarChart3, Users, BookOpen, ClipboardList, Loader2, RefreshCw, FileSpreadsheet } from "lucide-react";

// Import the actual report components from their respective paths
import { FacultyLoadingReport } from "./reports/FacultyLoadingReport"; 
import { FacultySchedulesView } from "./reports/FacultySchedulesView"; 
import { FacultyWorkloadsView } from "./reports/FacultyWorkloadsView"; 
import { FacultyStudyLoadView } from "./reports/FacultyStudyLoadView"; // NEW IMPORT

// --- KPI DATA STRUCTURE ---
interface KpiData {
    totalFaculty: number;
    assignedSubjects: number;
    totalUnitsLoaded: number;
}

// --- TAB ID TYPE UPDATE ---
type TabId = "loading" | "schedules" | "workloads" | "studyload";
const REPORT_TAB_STORAGE_KEY = "admin_reports_active_tab_v1";
const REPORT_TAB_LABELS: Record<TabId, string> = {
  loading: "Faculty Loading",
  schedules: "Schedules",
  workloads: "Faculty Workloads",
  studyload: "Study Load",
};

// --- MAIN REPORTS PAGE COMPONENT ---
function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const saved = localStorage.getItem(REPORT_TAB_STORAGE_KEY);
    return (saved === "loading" || saved === "schedules" || saved === "workloads" || saved === "studyload")
      ? saved
      : "loading";
  });
  const [kpiData, setKpiData] = useState<KpiData>({
    totalFaculty: 0,
    assignedSubjects: 0,
    totalUnitsLoaded: 0,
  });
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchKpis = useCallback(async (forceRefresh = false) => {
    try {
      setLoadingKpis(true);
      setKpiError(null);
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        setKpiError("Authentication token not found. Please log in.");
        return;
      }
      const response = await axios.get<{ success: boolean; data: KpiData }>(
        'reports/kpis',
        {
          headers: { 'Authorization': `Bearer ${accessToken}` },
          params: forceRefresh ? { _ts: Date.now() } : undefined
        }
      );
      if (response.data.success) {
        setKpiData(response.data.data);
        setLastUpdated(new Date().toLocaleString());
      } else {
        setKpiError("Failed to load KPI data from the server.");
      }
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      setKpiError("Could not connect to the API or fetch KPI data.");
    } finally {
      setLoadingKpis(false);
    }
  }, []);

  useEffect(() => { fetchKpis(); }, [fetchKpis]);
  useEffect(() => {
    localStorage.setItem(REPORT_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey(k => k + 1);
    await fetchKpis(true);
    setIsRefreshing(false);
  };

  // Map the fetched data to the format used for rendering
  const displayedKpiData = [
      { label: "Total Faculty", value: kpiData.totalFaculty, icon: Users },
      { label: "Assigned Subjects", value: kpiData.assignedSubjects, icon: BookOpen },
      { label: "Total Units Loaded", value: kpiData.totalUnitsLoaded, icon: ClipboardList },
  ];

  // --- Render logic for loading and error states for KPIs ---

  const renderKpiCards = () => {
    if (loadingKpis) {
      return (
        <div className="flex justify-center items-center h-20 border rounded-xl bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
          <span className="text-muted-foreground">Loading Metrics...</span>
        </div>
      );
    }

    if (kpiError) {
      return (
        <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-xl">
          <p className="font-semibold">KPI Load Error</p>
          <p className="text-sm">{kpiError}</p>
        </div>
      );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedKpiData.map((kpi, i) => (
                <motion.div 
                    key={kpi.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-card p-5 rounded-xl border shadow-sm flex items-center gap-5 border-border"
                >
                    <div className="p-3 rounded-lg bg-primary/10 text-primary">
                        <kpi.icon size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-foreground">{kpi.value}</div>
                        <div className="text-sm text-muted-foreground">{kpi.label}</div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
  };

  type ExportPayload = {
    title: string;
    generatedAt: string;
    headers: string[];
    rows: string[][];
    cells?: Array<Array<{ text: string; rowSpan: number; colSpan: number }>>;
  };

  const getVisibleTable = (root: HTMLElement) => {
    return Array.from(root.querySelectorAll("table")).find((table) => {
      const rect = table.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) as HTMLTableElement | undefined;
  };

  const normalizeCellText = (value: string) => value.replace(/\s+/g, " ").trim();

  const tableToExportRows = (table: HTMLTableElement) => {
    const headerCells = Array.from(table.querySelectorAll("thead tr:first-child th"));
    const headers = headerCells.map((col) => normalizeCellText(col.textContent || ""));
    const spanTracker: Array<{ remaining: number }> = [];
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => {
      const outputRow: string[] = [];
      let columnIndex = 0;

      const fillCoveredColumns = () => {
        while (spanTracker[columnIndex]?.remaining > 0) {
          outputRow[columnIndex] = "";
          spanTracker[columnIndex].remaining -= 1;
          columnIndex += 1;
        }
      };

      Array.from(row.querySelectorAll("td")).forEach((cell) => {
        fillCoveredColumns();

        const colSpan = Math.max(1, cell.colSpan || 1);
        const rowSpan = Math.max(1, cell.rowSpan || 1);
        outputRow[columnIndex] = normalizeCellText(cell.textContent || "");

        for (let offset = 1; offset < colSpan; offset += 1) {
          outputRow[columnIndex + offset] = "";
        }

        if (rowSpan > 1) {
          for (let offset = 0; offset < colSpan; offset += 1) {
            spanTracker[columnIndex + offset] = { remaining: rowSpan - 1 };
          }
        }

        columnIndex += colSpan;
      });

      fillCoveredColumns();

      while (outputRow.length < headers.length) outputRow.push("");
      return outputRow.slice(0, headers.length);
    });

    const cells = Array.from(table.querySelectorAll("tbody tr")).map((row) =>
      Array.from(row.querySelectorAll("td")).map((cell) => ({
        text: normalizeCellText(cell.textContent || ""),
        rowSpan: Math.max(1, cell.rowSpan || 1),
        colSpan: Math.max(1, cell.colSpan || 1),
      }))
    );

    return { headers, rows, cells };
  };

  const workloadToCsvRows = (reportEl: HTMLElement) => {
    const rows = Array.from(reportEl.querySelectorAll("[data-workload-row='true']")) as HTMLElement[];
    return [
      ["Faculty", "Assigned Load", "Base Limit", "Overload Allowance", "Status"],
      ...rows.map((row) => [
        row.dataset.facultyName || "",
        row.dataset.assignedLoad || "",
        row.dataset.baseLimit || "",
        row.dataset.overloadAllowance || "",
        row.dataset.status || "",
      ]),
    ];
  };

  const getExportPayload = (): ExportPayload | null => {
    const reportEl = document.getElementById("report-content");
    if (!reportEl) return null;

    const generatedAt = new Date().toLocaleString();

    if (activeTab === "workloads") {
      const workloadRows = workloadToCsvRows(reportEl);
      if (workloadRows.length <= 1) {
        alert("No workload data found to export.");
        return null;
      }
      return {
        title: REPORT_TAB_LABELS[activeTab],
        generatedAt,
        headers: workloadRows[0],
        rows: workloadRows.slice(1),
      };
    }

    const visibleTable = getVisibleTable(reportEl);
    if (!visibleTable) {
      alert("No visible table found to export.");
      return null;
    }

    const { headers, rows, cells } = tableToExportRows(visibleTable);
    return {
      title: REPORT_TAB_LABELS[activeTab],
      generatedAt,
      headers,
      rows,
      cells,
    };
  };

  const getExportHeaders = () => {
    const accessToken = localStorage.getItem("accessToken");
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  };

  const saveBlob = (data: BlobPart, filename: string, type: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const payload = getExportPayload();
    if (!payload) return;

    const response = await axios.post("reports/export/print", payload, {
      responseType: "text",
      headers: getExportHeaders(),
    });

    const w = window.open("", "_blank");
    if (!w) {
      alert("Unable to open print window. Please allow popups for this site.");
      return;
    }
    w.document.write(response.data);
    w.document.close();
    w.focus();
  };

  const exportCsv = async () => {
    const payload = getExportPayload();
    if (!payload) return;

    const response = await axios.post("reports/export/csv", payload, {
      responseType: "blob",
      headers: getExportHeaders(),
    });

    saveBlob(response.data, `${activeTab}-report.csv`, "text/csv;charset=utf-8;");
  };


  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Generate Reports</h1>
            <p className="text-muted-foreground mt-2">View and export faculty loading, schedules, and workloads.</p>
            {lastUpdated && <p className="text-xs text-muted-foreground mt-1">Last updated: {lastUpdated}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">Refresh data</span>
          </button>
          <Button variant="outline" onClick={exportCsv}><FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV</Button>
          <Button variant="outline" onClick={() => exportPdf()}><FileText className="h-4 w-4 mr-2" /> Export PDF</Button>
        </div>
      </header>
      
      {/* KPI Cards */}
      <div className="mb-8">
        {renderKpiCards()}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="inline-flex items-center gap-1 bg-muted p-1 rounded-lg">
          <TabButton id="loading" activeTab={activeTab} setActiveTab={setActiveTab} icon={<FileText size={16} />}>Loading</TabButton>
          <TabButton id="schedules" activeTab={activeTab} setActiveTab={setActiveTab} icon={<Calendar size={16} />}>Schedules</TabButton>
          <TabButton id="workloads" activeTab={activeTab} setActiveTab={setActiveTab} icon={<BarChart3 size={16} />}>Workloads</TabButton>
          <TabButton id="studyload" activeTab={activeTab} setActiveTab={setActiveTab} icon={<BookOpen size={16} />}>Study Load</TabButton>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div id="report-content">
            {activeTab === "loading" && <FacultyLoadingReport key={refreshKey} />}
            {activeTab === "schedules" && <FacultySchedulesView key={refreshKey} />}
            {activeTab === "workloads" && <FacultyWorkloadsView key={refreshKey} />}
            {activeTab === "studyload" && <FacultyStudyLoadView key={refreshKey} />}
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// --- HELPER COMPONENT FOR TABS ---
const TabButton = ({ id, activeTab, setActiveTab, icon, children }: { id: TabId; activeTab: TabId; setActiveTab: (id: TabId) => void; icon: React.ReactNode; children: React.ReactNode; }) => {
  return (
    <Button
      variant={activeTab === id ? "default" : "ghost"}
      onClick={() => setActiveTab(id)}
      className="flex items-center gap-2 px-4 py-2 h-9 text-sm font-semibold transition-all"
    >
      {icon} {children}
    </Button>
  );
};

export default ReportsPage;
