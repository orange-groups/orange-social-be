export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationDetail {
  field: string;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details: ValidationDetail[] | null;
  };
}
