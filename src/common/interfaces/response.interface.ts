export interface IPaginatedResult<T> {
  items: T[];
  totalItems: number;
  page: number;
  limit: number;
}

export interface IBaseResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}
