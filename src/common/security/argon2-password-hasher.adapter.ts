import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { HashOptions } from 'argon2';
import { PasswordHasher } from './password-hasher.port';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly options: HashOptions = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };
  private readonly dummyHash = argon2.hash('meago-dummy-credential', this.options);

  hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  async verifyOrDummy(passwordHash: string | null, password: string): Promise<boolean> {
    return this.verify(passwordHash ?? (await this.dummyHash), password);
  }
}
