'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/app/components/toast-provider";
import { Driver } from './types';

interface DriversTabProps {
  drivers: Driver[];
  onDriversUpdate: (drivers: Driver[]) => void;
}

export default function DriversTab({ drivers, onDriversUpdate }: DriversTabProps) {
  const router = useRouter();
  const { show: toast } = useToast();
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [driverDocs, setDriverDocs] = useState<Array<{ id: string; name: string; docType: string; uploadedAt: string; url?: string }>>([]);
  const [uploadingType, setUploadingType] = useState<string>('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Initialize filters from URL (?status=unassigned etc.)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const s = (sp.get('status') || '').toLowerCase();
      if (s === 'unassigned' || s === 'assigned') setStatusFilter(s);
      const q = sp.get('q') || sp.get('search') || '';
      if (q) setSearch(q);
    } catch {}
  }, []);

  const isDriverAssigned = (d: Driver) => Boolean(d.assignedVehicle);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((d) => {
      if (statusFilter === 'assigned' && !isDriverAssigned(d)) return false;
      if (statusFilter === 'unassigned' && isDriverAssigned(d)) return false;
      if (search) {
        const hay = `${d.firstName} ${d.lastName} ${d.email} ${d.phone} ${d.role}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [drivers, statusFilter, search]);

  const loadDrivers = async () => {
    try {
      setDriversLoading(true);
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/driver`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data = await res.json();
      const driversData = data.data || data.items || data.drivers || data || [];
      onDriversUpdate(driversData);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      toast({
        title: 'Error',
        description: 'Failed to load drivers.',
        variant: 'destructive',
      });
    } finally {
      setDriversLoading(false);
    }
  };

  const getDriverStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getDocTypeColor = (docType: string) => {
    switch (docType) {
      case 'educational_paper':
        return 'bg-blue-100 text-blue-800';
      case 'license_certificate':
        return 'bg-green-100 text-green-800';
      case 'agreement_paper':
        return 'bg-orange-100 text-orange-800';
      case 'other_documents':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const loadDriverDocs = async (driverId: string) => {
    try {
      if (!driverId) return;
      const res = await fetch(`/api/fleet/drivers/${encodeURIComponent(driverId)}/documents`);
      const data = await res.json();
      setDriverDocs(Array.isArray(data.items) ? data.items : []);
    } catch {
      setDriverDocs([]);
    }
  };

  const uploadDriverDoc = async (driverId: string, docType: string, file: File) => {
    if (!driverId) return alert('Select a driver first');
    try {
      setUploadingType(docType);
      const fd = new FormData();
      fd.append('docType', docType);
      fd.append('file', file);
      const res = await fetch(`/api/fleet/drivers/${encodeURIComponent(driverId)}/documents`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      await loadDriverDocs(driverId);
    } catch (e: any) {
      alert(e?.message || 'Upload failed');
    } finally {
      setUploadingType('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">የሹፌሮች አስተዳደሪያ</h2>
          <p className="mt-1 text-sm text-slate-500">የሹፌሮች መገለጫ እና ሰነዶችን ያስተዳድሩ</p>
        </div>
        <button
          onClick={loadDrivers}
          disabled={driversLoading}
          className="inline-flex items-center gap-2 rounded-lg bg-[#135a98] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f4e84] disabled:opacity-60"
        >
          <svg className={`h-4 w-4 ${driversLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {driversLoading ? 'በማደስ ላይ...' : 'አድስ'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="በስም፣ ኢሜይል ወይም ስልክ ይፈልጉ…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">ሁሉም ሹፌሮች</option>
          <option value="assigned">ተመድበዋል</option>
          <option value="unassigned">ያልተመደቡ</option>
        </select>
        <div className="whitespace-nowrap text-sm text-slate-500">
          {filteredDrivers.length} / {drivers.length} ሹፌሮች
        </div>
      </div>

      {/* Drivers Grid */}
      {filteredDrivers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">ምንም ሹፌር አልተገኘም</h3>
          <p className="mt-1 text-sm text-slate-400">
            {drivers.length === 0
              ? 'ሹፌሮችን ለመመዝገብ ይጀምሩ።'
              : 'ከሚፈለጉት ማጣሪያዎች ጋር የሚዛመድ ሹፌር የለም።'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDrivers.map(driver => (
            <div
              key={driver.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/fleet/drivers/register?driverId=${encodeURIComponent(driver.id)}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(`/fleet/drivers/register?driverId=${encodeURIComponent(driver.id)}`);
                }
              }}
              className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#135a98] text-lg font-bold text-white">
                  {driver.firstName?.[0]}{driver.lastName?.[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-slate-900">
                    {driver.firstName} {driver.lastName}
                  </h3>
                  <p className="truncate text-sm text-slate-500">{driver.role || 'ሹፌር'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getDriverStatusColor(driver.isActive ? 'active' : 'inactive')}`}>
                  {driver.isActive ? 'ንቁ' : 'ጊዜያዊ ያልሆነ'}
                </span>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ስልክ</span>
                  <span className="font-medium text-slate-900">{driver.phone || 'አልተሰጠም'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ኢሜይል</span>
                  <span className="max-w-[55%] truncate font-medium text-slate-900" title={driver.email}>
                    {driver.email}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">መመዝገቢያ ቀን</span>
                  <span className="font-medium text-slate-900">
                    {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString() : 'ያልታወቀ'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">የመኪና ምደባ</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${driver.assignedVehicle ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                    {driver.assignedVehicle ? 'ተመድቧል' : 'ያልተመደበ'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  onClick={(e) => { e.stopPropagation() }}
                  className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  አርትዕ
                </button>
                <button
                  onClick={(e) => { e.stopPropagation() }}
                  className="flex-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  አስወግድ
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDriverId(driver.id);
                    loadDriverDocs(driver.id);
                    setTimeout(() => {
                      document.getElementById('driver-docs-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 50);
                  }}
                  className="flex-1 rounded-lg bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                >
                  ሰነዶች
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Panel */}
      <div id="driver-docs-panel" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">የሹፌር ሰነዶች</h3>
            <p className="text-xs text-slate-500">
              {!selectedDriverId
                ? "ሹፌር ይምረጡ እና 'ሰነዶች' የሚለውን ይጫኑ"
                : `ለተመረጠው ሹ፜ር ሰነዶችን በማስተዳደር ላይ: ${selectedDriverId.slice(0, 8)}...`
              }
            </p>
          </div>
        </div>

        {selectedDriverId && (
          <div className="p-6">
            <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Educational Paper */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">የትምህርት ማስረጃ</h4>
                    <p className="text-xs text-slate-500">የትምህርት ደረጃዎች</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadingType === 'educational_paper'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDriverDoc(selectedDriverId, 'educational_paper', f);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              {/* License Certificate */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">የፍቃድ ምስክር ወረቀት</h4>
                    <p className="text-xs text-slate-500">የመንጃ ፍቃድ ሰነዶች</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadingType === 'license_certificate'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDriverDoc(selectedDriverId, 'license_certificate', f);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              {/* Other Documents */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">ሌሎች ሰነዶች</h4>
                    <p className="text-xs text-slate-500">ተጨማሪ የሚደግፉ ፋይሎች</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadingType === 'other_documents'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDriverDoc(selectedDriverId, 'other_documents', f);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-purple-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-purple-700 hover:file:bg-purple-100"
                />
              </div>

              {/* Agreement Paper */}
              <div className="rounded-xl border border-slate-200 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900">የስምምነት ሰነድ</h4>
                    <p className="text-xs text-slate-500">የውል እና ስምምነት ፋይሎች</p>
                  </div>
                </div>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  disabled={uploadingType === 'agreement_paper'}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDriverDoc(selectedDriverId, 'agreement_paper', f);
                    e.currentTarget.value = '';
                  }}
                  className="w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-amber-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-amber-700 hover:file:bg-amber-100"
                />
              </div>
            </div>

            {/* Uploaded Documents */}
            <div className="rounded-xl border border-slate-200 p-5">
              <h4 className="mb-4 text-base font-bold text-slate-900">የተሰቀሉ ሰነዶች</h4>
              {driverDocs.length === 0 ? (
                <div className="py-8 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm text-slate-400">እስካሁን ምንም ሰነድ አልተሰቀለም።</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {driverDocs.map(doc => (
                    <div key={doc.id} className="rounded-lg border border-slate-200 p-4 transition hover:shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${getDocTypeColor(doc.docType)}`}>
                          {doc.docType.replace('_', ' ')}
                        </span>
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 transition-colors hover:text-blue-800"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                      <div className="truncate text-sm font-medium text-slate-900" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'ያልታወቀ ቀን'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}