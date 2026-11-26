/** Every successful API response is wrapped as { success: true, data }. */
export interface ApiEnvelope<T> {
  success: true;
  data: T;
}

/** Every failed API response is { success: false, error: { statusCode, message, path, timestamp } }. */
export interface ApiErrorBody {
  success: false;
  error: {
    statusCode: number;
    message: string | string[];
    path: string;
    timestamp: string;
  };
}
