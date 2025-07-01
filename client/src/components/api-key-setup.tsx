import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { jafrApi } from "@/lib/api";

interface ApiKeySetupProps {
  onApiKeySet: () => void;
}

export default function ApiKeySetup({ onApiKeySet }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Auto-focus the input when component mounts
  const inputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const validateApiKey = (key: string): string | null => {
    const trimmedKey = key.trim();
    
    if (!trimmedKey) {
      return "يرجى إدخال مفتاح API";
    }

    if (!trimmedKey.startsWith("sk-")) {
      return "يجب أن يبدأ مفتاح API بـ 'sk-'. تأكد من نسخ المفتاح بالكامل.";
    }

    if (trimmedKey.length < 30) {
      return "يبدو أن مفتاح API قصير جدًا. يرجى التأكد من نسخ المفتاح بالكامل.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate API key format
    const validationError = validateApiKey(apiKey);
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedKey = apiKey.trim();
    setIsLoading(true);
    setError("");
    setShowSuccess(false);
    setIsTestingConnection(true);

    try {
      // Test the API key first
      const { success, error: apiError, data } = await jafrApi.testApiKey(trimmedKey);
      
      if (success) {
        // Store the API key in both storage mechanisms
        localStorage.setItem("openrouter_api_key", trimmedKey);
        sessionStorage.setItem("openrouter_api_key", trimmedKey);
        
        // Show success state
        setShowSuccess(true);
        setError("");
        
        // Add a small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Notify parent component
        onApiKeySet();
      } else {
        // Clear any stored keys
        localStorage.removeItem("openrouter_api_key");
        sessionStorage.removeItem("openrouter_api_key");
        
        // Handle specific error cases
        if (apiError?.includes('MISSING_API_KEY')) {
          setError("مفتاح API مطلوب. يرجى إدخال مفتاح API صالح.");
        } else if (apiError?.includes('INVALID_API_KEY_FORMAT')) {
          setError("تنسيق مفتاح API غير صالح. يجب أن يبدأ بـ 'sk-' وأن يكون أطول من 30 حرفًا.");
        } else if (apiError?.includes('RATE_LIMIT_EXCEEDED')) {
          setError("تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد 30 دقيقة.");
        } else if (apiError?.includes('CONNECTION_TIMEOUT') || apiError?.includes('timeout')) {
          setError("انتهت مهلة الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.");
        } else if (apiError?.includes('NETWORK_ERROR') || apiError?.includes('Failed to fetch')) {
          setError("تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.");
        } else if (apiError?.includes('SERVER_ERROR') || apiError?.includes('500')) {
          setError("حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقًا.");
        } else {
          setError(apiError || "مفتاح API غير صالح. يرجى التحقق والمحاولة مرة أخرى.");
        }
      }
    } catch (error: any) {
      console.error("API key validation error:", error);
      
      // Clear any stored keys on error
      localStorage.removeItem("openrouter_api_key");
      sessionStorage.removeItem("openrouter_api_key");
      
      // More specific error messages
      let errorMessage = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقًا.";
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-amber-100 to-amber-200">
      <div className="w-full max-w-2xl mx-auto px-4">
        <Card className="analysis-card border-2 border-amber-300 shadow-2xl">
          <CardHeader className="text-center pb-6">
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-center mb-4">
                <i className="fas fa-key text-5xl text-amber-600 mr-4"></i>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">إعداد مفتاح OpenRouter API</h2>
                  <p className="text-gray-600 mt-2">أدخل مفتاح API الخاص بك لتفعيل ميزات التحليل الذكي</p>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {showSuccess ? (
              <div className="text-center py-8">
                <div className="text-green-500 text-5xl mb-4">✓</div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">تم التحقق من المفتاح بنجاح!</h3>
                <p className="text-gray-600">جاري تحميل لوحة التحكم...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="apiKey" className="block text-gray-700 font-bold mb-3 text-lg">
                    <i className="fas fa-key mr-2 text-amber-600"></i>
                    مفتاح OpenRouter API
                  </label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="sk-or-v1-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="px-4 py-3 rounded-xl border-2 border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 text-lg w-full"
                    disabled={isLoading}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    احصل على مفتاح API من{' '}
                    <a 
                      href="https://openrouter.ai/keys" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      OpenRouter
                    </a>
                  </p>
                </div>

                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700 flex items-start">
                      <i className="fas fa-exclamation-triangle text-red-500 ml-2 mt-1"></i>
                      <span>{error}</span>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !apiKey.trim()}
                  className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  size="lg"
                >
                  {isTestingConnection ? (
                    <div className="flex items-center">
                      <span className="ml-2">جاري التحقق من المفتاح...</span>
                      <span className="animate-pulse ml-2">🔍</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <i className="fas fa-check-circle ml-2"></i>
                      <span>تفعيل التحليل الذكي</span>
                    </div>
                  )}
                </Button>
              </form>
            )}
          </CardContent>

          {/* Benefits Section */}
          <div className="px-6 pb-6">
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
              <h3 className="font-bold text-emerald-800 mb-4 flex items-center">
                <i className="fas fa-sparkles ml-2"></i>
                ميزات التحليل الذكي
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-emerald-500 mt-1 ml-3"></i>
                  <span>تفسير روحي عميق للأسماء والأسئلة</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-emerald-500 mt-1 ml-3"></i>
                  <span>تحليل متقدم للأرقام والمعاني العددية</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-emerald-500 mt-1 ml-3"></i>
                  <span>توجيهات شخصية مخصصة للسائل</span>
                </li>
                <li className="flex items-start">
                  <i className="fas fa-check-circle text-emerald-500 mt-1 ml-3"></i>
                  <span>تحليل الطاقات والاتجاهات المستقبلية</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Security Note */}
          <div className="px-6 pb-6">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-gray-600 text-sm flex items-start">
                <i className="fas fa-shield-alt text-gray-500 ml-2 mt-0.5"></i>
                <span>
                  <strong>ملاحظة أمنية:</strong> مفتاح API يُحفظ محلياً في متصفحك فقط ولا يُرسل إلى خوادمنا للتخزين.
                  يُستخدم فقط لإجراء التحليل الذكي عبر خدمة OpenRouter.
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}