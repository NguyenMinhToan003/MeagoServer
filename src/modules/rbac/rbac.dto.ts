import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Permission là data dạng "resource:action" hoặc "a.b.c" (audit); chỉ chặn ký tự lạ. */
export class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @Matches(/^[a-z0-9][a-z0-9_.:-]*$/, { each: true })
  permissions: string[];
}

export class SetUserRolesDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  roleIds: string[];
}
