
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, AlertTriangle, WifiOff } from 'lucide-react';

// Hooks
import { useCamera } from '../hooks/attendance/useCamera';
import { useGeoLocation } from '../hooks/attendance/useGeoLocation';
import { useAttendance } from '../hooks/attendance/useAttendance';
import { useOfficeNetwork } from '../hooks/attendance/useOfficeNetwork';
import { getEnabledDutyTypes } from '../utils/dutyTypes';
import { useSubscription } from '../context/SubscriptionContext';
import { useToast } from '../context/ToastContext';

// UI Components
import { AttendanceHeader } from '../components/attendance/AttendanceHeader';
import { CameraFeed } from '../components/attendance/CameraFeed';
import { LocationDisplay } from '../components/attendance/LocationDisplay';
import { AttendanceActions } from '../components/attendance/AttendanceActions';
import { AdBanner } from '../components/ads/AdBanner';

interface AttendanceProps {
  user: any;
  autoStart?: 'OFFICE' | 'FACTORY' | 'FINISH';
  onFinish?: () => void;
}

const Attendance: React.FC<AttendanceProps> = ({ user, autoStart, onFinish }) => {
  const { showToast } = useToast();

  // 1. Logic Hooks
  // Office Wi-Fi re-check is created below; a ref lets the punch handler trigger it.
  const officeRecheckRef = useRef<() => void>(() => {});
  const {
    currentTime, activeRecord, appConfig, isLoading, status, submitPunch
  } = useAttendance(user, onFinish, () => officeRecheckRef.current());

  const {
    videoRef, stream, error: cameraError, facingMode, isTorchOn,
    startCamera, stopCamera, toggleCamera, toggleTorch, takeSelfie,
    takePhoto, loading: cameraLoading
  } = useCamera();

  const {
    location, isLocating, error: locationError, detectLocation
  } = useGeoLocation();

  // Subscription check for write access
  const { canPerformAction, subscription } = useSubscription();
  const canPunch = canPerformAction('write');

  // 2. Local UI State
  const [remarks, setRemarks] = useState('');
  const [dutyType, setDutyType] = useState<'OFFICE' | 'FACTORY'>('OFFICE');
  const [isMobile, setIsMobile] = useState(false);
  const [fallbackPhoto, setFallbackPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInitialized = useRef(false);

  // Office Wi-Fi Check-in: always allowed when the org has it OFF.
  const officeNetwork = useOfficeNetwork(location, dutyType);
  officeRecheckRef.current = officeNetwork.check;
  const officeWifiBlocked = officeNetwork.enabled && !officeNetwork.allowed;

  // 3. Initialize hardware once when data is ready
  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (isLoading || cameraInitialized.current) return;
    cameraInitialized.current = true;

    detectLocation(true);
    startCamera('user');
  }, [isLoading]);

  // Update duty type when autoStart or activeRecord changes (no camera restart)
  useEffect(() => {
    if (autoStart === 'FACTORY') setDutyType('FACTORY');
    else if (activeRecord?.dutyType) setDutyType(activeRecord.dutyType);
  }, [autoStart, activeRecord?.dutyType]);

  // A new check-in may only use a duty type the admin has switched on. An open session keeps
  // its own type so it can always be checked out, even if that type was switched off since.
  const hasOpenSession = !!activeRecord && !activeRecord.checkOut;
  useEffect(() => {
    if (hasOpenSession || !appConfig) return;
    const enabled = getEnabledDutyTypes(appConfig);
    if (!enabled.includes(dutyType)) setDutyType(enabled[0]);
  }, [hasOpenSession, appConfig, dutyType]);

  // 4. Handlers
  const handleTakePhoto = async () => {
    const photo = await takePhoto();
    if (photo) setFallbackPhoto(photo);
  };

  const handlePunchSubmit = async () => {
    if (!canPunch) {
      if (subscription?.status === 'EXPIRED') {
        showToast('Your trial has expired. Please upgrade to continue punching attendance.', 'warning');
      } else if (subscription?.status === 'SUSPENDED') {
        showToast('Your account is suspended. Please contact support.', 'error');
      }
      return;
    }

    if (dutyType === 'FACTORY' && !remarks.trim()) {
      showToast("Mandatory: Please mention the Factory Name and details in remarks.", 'warning');
      return;
    }

    if (status !== 'idle' || !location) return;

    let selfieData: string | null = null;

    // Try live stream first, then fallback photo
    if (stream && canvasRef.current) {
      selfieData = takeSelfie(canvasRef.current);
    } else if (fallbackPhoto) {
      selfieData = fallbackPhoto;
    } else {
      // No photo at all — try taking one now
      selfieData = await takePhoto();
      if (selfieData) setFallbackPhoto(selfieData);
    }

    if (!selfieData) return;

    await submitPunch(dutyType, remarks, location, selfieData);
  };

  const handleBack = () => {
    stopCamera();
    if (onFinish) onFinish();
  };

  const hasPhoto = !!stream || !!fallbackPhoto;

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-blue-600" size={48} /></div>;

  return (
    <div className="fixed inset-0 bg-[#fcfdfe] z-[9999] flex flex-col animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">

      <AttendanceHeader
        currentTime={currentTime}
        onBack={handleBack}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 min-h-0">
        <CameraFeed
          videoRef={videoRef}
          stream={stream}
          error={cameraError}
          facingMode={facingMode}
          isMobile={isMobile}
          isTorchOn={isTorchOn}
          toggleTorch={toggleTorch}
          toggleCamera={toggleCamera}
          showSuccess={status === 'success'}
          fallbackPhoto={fallbackPhoto}
          onTakePhoto={handleTakePhoto}
          photoLoading={cameraLoading}
        >
          <LocationDisplay
            location={location}
            isLocating={isLocating}
            error={locationError}
            onRetry={() => detectLocation(true)}
          />
        </CameraFeed>
      </div>

      {/* Subscription Warning Banner */}
      {!canPunch && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">
            {subscription?.status === 'EXPIRED'
              ? 'Your trial has expired. Attendance punching is disabled.'
              : 'Your account is suspended. Please contact support.'}
          </span>
        </div>
      )}

      {/* Office Wi-Fi Check-in Banner */}
      {canPunch && officeWifiBlocked && (
        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex items-center gap-2 text-amber-800">
          <WifiOff className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium flex-1">Connect to the office Wi-Fi to check in.</span>
          <button
            onClick={officeNetwork.check}
            disabled={officeNetwork.isChecking}
            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-60 flex items-center gap-1"
          >
            {officeNetwork.isChecking && <Loader2 className="w-3 h-3 animate-spin" />}
            Check again
          </button>
        </div>
      )}

      <AttendanceActions
        dutyType={dutyType}
        dutyLabel={dutyType === 'FACTORY' ? (appConfig?.dutyLabel2 || 'Factory') : (appConfig?.dutyLabel1 || 'Office')}
        remarks={remarks}
        setRemarks={setRemarks}
        onSubmit={handlePunchSubmit}
        status={status}
        activeRecord={activeRecord}
        isDisabled={!canPunch || officeWifiBlocked || !location || isLocating || status !== 'idle' || !hasPhoto || (dutyType === 'FACTORY' && !remarks.trim())}
      />

      {/* Phase 2B: PWA Ad Placement - Only after successful punch */}
      {status === 'success' && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <AdBanner slot="attendance-success" className="mx-auto" />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default Attendance;
