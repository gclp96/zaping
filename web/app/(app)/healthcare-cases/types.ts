import type {
  HealthcareDoctorOption,
  HealthcareHospitalOption,
} from '@/app/components/business/HealthcareMasterSelectors';

export type HealthcareCaseStatus = 'DRAFT' | 'SCHEDULED' | 'CANCELLED';

export type HealthcareCase = {
  id: string;
  doctorId: string | null;
  hospitalId: string | null;
  folio: string;
  title: string;
  procedureDescription: string | null;
  status: HealthcareCaseStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  responsibleUserId: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  doctor: HealthcareDoctorOption | null;
  hospital: HealthcareHospitalOption | null;
};

export type HealthcareCaseFormValue = {
  title: string;
  procedureDescription: string;
  doctorId: string | null;
  hospitalId: string | null;
  doctor: HealthcareDoctorOption | null;
  hospital: HealthcareHospitalOption | null;
  doctorTouched: boolean;
  hospitalTouched: boolean;
};
