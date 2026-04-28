import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "../../../plugin/axios";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, BarChart3, Users, BookOpen, ClipboardList, Loader2, RefreshCw } from "lucide-react";

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

// --- MAIN REPORTS PAGE COMPONENT ---
function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("loading");
  const [kpiData, setKpiData] = useState<KpiData>({
    totalFaculty: 0,
    assignedSubjects: 0,
    totalUnitsLoaded: 0,
  });
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchKpis = useCallback(async () => {
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
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (response.data.success) {
        setKpiData(response.data.data);
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshKey(k => k + 1);
    await fetchKpis();
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

  // Export: open the report area in a new window and call print (user can save as PDF)
  const exportPdf = () => {
    // Try using html2canvas + jsPDF to capture the CURRENT VISIBLE VIEWPORT (handles page scroll)
    (async () => {
      // Build a styled header that will appear above the table in the PDF
      const headerHtml = `
        <div style="width:100%; padding:12px 16px; margin-bottom:8px; box-sizing:border-box; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px;">
          <h2 style="margin:0; font-size:18px; color:#111827; font-weight:700;">${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report</h2>
          <div style="font-size:12px; color:#374151; margin-top:4px;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      `;

      try {
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default || html2canvasModule;
        const { jsPDF } = await import('jspdf');

        // Target the first VISIBLE table inside report-content if present, otherwise capture the whole report-content
        const reportEl = document.getElementById('report-content');
        let tableEl: HTMLElement | null = null;
        if (reportEl) {
          const tables = Array.from(reportEl.querySelectorAll('table')) as HTMLElement[];
          tableEl = tables.find(t => {
            const rects = t.getClientRects();
            return rects && rects.length > 0 && Array.from(rects).some(r => r.width > 0 && r.height > 0);
          }) || (tables.length ? tables[0] : null);
        }
        const targetEl = tableEl || reportEl || document.body;

        // If we're in the schedules tab and there is a visible table (Room Schedule or Year Level),
        // prefer landscape orientation and a slightly smaller margin so the table appears bigger.
        const isSchedulesTable = activeTab === 'schedules' && !!tableEl;

        // Capture the target element (table preferred) - but render into a temporary wrapper
        // so the header is included and styled consistently for the exported image.
        const wrapper = document.createElement('div');
        wrapper.style.background = '#ffffff';
        wrapper.style.boxSizing = 'border-box';
        wrapper.style.padding = '6px';

        // If schedules table, apply larger base font so text is readable in export
        if (isSchedulesTable) {
          wrapper.style.fontSize = '12px';
        }

        // Insert header (as element) and a clone of the target content
        const headerEl = document.createElement('div');
        headerEl.innerHTML = headerHtml;
        wrapper.appendChild(headerEl);

        const clone = (targetEl as HTMLElement).cloneNode(true) as HTMLElement;

        // For schedules table, increase table cell font-size and padding to make words readable
        if (isSchedulesTable) {
          try {
            const cells = clone.querySelectorAll('th, td') as NodeListOf<HTMLElement>;
            cells.forEach((c) => {
              c.style.fontSize = '12px';
              c.style.padding = '8px 6px';
            });
            const tables = clone.querySelectorAll('table') as NodeListOf<HTMLElement>;
            tables.forEach(t => {
              t.style.fontSize = '12px';
              t.style.borderSpacing = '0';
            });

            // --- FIX & SIZE INCREASE for FacultySchedulesView (Absolute Positioning + Dynamic Height in Table Cells) ---
            // INCREASED: from 64px (h-16) to 96px (h-24) to make the schedule visibly bigger
            const ROW_HEIGHT_PIXELS_EXPORT = 96; 

            // 1. Remove fixed height from all TableRow elements
            const rows = clone.querySelectorAll('tr') as NodeListOf<HTMLElement>;
            rows.forEach(r => {
                r.style.height = 'auto'; // Overwrite h-16
                r.style.minHeight = 'auto';
            });

            // 2. Adjust positioning for the absolutely positioned schedule content & resize
            const tds = clone.querySelectorAll('td') as NodeListOf<HTMLElement>;
            tds.forEach(td => {
                // Ensure no fixed height and reset relative context
                td.style.height = 'auto'; 
                td.style.position = 'static'; 
                td.style.verticalAlign = 'top'; // Align content to the top of the cell

                const contentDiv = td.querySelector('div') as HTMLElement | null;

                if (contentDiv && (contentDiv.style.position === 'absolute' || contentDiv.className.includes('absolute'))) {
                    // This is a STARTING class cell: Un-absolute it to let it push row height
                    contentDiv.style.position = 'static'; 
                    contentDiv.style.top = 'auto'; 
                    contentDiv.style.left = 'auto';
                    contentDiv.style.width = '100%'; 
                    contentDiv.style.boxSizing = 'border-box';
                    
                    // Allow the content div's dynamic height to dictate the cell size
                    td.style.padding = '0'; 
                    
                    // --- Font size increase for bigger print out ---
                    // Note: The original schedule components calculate content height based on ROW_HEIGHT_PIXELS (64)
                    // We must update the contentDiv's style to reflect the new larger unit (96px)
                    const currentHeightStyle = contentDiv.style.height;
                    const match = currentHeightStyle.match(/(\d+)px/);
                    if (match) {
                        const originalHeight = parseInt(match[1], 10);
                        // Assuming originalHeight is based on 64px/slot, recalculate for 96px/slot
                        const slotSpan = Math.round(originalHeight / 64);
                        if (slotSpan > 0) {
                            contentDiv.style.height = `${slotSpan * ROW_HEIGHT_PIXELS_EXPORT}px`;
                        }
                    }

                    const bigText = contentDiv.querySelector('span:first-child') as HTMLElement | null; // Subject/Section
                    if (bigText) {
                        bigText.style.fontSize = '16px'; // from 14px (text-sm) to 16px (text-base)
                        bigText.style.fontWeight = '700';
                    }
                    const smallText = contentDiv.querySelectorAll('span'); // Faculty/Time
                    if (smallText.length > 1) {
                        (smallText[1] as HTMLElement).style.fontSize = '14px'; // from 12px (text-xs) to 14px (text-sm)
                    }
                    if (smallText.length > 2) {
                        (smallText[2] as HTMLElement).style.fontSize = '13px'; // Slightly bigger for context
                    }

                } else if (!td.classList.contains('bg-muted/40')) {
                    // This is an EMPTY or COVERED cell (not the Time Slot header cell)
                    // Enforce the new ROW_HEIGHT_PIXELS_EXPORT height (96px) for alignment.
                    td.style.minHeight = `${ROW_HEIGHT_PIXELS_EXPORT}px`;
                    td.style.height = `${ROW_HEIGHT_PIXELS_EXPORT}px`; // Force height for empty cells
                    td.style.padding = '4px'; 
                }
            });
            // --- END FIX & SIZE INCREASE ---

          } catch (_err) {
            // noop
          }
        }

        wrapper.appendChild(clone);

        // Place off-screen to avoid affecting layout, but allow styles to apply
        wrapper.style.position = 'fixed';
        wrapper.style.left = '-9999px';
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper, { scale: isSchedulesTable ? 3 : 2.5, useCORS: true });
        const imgData = canvas.toDataURL('image/png');

        // Clean up temporary wrapper
        document.body.removeChild(wrapper);

        const pdf = new jsPDF({ orientation: isSchedulesTable ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        // Use a smaller margin for schedules (6mm) to make the table larger, otherwise 10mm
        const mmToPt = (mm: number) => mm * 2.83464567;
        const marginMm = isSchedulesTable ? 6 : 10;
        const marginPt = mmToPt(marginMm);

        const availableW = pageW - marginPt * 2;
        const availableH = pageH - marginPt * 2;

        const imgW = canvas.width;
        const imgH = canvas.height;
        const ratio = Math.min(availableW / imgW, availableH / imgH);
        const drawW = imgW * ratio;
        const drawH = imgH * ratio;

        const x = marginPt + (availableW - drawW) / 2;
        // Align image to top inside the printable area (do not vertically center)
        const y = marginPt;

        pdf.addImage(imgData, 'PNG', x, y, drawW, drawH);
        pdf.save(`${activeTab}-report.pdf`);
        return;
      } catch (e) {
        // If imports fail (packages not installed), fall back to print-window approach
        console.warn('html2canvas/jsPDF not available, falling back to print window. Error:', e);
        const el = document.getElementById('report-content');
        if (!el) { window.print(); return; }
        // Prefer the VISIBLE table HTML if present
        const tables = Array.from(el.querySelectorAll('table')) as HTMLElement[];
        const visibleTable = tables.find(t => {
          const rects = t.getClientRects();
          return rects && rects.length > 0 && Array.from(rects).some(r => r.width > 0 && r.height > 0);
        }) || (tables.length ? tables[0] : null);
        const isSchedulesFallback = activeTab === 'schedules' && !!visibleTable;
        const contentHtml = headerHtml + (visibleTable ? visibleTable.outerHTML : el.innerHTML);
        const w = window.open('', '_blank');
        if (!w) { alert('Unable to open print window (popup blocked).'); return; }
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(n => n.outerHTML).join('\n');
        // Choose landscape and slightly smaller margins for schedules fallback so table fits wider
        const pageCss = isSchedulesFallback
          ? `<style>@page { size: A4 landscape; margin: 6mm; } @media print { body { -webkit-print-color-adjust: exact; padding: 6mm; box-sizing: border-box; font-size:12px; } table { width: 100%; border-collapse: collapse; } table th, table td { padding: 8px 6px; font-size:12px; } thead { display: table-header-group; } tbody { display: table-row-group; } tr { page-break-inside: avoid; } }</style>`
          : `<style>@page { size: A4 portrait; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; padding: 10mm; box-sizing: border-box; } table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } tbody { display: table-row-group; } tr { page-break-inside: avoid; } }</style>`;

        w.document.write(`<html><head><title>Report</title>${pageCss}${styles}</head><body>${contentHtml}</body></html>`);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); w.close(); }, 600);
      }
    })();
  };

  // (Excel export removed as requested)


  return (
    <>
      <header className="mb-8 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">Generate Reports</h1>
            <p className="text-muted-foreground mt-2">View and export faculty loading, schedules, and workloads.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
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