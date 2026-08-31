import { transitionUpload } from './upload-session';
import { UploadSessionRecord } from './upload.types';

const base: UploadSessionRecord = {
  id: 'upload-1',
  ownerId: 'user-1',
  objectKey: 'user-1/upload-1',
  protocol: 's3-multipart',
  status: 'initiated',
  fileName: 'story.mp3',
  contentType: 'audio/mpeg',
  size: 1024,
  purpose: 'story-audio',
  createdAt: new Date('2026-08-31T00:00:00Z'),
  updatedAt: new Date('2026-08-31T00:00:00Z'),
};

describe('upload state machine', () => {
  it('allows the normal upload and processing lifecycle', () => {
    const uploading = transitionUpload(base, 'uploading', new Date());
    const uploaded = transitionUpload(uploading, 'uploaded', new Date());
    const processing = transitionUpload(uploaded, 'processing', new Date());
    expect(transitionUpload(processing, 'ready', new Date()).status).toBe('ready');
  });

  it('rejects transition out of a terminal state', () => {
    const aborted = transitionUpload(base, 'aborted', new Date());
    expect(() => transitionUpload(aborted, 'uploading', new Date())).toThrow(
      'Cannot transition upload from aborted to uploading',
    );
  });

  it('requires a stable failure code', () => {
    expect(() => transitionUpload(base, 'failed', new Date())).toThrow(
      'A failed upload needs a code',
    );
  });
});
