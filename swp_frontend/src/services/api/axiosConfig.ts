export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details?: any;
  };
  timestamp: string;
}

export class ApiService {
  private baseURL: string;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.baseURL = baseURL;
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> { //Trả về T trực tiếp, không wrap trong ApiResponse
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const requestOptions: RequestInit = {
      method: 'GET',
      credentials: 'include',
      headers,
      ...options,
    };

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Auth methods
  async login(email: string, password: string, rememberMe?: boolean) {
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe: rememberMe || false }),
    });
    return result.data || result;
  }

  async checkAuth() {
    return this.request('/api/auth/check', {
      method: 'GET',
    });
  }

  async logout() {
    try {
      const result = await this.request('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      return result;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async register(email: string, password: string) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async forgotPassword(email: string) {
    return this.request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async validateResetToken(token: string) {
    return this.request(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });
  }

  async resetPassword(token: string, newPassword: string, confirmPassword: string) {
    return this.request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, confirmPassword }),
    });
  }

  async getProfile() {
    return this.request('/api/profile', {
      method: 'GET',
    });
  }

  async updateProfile(data: any) {
    return this.request('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string) {
    return this.request('/api/profile/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  }

  async uploadAvatar(formData: FormData) {
    const response = await this.request('/api/profile/upload-avatar', {
      method: 'POST',
      headers: {},
      body: formData,
    });

    return response;
  }

  async removeAvatar() {
    return this.request('/api/profile/avatar', {
      method: 'DELETE',
    });
  }

  async deleteAccount(password: string) {
    return this.request('/api/profile/account', {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    })
  }

  async uploadFile<T = any>(
    endpoint: string,
    formData: FormData,
    _onProgress?: (progress: number) => void
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
        // Không set Content-Type header, browser sẽ tự động set với boundary
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`File Upload Error (${endpoint}):`, error);
      throw error;
    }
  }

  async downloadFile(
    endpoint: string,
    filename?: string,
    options: RequestInit = {}
  ): Promise<void> {
    const url = `${this.baseURL}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        ...options,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Lấy filename từ Content-Disposition header hoặc sử dụng default
      const contentDisposition = response.headers.get('Content-Disposition');
      let finalFilename = filename || 'download';

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          finalFilename = filenameMatch[1];
        }
      }

      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      console.error(`Download Error (${endpoint}):`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();