'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { useToast } from "@/app/components/toast-provider";
import { getAuthUser } from "@/app/lib/session";
import { AssignmentRequest } from './types';

interface AssignmentsTabProps {
  requests?: AssignmentRequest[];
  onAssignmentsUpdate?: React.Dispatch<React.SetStateAction<AssignmentRequest[]>>;
}

export default function AssignmentsTab({ requests: initialRequests, onAssignmentsUpdate }: AssignmentsTabProps) {
  const { show: toast } = useToast();
  const [assignPage, setAssignPage] = useState(1);
  const [requests, setRequests] = useState<AssignmentRequest[]>(initialRequests || []);
  const [loading, setLoading] = useState(!initialRequests);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const ASSIGN_PAGE_SIZE = 10;

  // Load assignment details for the assignments tab
  const loadAssignmentDetails = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken') || '';
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "")
      const res = await fetch(`${apiBase}/api/fleet/requests/details`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      
      const data = await res.json();
      console.log("Fetched assignment details:", data);
      
      // Handle different API response structures
      let list: AssignmentRequest[] = [];
      let total = 0;
      let pages = 1;
      
      if (Array.isArray(data)) {
        list = data;
        total = data.length;
        pages = Math.ceil(total / ASSIGN_PAGE_SIZE);
      } else if (data.data && Array.isArray(data.data)) {
        list = data.data;
        total = data.total || data.count || list.length;
        pages = data.totalPages || Math.ceil(total / ASSIGN_PAGE_SIZE);
      } else if (data.items && Array.isArray(data.items)) {
        list = data.items;
        total = data.total || data.count || list.length;
        pages = data.totalPages || Math.ceil(total / ASSIGN_PAGE_SIZE);
      } else {
        list = [];
      }
      
      // Merge newly fetched records into existing requests so we keep
      // historical assignments in this session instead of overwriting them.
      setRequests((prev) => {
        const map = new Map<string | number, AssignmentRequest>();

        (prev || []).forEach((req) => {
          if (req) map.set(req.id, req);
        });

        (list || []).forEach((req) => {
          if (req) map.set(req.id, req);
        });

        return Array.from(map.values());
      });
      
      setTotalItems(total);
      setTotalPages(pages);

      if (onAssignmentsUpdate) {
        onAssignmentsUpdate((prev) => {
          const map = new Map<string | number, AssignmentRequest>();

          (prev || []).forEach((req) => {
            if (req) map.set(req.id, req);
          });

          list.forEach((req) => {
            if (req) map.set(req.id, req);
          });

          return Array.from(map.values());
        });
      }
    } catch (err) {
      console.error('Error fetching assignment details:', err);
      toast({
        title: 'Error',
        description: 'Failed to load assignment details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter requests that have vehicles assigned (history of assignments)
  const assignedRequests = requests.filter(request => 
    request.vehicles && 
    request.vehicles.length > 0
  );

  // Flatten so each row represents a single assigned vehicle for a request
  const vehicleRows = assignedRequests.flatMap(request =>
    (request.vehicles || []).map(vehicle => ({ request, vehicle }))
  );

  // Pagination over assigned vehicles
  const totalAssigned = vehicleRows.length;
  const totalPagesForVehicles = Math.max(1, Math.ceil(totalAssigned / ASSIGN_PAGE_SIZE));
  const pageItems = vehicleRows.slice(
    (assignPage - 1) * ASSIGN_PAGE_SIZE,
    (assignPage - 1) * ASSIGN_PAGE_SIZE + ASSIGN_PAGE_SIZE
  );

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setAssignPage(newPage);
    if (!initialRequests) {
      loadAssignmentDetails(newPage);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
  };

  // Format time (HH:mm) for display
  const formatTime = (value: string | Date | null | undefined) => {
    if (!value) return '-';

    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else {
      // value may be ISO string or locale string
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        date = parsed;
      } else {
        // Fallback: try HH:mm or HH:mm:ss string
        const [hh, mm] = value.split(':');
        if (!hh || !mm) return value;
        return `${hh}:${mm}`;
      }
    }

    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Get real trip duration: from request startTime to vehicle completion time
  const getDurationHours = (request: AssignmentRequest, vehicleOverride?: any) => {
    const { fromDate, date, startTime } = request;

    // Need a start time from the request
    if (!startTime) return '-';

    const baseStartDate = fromDate || date;
    if (!baseStartDate) return '-';

    const makeDateTimeFromParts = (d: string, t: string) => {
      // d as YYYY-MM-DD (or ISO date), t as HH:mm
      return new Date(`${d}T${t}:00`);
    };

    const start = makeDateTimeFromParts(baseStartDate, startTime);
    if (isNaN(start.getTime())) return '-';

    // Get actual completion time from the specific vehicle (row) or first vehicle
    const v: any = vehicleOverride || (request.vehicles && request.vehicles[0]);
    const completionRaw = v.completedAt ?? v.endTime ?? v.managerNotifiedAt ?? null;
    if (!completionRaw) return '-';

    const end = new Date(completionRaw as any);
    if (isNaN(end.getTime())) return '-';

    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) return '-';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const remainderAfterDays = totalMinutes - days * 60 * 24;
    const hours = Math.floor(remainderAfterDays / 60);
    const minutes = remainderAfterDays % 60;

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days} ቀን`);
    }
    if (hours > 0) {
      parts.push(`${hours} ሰዓት`);
    }
    if (minutes > 0) {
      parts.push(`${minutes} ደቂቃ`);
    }

    if (parts.length === 0) {
      return '0 ደቂቃ';
    }

    return parts.join(' ');
  };

  // Get assigned vehicle info
  const getVehicleInfo = (request: AssignmentRequest, vehicleOverride?: any) => {
    const v = vehicleOverride || (request.vehicles && request.vehicles[0]);
    if (!v) {
      return { vehicleLabel: '-', plate: '-' };
    }
    const vehicle = v;
    const vehicleLabel = `${vehicle.make || ''} ${vehicle.model || ''}`.trim();

    return {
      vehicleLabel: vehicleLabel || '-',
      plate: vehicle.plate || '-'
    };
  };

  // Get driver info
  const getDriverInfo = (request: AssignmentRequest, vehicleOverride?: any) => {
    const vehicle = vehicleOverride || (request.vehicles && request.vehicles[0]);
    const assignedDriver = (vehicle as any)?.driver;

    if (assignedDriver) {
      const name = `${assignedDriver.firstName || ''} ${assignedDriver.lastName || ''}`.trim();
      return {
        driverName: name || '-',
        driverPhone: assignedDriver.phone || '-',
      };
    }

    // Fallback: show requester phone if no assigned driver info is available
    return {
      driverName: '-',
      driverPhone: request.requestor.phone || '-',
    };
  };

  // Get completion date+time label.
  // Priority:
  // 1) Use the same `returnTime` recorded by the driver (like the driver Completed Trips report),
  //    combined with the request date.
  // 2) Fallback to vehicle-level timestamps (managerNotifiedAt/completedAt/endTime).
  const getCompletionDateTimeLabel = (request: AssignmentRequest, vehicleOverride?: any) => {
    // 1) Prefer the driver-recorded returnTime on the request itself.
    if (request.returnTime) {
      const baseDateStr = request.date || request.fromDate || request.toDate;
      if (baseDateStr) {
        const baseDate = new Date(baseDateStr as any);
        if (!isNaN(baseDate.getTime())) {
          const isoDatePart = baseDate.toISOString().slice(0, 10); // YYYY-MM-DD
          const timePart = request.returnTime.length === 5
            ? `${request.returnTime}:00`
            : request.returnTime;

          const combined = new Date(`${isoDatePart}T${timePart}`);
          if (!isNaN(combined.getTime())) {
            // Match driver report style: "DD/MM/YYYY, HH:mm:ss" (24-hour with seconds)
            return combined.toLocaleString('en-GB', {
              hour12: false,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
          }
        }
      }
    }

    // 2) Fallback: use vehicle timestamps if present (older data or if returnTime is missing).
    const v = (vehicleOverride as any) || (request.vehicles && (request.vehicles[0] as any));
    if (!v) return '-';

    const completion = v.managerNotifiedAt ?? v.completedAt ?? v.endTime ?? null;
    if (!completion) return '-';

    const d = new Date(completion as any);
    if (isNaN(d.getTime())) return '-';

    // Match the driver Completed Trips table format: "DD/MM/YYYY, HH:mm:ss" (24-hour with seconds)
    return d.toLocaleString('en-GB', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const buildAssignmentsReport = () => {
    const headers = [
      '№',
      'መኪና የጠየቀዉ አካለ',
      'ስልክ',
      'የስራ ክፍል',
      'መድረሻ',
      'የተጠየቀበት ቀን',
      'መስኩ የተጠናቀቀበት ቀን እና ሰዓት',
      'የግዜ ቆይታ',
      'ያፀደቀዉ የቅርብ ሃላፊ',
      'ያፀደቀዉ የስምሪት ሃላፊ',
      'የፀደቀበት ቀን',
      'የተመደበዉ ሹፌር',
      'የተመደበዉ መኪና',
      'የመኪና ታርጋ ቁጥር',
      'ሁኔታ',
    ];

    const rows = pageItems.map(({ request, vehicle }, index) => {
      const { driverName, driverPhone } = getDriverInfo(request, vehicle);
      const { vehicleLabel, plate } = getVehicleInfo(request, vehicle);
      const requesterName = `${request.requestor.firstName || ''} ${request.requestor.lastName || ''}`.trim();

      const v: any = vehicle;
      const hasCompletionInfo = !!(v?.completedAt || v?.endTime || v?.managerNotifiedAt);

      const statusLabel = hasCompletionInfo
        ? 'completed assignment'
        : request.status === 'COMPLETED'
        ? 'completed assignment'
        : 'inprogress';

      const completionLabel = getCompletionDateTimeLabel(request, vehicle);
      const durationLabel = getDurationHours(request, vehicle);

      return [
        String(index + 1),
        requesterName,
        driverPhone,
        request.department.name,
        request.destination,
        formatDate(request.date),
        completionLabel,
        String(durationLabel),
        `${request.department.name} ሃላፊ`,
        'ንጉሴ አብረሃም',
        formatDate(request.createdAt),
        driverName,
        vehicleLabel,
        plate,
        statusLabel,
      ];
    });

    return { headers, rows };
  };

  const handleExportExcel = () => {
    if (typeof window === 'undefined') return;
    const { headers, rows } = buildAssignmentsReport();
    const lines: string[] = [];
    lines.push('የመኪና መመደቢያ መዝገብ');
    lines.push('');
    lines.push(headers.join(','));
    rows.forEach((row) => {
      lines.push(row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fleet_assignments.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    if (typeof window === 'undefined') return;
    const { headers, rows } = buildAssignmentsReport();
    const reportDate = new Date().toLocaleString();

    const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
    const bodyRows = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('');

    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>የመኪና መመደቢያ መዝገብ</title>
        <style>
          body { font-family: Arial, sans-serif; }
          h1, h2 { margin-bottom: 4px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>የመኪና መመደቢያ መዝገብ</h1>
        <p>Generated at: ${reportDate}</p>

        <table>
          <tr>${headerRow}</tr>
          ${bodyRows}
        </table>
      </body>
      </html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'fleet_assignments.doc');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value: any) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Download a Word (.doc) travel permit form for a single assigned vehicle row
  const downloadPermitDoc = async (request: AssignmentRequest, vehicle: any) => {
    if (typeof window === 'undefined') return;

    // Embed the FCSC logo as base64 so the .doc is self-contained
    let logoDataUri = '';
    try {
      const logoRes = await fetch('/gallery/FCSC.jpg');
      const logoBlob = await logoRes.blob();
      logoDataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(logoBlob);
      });
    } catch {
      logoDataUri = '';
    }

    // Fetch the assigned driver's completed trip history (same TripHistory
    // source that powers the driver "የመስክ ታሪክ (Completed Trips)" table)
    const driverId =
      (vehicle as any)?.driver?.id ||
      (vehicle as any)?.driverId ||
      (vehicle as any)?.userId ||
      null;

    let tripHistory: any[] = [];
    if (driverId) {
      try {
        const token = localStorage.getItem('accessToken') || '';
        const apiBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
        const histRes = await fetch(`${apiBase}/api/fleet/trip-history/manager/all`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const histJson = await histRes.json().catch(() => ({}));
        const items: any[] = Array.isArray(histJson?.data)
          ? histJson.data
          : Array.isArray(histJson)
            ? histJson
            : [];
        tripHistory = items
          .filter((h: any) => h.driverId === driverId)
          .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
          .slice(0, 8);
      } catch {
        tripHistory = [];
      }
    }

    const { driverName, driverPhone } = getDriverInfo(request, vehicle);
    const { plate } = getVehicleInfo(request, vehicle);
    const requesterName = `${request.requestor.firstName || ''} ${request.requestor.middleName ? request.requestor.middleName + ' ' : ''}${request.requestor.lastName || ''}`.trim();

    const authUser = getAuthUser();
    const managerName = `${authUser?.firstName || ''} ${authUser?.lastName || ''}`.trim();

    const fromLabel = request.fromDate ? formatDate(request.fromDate) : formatDate(request.date);
    const toLabel = request.toDate ? formatDate(request.toDate) : fromLabel;
    const tripDateLabel = request.fromDate ? formatDate(request.fromDate) : formatDate(request.date);

    const u = (value: string, width = 200) => {
      const hasValue = !!String(value ?? '').trim();
      return `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${width}px;padding:0 4px;${hasValue ? 'font-weight:bold;' : ''}">${escapeHtml(value) || '&nbsp;'}</span>`;
    };

    const fmtDocDate = (v: any) => {
      if (!v) return '-';
      const d = new Date(v);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
    };
    const fmtDocTime = (v: any) => {
      if (!v) return '-';
      const s = String(v);
      return s.length >= 5 ? s.slice(0, 5) : s;
    };
    const cell = 'border:1px solid #000;padding:3px 4px;';
    const th = `${cell}background:#d9d9d9;text-align:center;`;
    const td = `${cell}font-size:8pt;`;

    const tripRowsHtml = tripHistory.length
      ? tripHistory
          .map((h: any) => {
            const retTime = h.returnTime || h.endTime || '';
            return `<tr>
              <td style="${td}">${fmtDocDate(h.date)}</td>
              <td style="${td}">${escapeHtml(h.destination || '')}</td>
              <td style="${td}text-align:right;">${h.startOdometerKm ?? '-'}</td>
              <td style="${td}">${fmtDocTime(h.startTime)}</td>
              <td style="${td}text-align:right;">${h.returnOdometerKm ?? '-'}</td>
              <td style="${td}">${fmtDocTime(retTime)}</td>
              <td style="${td}text-align:right;">${h.odometerKmDiff ?? '-'}</td>
              <td style="${td}"></td>
              <td style="${td}"></td>
              <td style="${td}text-align:right;">${h.passengerCount ?? '-'}</td>
              <td style="${td}text-align:right;">${h.kmPerLiter ?? '-'}</td>
              <td style="${td}">${escapeHtml(managerName)}</td>
            </tr>`;
          })
          .join('')
      : `<tr><td colspan="12" style="${td}text-align:center;">ምንም የተጠናቀቀ መስክ ጉዞዎች አልተገኙም</td></tr>`;

    const tripHistoryTable = `<p class="lbl" style="margin-top:10px;">የመስክ ታሪክ (Completed Trips)</p>
<table style="border-collapse:collapse;width:100%;table-layout:fixed;font-size:8pt;margin:4px 0 8px 0;">
  <tr>
    <th rowspan="2" style="${th}width:9%;">ቀን</th>
    <th colspan="3" style="${th}width:27%;">የተነሳበት</th>
    <th colspan="2" style="${th}width:14%;">የተመለሰበት</th>
    <th rowspan="2" style="${th}width:7%;">የኪ.ሜ ልዩነት</th>
    <th colspan="2" style="${th}width:16%;">የጫነው ዕቃ</th>
    <th rowspan="2" style="${th}width:7%;">የጫነው ሰው ብዛት</th>
    <th rowspan="2" style="${th}width:10%;">ተሽከርካሪዉ በሊትር የሚሸፍነዉ ኪ.ሜ</th>
    <th rowspan="2" style="${th}width:9%;">የተቆጣጣሪው ፊሪማ</th>
  </tr>
  <tr>
    <th style="${th}width:13%;">ስፍራ</th>
    <th style="${th}width:7%;">ኪ.ሜ</th>
    <th style="${th}width:7%;">ሰዓት</th>
    <th style="${th}width:7%;">ኪ.ሜ</th>
    <th style="${th}width:7%;">ሰዓት</th>
    <th style="${th}width:8%;">የዕቃው ዓይነት</th>
    <th style="${th}width:8%;">የዕቃው ክብደት</th>
  </tr>
  ${tripRowsHtml}
</table>`;

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="UTF-8">
<title>የመንግስት ተሽከርካሪ አገልግሎት መጠየቂያና የመዘዋወሪያ ፈቃድ መስጫ</title>
<style>
  body { font-family: "Ebrima", "Nyala", "Times New Roman", Arial, serif; font-size: 11pt; }
  .title { font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 14px; }
  p { margin: 6px 0; }
  .lbl { font-weight: bold; }
  .log { font-size: 9pt; }
  .log th { border-bottom: 1px solid #000; padding: 2px 4px; text-align: left; }
  .log td { padding: 2px 4px; }
</style>
</head>
<body>

${logoDataUri ? `<p style="text-align:center;margin-bottom:6px;"><img src="${logoDataUri}" alt="FCSC" style="height:35px;" /></p>` : ''}

<p class="title">የመንግስት ተሽከርካሪ አገልግሎት መጠየቂያና የመዘዋወሪያ ፈቃድ መስጫ</p>

<p>የመሥራ በ/ቱ ስም&nbsp;&nbsp;&nbsp;&nbsp;<b style="border-bottom:1px solid #000;">ሲቪል ሰርቪስ ኮሚሽን</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;የሰሌዳ ቁጥር&nbsp;${u(plate, 160)}</p>

<p>የተጔዥዎቹ&nbsp;&nbsp;ስም ሀ&nbsp;${u(driverName, 200)}&nbsp;&nbsp;ለ&nbsp;${u('', 200)}&nbsp;&nbsp;ሐ&nbsp;${u('', 200)}&nbsp;&nbsp;መ&nbsp;${u('', 200)}</p>

<p>የሚሄዱበት ስፍራ&nbsp;${u(request.destination, 620)}</p>

<p>ምክንያት&nbsp;${u(request.purpose, 620)}</p>

<p>አገልግሎቱን የሚፈልግበት ጊዜ&nbsp;${u(fromLabel, 140)}&nbsp;<span class="lbl">እስከ</span>&nbsp;${u(toLabel, 140)}</p>

<p>የጠያቂው ስምና ፊሪማ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${u(requesterName, 200)}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;የጠያቂው ሃላፊ ስምና ፊሪማ&nbsp;&nbsp;${u(`${request.department.name} ሃላፊ`, 200)}&nbsp;&nbsp;&nbsp;&nbsp;የፈቀደው ሃላፊ ስምና ፊሪማ&nbsp;&nbsp;${u('ንጉሴ አብረሃም', 200)}</p>

<br>

${tripHistoryTable}

<br>

<p>ከሂህ በ&nbsp;${u('', 160)}&nbsp;የተሰጠውን ትዕዛዝ በትክክል መፈጸሜን አረጋግጣለሁ</p>

<p>የሾፌሩ ስም&nbsp;${u(driverName, 300)}&nbsp;&nbsp;&nbsp;&nbsp;<span class="lbl">ፊሪማ</span>&nbsp;${u('', 140)}&nbsp;&nbsp;&nbsp;&nbsp;<span class="lbl">ቀን</span>&nbsp;${u(tripDateLabel, 140)}</p>

<br>

<p><b>1.</b> ይህ ቅጽ በአንድ ቅጅ ከተሰራ በኋላ ከተሽከርካሪው ጋር እንዲዘዋወር ለሾፌሩ ይሰጥና አገልግሎት ሲያበቃ ለሚመለከተው ተቆጣጣሪ ስራ ክፍል ያሰረክባል፡፤<br>
<b>2.</b> ይህ ቅጽ ከሥራ ሰዓት ወጭ እና በበዓላት ቃናት ለሚሰት አገልግሎት በተጨማሪነት ያገለግላል፡፡<br>
<b>3.</b> ይህንን በተመለከተ የመሥራያ ቤ/ቱ የሚመለከተው ተቆጣጣሪ ሥራ ክፍል ሃላፊነት አለበት</p>

</body>
</html>`;

    const blob = new Blob(['﻿' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safePlate = String(plate || 'vehicle').replace(/[^a-zA-Z0-9_-]/g, '_');
    link.setAttribute('download', `travel_permit_${safePlate}_${tripDateLabel.replace(/\//g, '-')}.doc`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    if (typeof window === 'undefined') return;
    const { headers, rows } = buildAssignmentsReport();
    const reportDate = new Date().toLocaleString();

    const headerRow = headers.map((h) => `<th>${h}</th>`).join('');
    const bodyRows = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
      .join('');

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <title>የመኪና መመደቢያ መዝገብ</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 16px; }
          h1, h2 { margin-bottom: 4px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>የመኪና መመደቢያ መዝገብ</h1>
        <p>Generated at: ${reportDate}</p>

        <table>
          <tr>${headerRow}</tr>
          ${bodyRows}
        </table>
      </body>
      </html>`);

    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    if (!initialRequests) {
      loadAssignmentDetails(assignPage);
    }
  }, [assignPage, initialRequests]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">የመኪና መመደቢያ መዝገብ</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-lg">Loading assignment data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (totalAssigned === 0) {
    return (
      <div className="bg-white rounded-lg shadow border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">የመኪና መመደቢያ መዝገብ</h3>
          <button
            onClick={() => loadAssignmentDetails(1)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Refresh Data
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">የተመደበ መኪና መዝገብ የለም</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">የመኪና መመደቢያ መዝገብ</h3>
        <div className="flex gap-2 items-center">
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
            ጠቅላላ የተመደቡ መኪኖች: {totalAssigned}
          </div>
          <button
            onClick={() => loadAssignmentDetails(assignPage)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Refresh Data
          </button>
          <select
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'word') handleExportWord();
              if (value === 'pdf') handleExportPdf();
              if (value === 'excel') handleExportExcel();
              e.target.value = '';
            }}
            defaultValue=""
            className="px-3 py-2 border border-gray-300 rounded-md text-xs md:text-sm bg-white"
          >
            <option value="" disabled>
              የሪፖርት አይነት ይምረጡ
            </option>
            <option value="word">Word</option>
            <option value="pdf">PDF</option>
            <option value="excel">Excel</option>
          </select>
        </div>
      </div>
      <div className="p-6 overflow-x-auto">
        <table className="min-w-full border text-xs md:text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2 py-2 text-center">№</th>
              <th className="border px-2 py-2">መኪና የጠየቀዉ አካለ</th>
              <th className="border px-2 py-2">ስልክ:</th>
              <th className="border px-2 py-2">የስራ ክፍል</th>
              <th className="border px-2 py-2">መድረሻ</th>
              <th className="border px-2 py-2">የተጠየቀበት ቀን</th>
              <th className="border px-2 py-2">መስኩ የተጠናቀቀበት ቀን እና ሰዓት</th>
              <th className="border px-2 py-2">የግዜ ቆይታ</th>
              <th className="border px-2 py-2">ያፀደቀዉ የቅርብ ሃላፊ</th>
              <th className="border px-2 py-2">ያፀደቀዉ የስምሪት ሃላፊ</th>
              <th className="border px-2 py-2">የፀደቀበት ቀን</th>
              <th className="border px-2 py-2">የተመደበዉ ሹፌር</th>
              <th className="border px-2 py-2">የተመደበዉ መኪና</th>
              <th className="border px-2 py-2">የመኪና ታርጋ ቁጥር</th>
              <th className="border px-2 py-2">ሁኔታ</th>
              <th className="border px-2 py-2 text-center">ፈቃድ</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(({ request, vehicle }, index) => {
              const { driverName, driverPhone } = getDriverInfo(request, vehicle);
              const { vehicleLabel, plate } = getVehicleInfo(request, vehicle);
              const requesterName = `${request.requestor.firstName || ''} ${request.requestor.lastName || ''}`.trim();

              const v: any = vehicle;
              const hasCompletionInfo = !!(v?.completedAt || v?.endTime || v?.managerNotifiedAt);

              const statusLabel = hasCompletionInfo
                ? 'completed assignment'
                : request.status === 'COMPLETED'
                ? 'completed assignment'
                : 'inprogress';

              return (
                <tr key={`${request.id}-${vehicle.id}`} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border px-2 py-2 text-center align-top">{index + 1}</td>
                  <td className="border px-2 py-2 align-top">{requesterName}</td>
                  <td className="border px-2 py-2 align-top">{driverPhone}</td>
                  <td className="border px-2 py-2 align-top">{request.department.name}</td>
                  <td className="border px-2 py-2 align-top">{request.destination}</td>
                  <td className="border px-2 py-2 align-top">{formatDate(request.date)}</td>
                  <td className="border px-2 py-2 align-top">{getCompletionDateTimeLabel(request, vehicle)}</td>
                  <td className="border px-2 py-2 align-top">{getDurationHours(request, vehicle)}</td>
                  <td className="border px-2 py-2 align-top">
                    {/* Department Head - you'll need to get this from your data */}
                    {request.department.name} ሃላፊ
                  </td>
                  <td className="border px-2 py-2 align-top">ንጉሴ አብረሃም</td>
                  <td className="border px-2 py-2 align-top">{formatDate(request.createdAt)}</td>
                  <td className="border px-2 py-2 align-top">{driverName}</td>
                  <td className="border px-2 py-2 align-top">{vehicleLabel}</td>
                  <td className="border px-2 py-2 align-top">{plate}</td>
                  <td className="border px-2 py-2 align-top">{statusLabel}</td>
                  <td className="border px-2 py-2 align-top text-center">
                    <button
                      type="button"
                      onClick={() => downloadPermitDoc(request, vehicle)}
                      title="የመዘዋወሪያ ፈቃድ ወረቀት አውርድ"
                      className="inline-flex items-center gap-1 rounded-md bg-[#135a98] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#0f4e84] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                      አውርድ
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between text-xs md:text-sm">
          <div>
            ከ{' '}
            {totalAssigned === 0 ? 0 : (assignPage - 1) * ASSIGN_PAGE_SIZE + 1}{' '}
            እስከ{' '}
            {Math.min(assignPage * ASSIGN_PAGE_SIZE, totalAssigned)}{' '}
            ድረስ ከ ጠቅላላ {totalAssigned} የተመደቡ መኪኖች
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => assignPage > 1 && handlePageChange(assignPage - 1)}
              disabled={assignPage <= 1}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              የቀድሞ
            </button>
            <span>
              ገፅ {assignPage} / {totalPagesForVehicles}
            </span>
            <button
              type="button"
              onClick={() => assignPage < totalPagesForVehicles && handlePageChange(assignPage + 1)}
              disabled={assignPage >= totalPagesForVehicles}
              className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ቀጣይ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}