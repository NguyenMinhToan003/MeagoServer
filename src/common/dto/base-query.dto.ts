import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, IsIn } from 'class-validator';
import { IBaseQuery } from '@meago/core';

export type SortDir = 'ASC' | 'DESC';

/**
 * Query DTO chuẩn cho mọi endpoint danh sách.
 * (Phiên bản gọn + validate của AQueries trong source mẫu — dùng number thật
 * thay vì string thô, tránh cast thủ công rải rác)
 */
export class BaseQueryDto implements IBaseQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: SortDir = 'DESC';

  @IsOptional()
  @IsString()
  search?: string;
}
