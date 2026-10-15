import {
  OpeningEvidenceProvider,
  OpeningCustodyRegistry,
} from './inventory-opening-manifest';

export type ActivationRequest = {
  companyId: string;
  cutoverId: string;
  expectedRevision: number;
  manifestDigest: string;
  expectedBuild: string;
  expectedEnvironment: string;
  businessActorId: string;
  operatorId: string;
  evidencePath: string;
  evidenceHash: string;
};

// Implemented by an explicitly installed, trusted operational adapter. A caller's
// JSON booleans/hash alone are never an attestation. The adapter must authenticate
// origin, expiry, immutable retained request and the referenced external artifacts.
export interface ActivationEvidenceAdapter {
  accept(
    request: ActivationRequest,
    mode: 'ACTIVATE' | 'READBACK' | 'ROLLBACK_REVIEW',
  ): Promise<{
    retainedRequest: ActivationRequest;
    protocol: string;
    validFrom: string;
    validUntil: string;
    freezeAccepted: boolean;
    writerInventoryCertified: boolean;
    staleRuntimeFenceCertified: boolean;
    runtimeCertified: boolean;
    beforeImagesCompatible: boolean;
  }>;
}
export interface InventoryActivationAdapters {
  activation: ActivationEvidenceAdapter;
  opening: OpeningEvidenceProvider;
  custody: OpeningCustodyRegistry;
}
