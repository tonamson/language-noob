import axios, {
  AxiosInstance,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

/**
 * Lấy API URL từ các nguồn theo thứ tự ưu tiên:
 * 1. baseURL được truyền vào (nếu có)
 * 2. process.env.NEXT_PUBLIC_API_URL (biến môi trường)
 * 3. http://localhost:2053 (mặc định)
 */
const getApiBaseURL = (baseURL?: string): string => {
  if (baseURL) {
    return baseURL;
  }

  // Fallback về biến môi trường hoặc mặc định
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:2053";
};

/**
 * Base class cho các API service
 * Cung cấp axios instance và các method tiện ích để tái sử dụng
 */

export abstract class ApiClientService {
  protected readonly apiClient: AxiosInstance;

  constructor(baseURL?: string, config?: AxiosRequestConfig) {
    const apiBaseURL = getApiBaseURL(baseURL);

    this.apiClient = axios.create({
      baseURL: apiBaseURL,
      headers: {
        "Content-Type": "application/json",
        ...config?.headers,
      },
      ...config,
    });

    // Có thể thêm interceptors ở đây nếu cần
    this.setupInterceptors();
  }

  /**
   * Thiết lập interceptors cho axios instance
   * Có thể override trong class con để thêm logic riêng
   */
  protected setupInterceptors(): void {
    // Request interceptor
    this.apiClient.interceptors.request.use(
      (config) => {
        // Có thể thêm token, logging, etc. ở đây
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.apiClient.interceptors.response.use(
      (response) => {
        return response;
      },
      (error) => {
        // Có thể xử lý lỗi chung ở đây
        return Promise.reject(error);
      }
    );
  }

  /**
   * Xử lý lỗi từ axios và throw custom error
   * @param error Lỗi từ axios
   * @param defaultMessage Thông báo lỗi mặc định
   * @param ErrorClass Class error tùy chỉnh
   */
  protected handleError<T extends Error>(
    error: unknown,
    defaultMessage: string,
    ErrorClass: new (
      message: string,
      statusCode?: number,
      originalError?: unknown
    ) => T
  ): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string }>;

      if (axiosError.response) {
        // Lỗi từ server (4xx, 5xx)
        const errorMessage =
          axiosError.response.data?.message || defaultMessage;
        throw new ErrorClass(
          errorMessage,
          axiosError.response.status,
          axiosError
        );
      } else if (axiosError.request) {
        // Không nhận được response từ server
        throw new ErrorClass(
          "Không thể kết nối đến server. Vui lòng kiểm tra API server đã chạy chưa.",
          undefined,
          axiosError
        );
      }
    }

    // Lỗi không xác định
    throw new ErrorClass(defaultMessage, undefined, error);
  }

  /**
   * GET request wrapper
   */
  protected async get<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.apiClient.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request wrapper
   */
  protected async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.apiClient.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request wrapper
   */
  protected async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.apiClient.put<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request wrapper
   */
  protected async delete<T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.apiClient.delete<T>(url, config);
    return response.data;
  }

  /**
   * PATCH request wrapper
   */
  protected async patch<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.apiClient.patch<T>(url, data, config);
    return response.data;
  }
}
