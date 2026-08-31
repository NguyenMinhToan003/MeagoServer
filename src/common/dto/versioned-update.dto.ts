import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

/** Extend this DTO for user-driven CRUD updates protected by optimistic concurrency. */
export abstract class VersionedUpdateDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}
