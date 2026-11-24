export type UploadPurpose = 'avatar';
export type UploadStatus =
  'pending' | 'attached' | 'cleanup_pending' | 'deleting' | 'deleted';

export interface SignedImageUploadParams {
  timestamp: number;
  public_id: string;
  upload_preset: string;
  overwrite: false;
}

export interface VerifiedImage {
  publicId: string;
  assetId: string;
  secureUrl: string;
  resourceType: 'image';
  format: string;
  bytes: number;
  width: number;
  height: number;
}

export interface MediaUploadSession {
  id: string;
  ownerId: string;
  purpose: UploadPurpose;
  publicId: string;
  assetId: string | null;
  resourceType: 'image';
  status: UploadStatus;
  secureUrl: string | null;
  signatureTimestamp: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  attachedAt: Date | null;
  lastCleanupError: string | null;
}

export type CleanupOutcome =
  { deleted: true } | { deleted: false; errorCode: string };
