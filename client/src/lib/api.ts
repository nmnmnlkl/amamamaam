import { apiRequest } from "./queryClient";

type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

export async function makeApiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  options: {
    requireAuth?: boolean;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const { requireAuth = true, headers = {} } = options;
  
  try {
    // Get API key if required
    let apiKey: string | null = null;
    if (requireAuth) {
      apiKey = localStorage.getItem("openrouter_api_key") || 
               sessionStorage.getItem("openrouter_api_key");
      
      if (!apiKey) {
        return {
          success: false,
          error: "مطلوب مصادقة. يرجى إدخال مفتاح API صالح."
        };
      }
    }

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
      ...headers
    };

    // Make the request
    const response = await fetch(endpoint, {
      method,
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (!response.ok) {
      let errorMessage = 'فشل في معالجة الطلب';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      
      // Handle specific status codes
      if (response.status === 401 || response.status === 403) {
        // Clear invalid credentials
        localStorage.removeItem("openrouter_api_key");
        sessionStorage.removeItem("openrouter_api_key");
        
        return {
          success: false,
          error: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى."
        };
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
    
    // Parse successful response
    const responseData = await response.json() as T;
    return {
      success: true,
      data: responseData
    };
  } catch (error: any) {
    console.error('API request failed:', error);
    
    let errorMessage = 'حدث خطأ في الاتصال بالخادم';
    
    if (error.message?.includes('Failed to fetch')) {
      errorMessage = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Helper function for common API endpoints
export const jafrApi = {
  analyze: (data: any) => 
    makeApiRequest<JafrAnalysisResponse>('/api/jafr/analyze', 'POST', data),
    
  testApiKey: (apiKey: string) => 
    makeApiRequest<{ valid: boolean; message: string }>(
      '/api/test-api-key', 
      'POST', 
      { apiKey },
      { requireAuth: false }
    )
};

// Types
interface JafrAnalysisResponse {
  success: boolean;
  message?: string;
  data?: any;
  traditionalResults?: any;
  aiAnalysis?: any;
  combinedInterpretation?: any;
};
