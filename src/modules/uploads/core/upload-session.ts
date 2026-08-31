import { UploadDomainError } from './upload.errors';
import { UploadSessionRecord, UploadStatus } from './upload.types';

const transitions: Record<UploadStatus, readonly UploadStatus[]> = {
  initiated: ['uploading', 'uploaded', 'failed', 'aborted'],
  uploading: ['uploaded', 'failed', 'aborted'],
  uploaded: ['processing', 'ready', 'failed'],
  processing: ['ready', 'failed'],
  ready: [],
  failed: [],
  aborted: [],
};

export function transitionUpload(
  session: UploadSessionRecord,
  next: UploadStatus,
  now: Date,
  failureCode?: string,
): UploadSessionRecord {
  if (session.status === next) return session;
  if (!transitions[session.status].includes(next)) {
    throw new UploadDomainError(
      'UPLOAD_INVALID_TRANSITION',
      `Cannot transition upload from ${session.status} to ${next}`,
    );
  }
  if (next === 'failed' && !failureCode) {
    throw new UploadDomainError('UPLOAD_FAILURE_CODE_REQUIRED', 'A failed upload needs a code');
  }
  return {
    ...session,
    status: next,
    updatedAt: now,
    ...(next === 'failed' ? { failureCode } : {}),
  };
}
