import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing.
 *
 * Parameters follow the OWASP recommendation of m=19 MiB, t=2, p=1, which is
 * the documented minimum for Argon2id. `@node-rs/argon2` is used instead of the
 * `argon2` package because it ships prebuilt binaries for every platform we
 * develop and deploy on, so no C++ toolchain is required.
 */
@Injectable()
export class PasswordHasher {
  private readonly options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  } as const;

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, this.options);
  }

  /**
   * Returns false rather than throwing on a malformed hash, so a corrupt row
   * behaves like a wrong password instead of leaking a 500.
   */
  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword, this.options);
    } catch {
      return false;
    }
  }
}
