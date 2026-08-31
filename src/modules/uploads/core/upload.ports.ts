import {
  InitiatedUpload,
  UploadDescriptor,
  UploadProtocol,
  UploadSessionRecord,
} from './upload.types';

export interface UploadSessionRepository {
  create(record: UploadSessionRecord): Promise<UploadSessionRecord>;
  findById(id: string): Promise<UploadSessionRecord | null>;
  save(record: UploadSessionRecord): Promise<UploadSessionRecord>;
}

export interface UploadProtocolPort {
  readonly protocol: UploadProtocol;
  initiate(input: {
    sessionId: string;
    objectKey: string;
    descriptor: UploadDescriptor;
  }): Promise<InitiatedUpload['upload']>;
  complete(session: UploadSessionRecord): Promise<void>;
  abort(session: UploadSessionRecord): Promise<void>;
}

export interface StoredObjectMetadata {
  objectKey: string;
  size: number;
  contentType?: string;
  checksum?: string;
}

export interface ObjectStoragePort {
  inspect(objectKey: string): Promise<StoredObjectMetadata | null>;
  delete(objectKey: string): Promise<void>;
  createReadUrl(objectKey: string, expiresInSeconds: number): Promise<string>;
}
