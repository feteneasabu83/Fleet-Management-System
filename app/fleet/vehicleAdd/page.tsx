"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  X,
  Save,
  Loader2,
  Calendar,
  Hash,
  CarFront,
  BadgeInfo,
  Tags,
} from "lucide-react";

const FUEL_TYPES: Array<{ value: string; label: string }> = [
  { value: 'Gasoline / Petrol', label: 'ቤንዚን' },
  { value: 'Diesel', label: 'ዲዜል' },
  { value: 'Hybrid', label: 'ሃይብሪድ' },
  { value: 'Plug-in Hybrid (PHEV)', label: 'ፕላግ-ኢን ሃይብሪድ' },
  { value: 'Electric (EV)', label: 'ኤሌክትሪክ' },
  { value: 'LPG', label: 'ኤልፒጂ' },
  { value: 'CNG', label: 'ሲኤንጂ' },
  { value: 'Hydrogen (FCEV)', label: 'ሃይድሮጅን' },
  { value: 'Biofuel', label: 'ባዮፊውኤል' },
  { value: 'Kerosene', label: 'ኬሮሲን' },
  { value: 'Other', label: 'ሌላ' },
];

const VEHICLE_TYPES: Array<{ value: string; label: string }> = [
  { value: 'Sedan', label: 'ሴዳን' },
  { value: 'SUV', label: 'ኤስዩቪ' },
  { value: 'Pickup Truck', label: 'ፒካፕ ትሩክ' },
  { value: 'Truck / Lorry', label: 'ትሩክ / ሎሪ' },
  { value: 'Van / Minibus', label: 'ቫን / ሚኒባስ' },
  { value: 'Bus', label: 'ባስ' },
  { value: 'Motorcycle', label: 'ሞተር ሳይክል' },
  { value: 'Bicycle', label: 'ሳይክል' },
  { value: 'Tractor', label: 'ትራክተር' },
  { value: 'Ambulance', label: 'አምቡላንስ' },
  { value: 'Fire Truck', label: 'የእሳት አበሳ መኪና' },
  { value: 'Police Vehicle', label: 'የፖሊስ መኪና' },
  { value: 'Other', label: 'ሌላ' },
];

