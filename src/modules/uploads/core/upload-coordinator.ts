import type { Clock, IdGenerator } from '@meago/core';
import { UploadDomainError } from './upload.errors';
import { UploadProtocolPort, UploadSessionRepository } from './upload.ports';
import { transitionUpload } from './upload-session';
import { InitiatedUpload, UploadDescriptor, UploadSessionRecord } from './upload.types';

export interface UploadPolicy {
  maxBytes: number;
  allowedContentTypes: ReadonlySet<string>;
}

export class UploadCoordinator {
  constructor(
    private readonly sessions: UploadSessionRepository,
    private readonly protocol: UploadProtocolPort,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly policy: UploadPolicy,
  ) {}

  async initiate(ownerId: string, descriptor: UploadDescriptor): Promise<InitiatedUpload> {
    this.assertDescriptor(descriptor);
    const now = this.clock.now();
    const sessionId = this.ids.generate();
    const objectKey = `${ownerId}/${sessionId}`;
    let session = await this.sessions.create({
      id: sessionId,
      ownerId,
      objectKey,
      protocol: this.protocol.protocol,
      status: 'initiated',
      ...descriptor,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const upload = await this.protocol.initiate({ sessionId, objectKey, descriptor });
      session = await this.sessions.save(
        transitionUpload(
          { ...session, protocolUploadId: upload.uploadId },
          'uploading',
          this.clock.now(),
        ),
      );
      return { session, upload };
    } catch (error) {
      await this.sessions.save(
        transitionUpload(session, 'failed', this.clock.now(), 'UPLOAD_INIT_FAILED'),
      );
      throw error;
    }
  }

  async complete(ownerId: string, sessionId: string): Promise<UploadSessionRecord> {
    const session = await this.ownedSession(ownerId, sessionId);
    if (session.status === 'uploaded') return session;
    if (session.status !== 'uploading' && session.status !== 'initiated') {
      throw new UploadDomainError('UPLOAD_NOT_COMPLETABLE', 'Upload cannot be completed');
    }
    await this.protocol.complete(session);
    return this.sessions.save(transitionUpload(session, 'uploaded', this.clock.now()));
  }

  async abort(ownerId: string, sessionId: string): Promise<UploadSessionRecord> {
    const session = await this.ownedSession(ownerId, sessionId);
    if (session.status === 'aborted') return session;
    if (session.status !== 'initiated' && session.status !== 'uploading') {
      throw new UploadDomainError('UPLOAD_NOT_ABORTABLE', 'Upload cannot be aborted');
    }
    await this.protocol.abort(session);
    return this.sessions.save(transitionUpload(session, 'aborted', this.clock.now()));
  }

  private async ownedSession(ownerId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.ownerId !== ownerId) {
      throw new UploadDomainError('UPLOAD_NOT_FOUND', 'Upload session not found');
    }
    if (session.protocol !== this.protocol.protocol) {
      throw new UploadDomainError('UPLOAD_PROTOCOL_MISMATCH', 'Upload protocol mismatch');
    }
    return session;
  }

  private assertDescriptor(descriptor: UploadDescriptor) {
    if (!Number.isSafeInteger(descriptor.size) || descriptor.size <= 0) {
      throw new UploadDomainError('UPLOAD_INVALID_SIZE', 'Upload size must be a positive integer');
    }
    if (descriptor.size > this.policy.maxBytes) {
      throw new UploadDomainError('UPLOAD_TOO_LARGE', 'Upload exceeds the configured size limit');
    }
    if (!this.policy.allowedContentTypes.has(descriptor.contentType)) {
      throw new UploadDomainError('UPLOAD_TYPE_NOT_ALLOWED', 'Upload content type is not allowed');
    }
  }
}
