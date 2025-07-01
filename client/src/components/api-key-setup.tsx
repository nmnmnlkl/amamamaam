import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

interface ApiKeySetupProps {
  onApiKeySet: () => void;
}

export default function ApiKeySetup({ onApiKeySet }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError("يرجى إدخال مفتاح API");
      return;
    }

    // Basic validation for API key format
    if (!trimmedKey.startsWith("sk-")) {
      setError("يجب أن يبدأ مفتاح API بـ 'sk-'");
      return;
    }

    setIsLoading(true);
    setError("");
    setIsTestingConnection(true);

    try {
      // Test the API key by making a test request
      const response = await apiRequest("POST", "/api/test-api-key", { 
        apiKey: trimmedKey
      });
      
      if (response.ok) {
        // Store the API key in localStorage for this session
        localStorage.setItem("openrouter_api_key", trimmedKey);
        // Also store it in sessionStorage for immediate use
        sessionStorage.setItem("openrouter_api_key", trimmedKey);
        onApiKeySet();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || "مفتاح API غير صحيح أو غير مفعل");
      }
    } catch (error: any) {
      console.error("API key validation error:", error);
      const errorMessage = error.message || "حدث خطأ في الاتصال بالخادم";
      setError(`فشل التحقق من المفتاح: ${errorMessage}`);
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
                  <CardTitle className="text-3xl text-gray-800 mb-2">إعداد مفتاح OpenRouter</CardTitle>
                  <Badge className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm">
                    <i className="fas fa-robot mr-2"></i>
                    مطلوب للذكاء الاصطناعي
                  </Badge>
                </div>
              </div>
              <p className="text-gray-600 text-lg leading-relaxed max-w-lg">
                لتفعيل ميزات التحليل الذكي المتقدم، نحتاج إلى مفتاح OpenRouter API
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center">
                <i className="fas fa-info-circle mr-2"></i>
                كيفية الحصول على مفتاح OpenRouter API
              </h3>
              <ol className="space-y-3 text-blue-700">
                <li className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</span>
                  <div>
                    <strong>زيارة موقع OpenRouter:</strong>
                    <br />
                    <a 
                      href="https://openrouter.ai/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      https://openrouter.ai/
                    </a>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</span>
                  <span>إنشاء حساب جديد أو تسجيل الدخول</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</span>
                  <span>الذهاب إلى قسم "API Keys" في لوحة التحكم</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">4</span>
                  <span>إنشاء مفتاح API جديد ونسخه</span>
                </li>
              </ol>
            </div>

            {/* API Key Input Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="px-4 py-3 rounded-xl border-2 border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 text-lg"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <i className="fas fa-exclamation-triangle text-red-600"></i>
                  <AlertDescription className="text-red-700">
                    <strong>خطأ:</strong> {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading || !apiKey.trim()}
                className="w-full px-6 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingConnection && <div className="loading-spinner ml-3"></div>}
                <i className="fas fa-check-circle ml-3"></i>
                <span>
                  {isLoading ? "جاري التحقق من المفتاح..." : "تفعيل التحليل الذكي"}
                </span>
              </Button>
            </form>

            {/* Benefits */}
            <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
              <h3 className="font-bold text-emerald-800 mb-4 flex items-center">
                <i className="fas fa-sparkles mr-2"></i>
                ميزات التحليل الذكي
              </h3>
              <ul className="space-y-2 text-emerald-700">
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-emerald-500 mr-3"></i>
                  تفسير روحي عميق للأسماء والأسئلة
                </li>
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-emerald-500 mr-3"></i>
                  تحليل متقدم للأرقام والمعاني العددية
                </li>
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-emerald-500 mr-3"></i>
                  توجيهات شخصية مخصصة للسائل
                </li>
                <li className="flex items-center">
                  <i className="fas fa-check-circle text-emerald-500 mr-3"></i>
                  تحليل الطاقات والاتجاهات المستقبلية
                </li>
              </ul>
            </div>

            {/* Security Note */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-gray-600 text-sm flex items-start">
                <i className="fas fa-shield-alt text-gray-500 mr-2 mt-0.5"></i>
                <span>
                  <strong>ملاحظة أمنية:</strong> مفتاح API يُحفظ محلياً في متصفحك فقط ولا يُرسل إلى خوادمنا للتخزين.
                  يُستخدم فقط لإجراء التحليل الذكي عبر خدمة OpenRouter.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}