export default function VehicleAddSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [drivers, setDrivers] = useState<Array<{ id: string; firstName?: string; lastName?: string; email?: string }>>([]);
  const [form, setForm] = useState({
    plate: "",
    make: "",
    model: "",
    year: "",
    type: "NEW",
    countryOfOrigin: "",
    seatingCapacity: "",
    kmPerLiter: "",
    vehicleTypeName: "",
    chassisNumber: "",
    engineNumber: "",
    fuelType: "",
    cylinderCount: "",
    userId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Load drivers for optional assignment
  useEffect(() => {
    const loadDrivers = async () => {
      try {
        const token =
          localStorage.getItem("accessToken") ||
          localStorage.getItem("jwt") ||
          localStorage.getItem("token") ||
          "";
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/fleet/driver`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        const arr = data.data || data.items || data.drivers || data || [];
        setDrivers(Array.isArray(arr) ? arr : []);
      } catch {}
    };
    loadDrivers();
  }, []);

  // Initialize edit mode from URL query params and prefill form
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const mode = (params.get("mode") || "").toLowerCase();
    const id = params.get("vehicleId");

    if (mode === "edit" && id) {
      setIsEditMode(true);
      setVehicleId(id);

      const loadVehicle = async () => {
        try {
          setLoading(true);
          setError("");

          const token =
            localStorage.getItem("accessToken") ||
            localStorage.getItem("jwt") ||
            localStorage.getItem("token") ||
            "";

          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/fleet/vehicles/${encodeURIComponent(id)}`,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || "Failed to load vehicle");
          }

          const data = await res.json();

          setForm({
            plate: data.plate || "",
            make: data.make || "",
            model: data.model || "",
            year: data.year != null ? String(data.year) : "",
            type: data.type || "NEW",
            countryOfOrigin: data.countryOfOrigin || "",
            seatingCapacity:
              data.seatingCapacity != null ? String(data.seatingCapacity) : "",
            kmPerLiter: data.kmPerLiter != null ? String(data.kmPerLiter) : "",
            vehicleTypeName: data.vehicleTypeName || "",
            chassisNumber: data.chassisNumber || "",
            engineNumber: data.engineNumber || "",
            fuelType: data.fuelType || "",
            cylinderCount:
              data.cylinderCount != null ? String(data.cylinderCount) : "",
            userId: data.userId || "",
          });
        } catch (err: any) {
          console.error("Error loading vehicle for edit:", err);
          setError(err.message || "Failed to load vehicle");
        } finally {
          setLoading(false);
        }
      };

      loadVehicle();
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("jwt") ||
        localStorage.getItem("token") ||
        "";

      const payload = {
        plate: form.plate,
        make: form.make,
        model: form.model,
        year: Number(form.year),
        type: form.type,
        countryOfOrigin: form.countryOfOrigin || undefined,
        seatingCapacity: form.seatingCapacity
          ? Number(form.seatingCapacity)
          : undefined,
        kmPerLiter: form.kmPerLiter ? Number(form.kmPerLiter) : undefined,
        vehicleTypeName: form.vehicleTypeName || undefined,
        chassisNumber: form.chassisNumber || undefined,
        engineNumber: form.engineNumber || undefined,
        fuelType: form.fuelType || undefined,
        cylinderCount: form.cylinderCount
          ? Number(form.cylinderCount)
          : undefined,
        userId: form.userId || undefined,
      };

      const url = isEditMode && vehicleId
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/fleet/vehicles/${encodeURIComponent(vehicleId)}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/fleet/vehicles`;

      const method = isEditMode && vehicleId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.message ||
            (isEditMode ? "Failed to update vehicle" : "Failed to create vehicle")
        );
      }

      setOpen(false);
      router.push("/fleet/manager?tab=vehicles");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    router.push("/fleet/manager");
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col transform animate-in slide-in-from-bottom-10 duration-300">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">አዲስ መኪና ይመዝግቡ</h2>
              <p className="text-blue-100 text-sm opacity-90">
                ወደ ተሽከርካሪዎ አዲስ መኪና ያክሉ
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-all duration-200 backdrop-blur-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Plate Number */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Hash className="w-4 h-4 text-blue-600" />
              የመኪና ሰሌዳ ቁጥር
            </label>
            <div className="relative">
              <input
                id="plate"
                name="plate"
                value={form.plate}
                onChange={handleChange}
                required
                placeholder="ለምሳሌ ABC-1234"
                className="w-full px-4 py-3 pl-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
              <BadgeInfo className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {/* Make & Model Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CarFront className="w-4 h-4 text-blue-600" />
                አምራች
              </label>
              <input
                id="make"
                name="make"
                value={form.make}
                onChange={handleChange}
                placeholder="ለምሳሌ ቶዮታ"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">ሞዴል</label>
              <input
                id="model"
                name="model"
                value={form.model}
                onChange={handleChange}
                placeholder="ለምሳሌ ኮሮላ"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>

          {/* Year */}
          <div className="space-y-2 md:max-w-xs">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              አመት
            </label>
            <div className="relative">
              <input
                id="year"
                name="year"
                type="number"
                value={form.year}
                onChange={handleChange}
                placeholder="ለምሳሌ 2024"
                min="1900"
                max="2030"
                className="w-full px-4 py-3 pl-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white appearance-none"
              />
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
          </div>

          {/* Additional Vehicle Details */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የመነጭ አገር
              </label>
              <input
                id="countryOfOrigin"
                name="countryOfOrigin"
                value={form.countryOfOrigin}
                onChange={handleChange}
                placeholder="ለምሳሌ ጃፓን"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የተቀማጭ ቦታ ብዛት
              </label>
              <input
                id="seatingCapacity"
                name="seatingCapacity"
                type="number"
                value={form.seatingCapacity}
                onChange={handleChange}
                placeholder="ለምሳሌ 5"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                ተሽከርካሪዉ በሊትር የሚሸፍነዉ ኪሜ
              </label>
              <input
                id="kmPerLiter"
                name="kmPerLiter"
                type="number"
                value={form.kmPerLiter}
                onChange={handleChange}
                placeholder="ለምሳሌ 15"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የመኪና አይነት
              </label>
              <select
                id="vehicleTypeName"
                name="vehicleTypeName"
                value={form.vehicleTypeName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">አይነት ይምረጡ...</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የቺሲ ቁጥር
              </label>
              <input
                id="chassisNumber"
                name="chassisNumber"
                value={form.chassisNumber}
                onChange={handleChange}
                placeholder="ለምሳሌ VIN123456"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የሞተር ቁጥር
              </label>
              <input
                id="engineNumber"
                name="engineNumber"
                value={form.engineNumber}
                onChange={handleChange}
                placeholder="ለምሳሌ ENG98765"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የነዳጅ አይነት
              </label>
              <select
                id="fuelType"
                name="fuelType"
                value={form.fuelType}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">የነዳጅ አይነት ይምረጡ...</option>
                {FUEL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                የሲሊንደር ብዛት
              </label>
              <input
                id="cylinderCount"
                name="cylinderCount"
                type="number"
                value={form.cylinderCount}
                onChange={handleChange}
                placeholder="ለምሳሌ 4"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50/50 hover:bg-white"
              />
            </div>
          </div>

          {/* Assigned Driver (optional) */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <CarFront className="w-4 h-4 text-blue-600" />
              የተመደበ ሾፌር <span className="text-gray-400 font-normal">(አማራጭ)</span>
            </label>
            <select
              id="userId"
              name="userId"
              value={form.userId}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="">ሾፌር አልተመደበም</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.firstName, d.lastName].filter(Boolean).join(' ') || d.email || d.id}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tags className="w-4 h-4 text-blue-600" />
              አይነት
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            >
              <option value="NEW">አዲስ</option>
              <option value="USED">ጥቅም ላይ የዋለ</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 text-red-700">
                <X className="w-4 h-4" />
                <span className="text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
            >
              ሰርዝ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  በማስቀመጥ ላይ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  መኪና አስቀምጥ
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Tips */}
        <div className="px-6 pb-4">
          <div className="text-xs text-gray-500 text-center">
            <p>መኪናው ወደ የተሽከርካሪ ዳሽቦርድዎ ይጨመራል</p>
          </div>
        </div>
      </div>
    </div>
  );
}
