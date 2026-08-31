export const UPLOAD_STATUSES = [
  'initiated',
  'uploading',
  'uploaded',
  'processing',
  'ready',
  'failed',
  'aborted',
] as const;

export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
export type UploadProtocol = 'direct' | 's3-multipart' | 'tus';

export interface UploadDescriptor {
  fileName: string;
  contentType: string;
  size: number;
  purpose: string;
}

export interface UploadSessionRecord extends UploadDescriptor {
  id: string;
  ownerId: string;
  objectKey: string;
  protocol: UploadProtocol;
  status: UploadStatus;
  protocolUploadId?: string;
  failureCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InitiatedUpload {
  session: UploadSessionRecord;
  upload: {
    protocol: UploadProtocol;
    endpoint?: string;
    uploadId?: string;
    headers?: Record<string, string>;
    expiresAt?: Date;
  };
}
