import { UploadCoordinator } from './upload-coordinator';
import { UploadProtocolPort, UploadSessionRepository } from './upload.ports';
import { UploadSessionRecord } from './upload.types';

describe('UploadCoordinator', () => {
  const records = new Map<string, UploadSessionRecord>();
  const sessions: UploadSessionRepository = {
    create: jest.fn(async (record) => {
      records.set(record.id, record);
      return record;
    }),
    findById: jest.fn(async (id) => records.get(id) ?? null),
    save: jest.fn(async (record) => {
      records.set(record.id, record);
      return record;
    }),
  };
  const initiate = jest.fn(async () => ({
    protocol: 's3-multipart' as const,
    uploadId: 'provider-1',
  }));
  const complete = jest.fn(async () => undefined);
  const abort = jest.fn(async () => undefined);
  const protocol: UploadProtocolPort = {
    protocol: 's3-multipart',
    initiate,
    complete,
    abort,
  };
  const coordinator = new UploadCoordinator(
    sessions,
    protocol,
    { now: () => new Date('2026-08-31T00:00:00Z') },
    { generate: () => 'upload-1' },
    { maxBytes: 10_000, allowedContentTypes: new Set(['audio/mpeg']) },
  );

  beforeEach(() => {
    records.clear();
    jest.clearAllMocks();
  });

  it('creates an opaque object key and persists the protocol upload id', async () => {
    const result = await coordinator.initiate('user-1', {
      fileName: '../../unsafe.mp3',
      contentType: 'audio/mpeg',
      size: 1024,
      purpose: 'story-audio',
    });

    expect(result.session.objectKey).toBe('user-1/upload-1');
    expect(result.session.objectKey).not.toContain('unsafe.mp3');
    expect(result.session.protocolUploadId).toBe('provider-1');
    expect(result.session.status).toBe('uploading');
  });

  it('rejects disallowed content before calling the protocol adapter', async () => {
    await expect(
      coordinator.initiate('user-1', {
        fileName: 'payload.exe',
        contentType: 'application/octet-stream',
        size: 1024,
        purpose: 'story-audio',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_TYPE_NOT_ALLOWED' });
    expect(initiate).not.toHaveBeenCalled();
  });

  it('does not reveal or mutate another owner upload', async () => {
    await coordinator.initiate('user-1', {
      fileName: 'story.mp3',
      contentType: 'audio/mpeg',
      size: 1024,
      purpose: 'story-audio',
    });

    await expect(coordinator.abort('user-2', 'upload-1')).rejects.toMatchObject({
      code: 'UPLOAD_NOT_FOUND',
    });
    expect(abort).not.toHaveBeenCalled();
  });
});
