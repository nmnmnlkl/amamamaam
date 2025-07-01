import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { calculateBasicNumerology, getBasicMeaning, reduceToSingleDigit } from "@/lib/jafr-utils";
import { jafrApi } from "@/lib/api";
import ApiKeySetup from "@/components/api-key-setup";
import type { JafrAnalysisRequest, JafrAnalysisResponse } from "@shared/schema";

export default function JafrCalculator() {
  const [name, setName] = useState("");
  const [mother, setMother] = useState("");
  const [question, setQuestion] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deepAnalysis, setDeepAnalysis] = useState(true);
  const [numerologyDetails, setNumerologyDetails] = useState(true);
  const [contextualInterpretation, setContextualInterpretation] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [showProgress, setShowProgress] = useState(false);
  interface TraditionalResults {
    nameAnalysis: { total: number; details: { value: number; char: string }[] };
    motherAnalysis: { total: number; details: { value: number; char: string }[] };
    questionAnalysis: { total: number; details: { value: number; char: string }[] };
    totalValue: number;
    reducedValue: number;
    wafqSize: number;
  }

  interface AnalysisResults {
    traditionalResults: TraditionalResults;
    aiAnalysis?: any;
    combinedInterpretation?: any;
    message?: string;
    success?: boolean;
  }

  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    // Check if API key exists in localStorage
    const storedKey = localStorage.getItem("openrouter_api_key");
    setHasApiKey(!!storedKey);
  }, []);

  const analysisMutation = useMutation({
    mutationFn: async (data: JafrAnalysisRequest): Promise<JafrAnalysisResponse> => {
      const { success, data: responseData, error } = await jafrApi.analyze(data);
      
      if (!success) {
        // Handle API key related errors
        if (error?.includes('API') || error?.includes('مفتاح') || error?.includes('مصادقة')) {
          localStorage.removeItem("openrouter_api_key");
          sessionStorage.removeItem("openrouter_api_key");
          setHasApiKey(false);
          throw new Error(error || "مشكلة في مصادقة API. يرجى التأكد من صحة المفتاح.");
        }
        
        throw new Error(error || "حدث خطأ أثناء معالجة طلبك");
      }
      
      return responseData as JafrAnalysisResponse;
    },
    onSuccess: (data: any) => {
      // Set the results with proper typing
      const responseData = data as AnalysisResults;
      const resultsData: AnalysisResults = {
        traditionalResults: responseData.traditionalResults || {
          nameAnalysis: { total: 0, details: [] },
          motherAnalysis: { total: 0, details: [] },
          questionAnalysis: { total: 0, details: [] },
          totalValue: 0,
          reducedValue: 0,
          wafqSize: 0
        },
        aiAnalysis: responseData.aiAnalysis,
        combinedInterpretation: responseData.combinedInterpretation,
        message: responseData.message || 'تم التحليل بنجاح',
        success: responseData.success !== false // Default to true if not specified
      };
      
      setResults(resultsData);
      setShowProgress(false);
      setError("");
      
      // Log success message
      if (resultsData.message) {
        console.log("Analysis successful:", resultsData.message);
      } else if (resultsData.success) {
        console.log("Analysis completed successfully");
      }
      
      // Scroll to results with smooth animation
      setTimeout(() => {
        const resultsElement = document.getElementById('analysis-results');
        if (resultsElement) {
          resultsElement.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 100);
    },
    onError: (error: any) => {
      console.error("Analysis error:", error);
      
      // Default error message
      let errorMessage = "حدث خطأ غير متوقع أثناء التحليل";
      
      // More specific error messages based on error type
      if (error.message) {
        errorMessage = error.message;
        
        // Handle API key related errors
        if (error.message.includes('API') || error.message.includes('مفتاح')) {
          localStorage.removeItem("openrouter_api_key");
          sessionStorage.removeItem("openrouter_api_key");
          setHasApiKey(false);
        }
      }
      
      setError(errorMessage);
      setShowProgress(false);
      
      // Auto-hide error after 10 seconds
      const errorTimeout = setTimeout(() => {
        setError("");
      }, 10000);
      
      return () => clearTimeout(errorTimeout);
    }
  });

  const handleCalculate = async () => {
    if (!name.trim() || !mother.trim() || !question.trim()) {
      setError("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (question.length < 10) {
      setError("يرجى كتابة سؤال أكثر تفصيلاً (على الأقل 10 أحرف)");
      return;
    }

    setError("");
    setResults(null);
    setShowProgress(true);
    setProgress(0);

    // Simulate progress updates
    const progressSteps = [
      { percent: 20, text: "حساب القيم العددية للأسماء..." },
      { percent: 50, text: "تحليل السياق بالذكاء الاصطناعي..." },
      { percent: 80, text: "دمج النتائج وإنشاء التفسير المتكامل..." },
      { percent: 100, text: "عرض النتائج النهائية..." }
    ];

    for (const step of progressSteps) {
      setProgress(step.percent);
      setProgressText(step.text);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    analysisMutation.mutate({
      name: name.trim(),
      mother: mother.trim(),
      question: question.trim(),
      options: {
        deepAnalysis,
        numerologyDetails,
        contextualInterpretation
      }
    });
  };

  const nameAnalysis = name.length > 2 ? calculateBasicNumerology(name) : null;
  const motherAnalysis = mother.length > 2 ? calculateBasicNumerology(mother) : null;
  const questionWordCount = question.length > 10 ? question.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (results) {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [results]);

  const generateWafqGrid = (size: number, baseValue: number) => {
    const baseNumber = Math.floor(baseValue / (size * size));
    const cells = [];
    
    for (let i = 0; i < size * size; i++) {
      const value = baseNumber + (i % 9) + 1;
      cells.push(
        <div 
          key={i}
          className="wafq-cell bg-white border-2 border-purple-300 rounded-lg p-3 text-center font-bold text-purple-800 hover:bg-purple-50 transition cursor-pointer"
        >
          {value}
        </div>
      );
    }
    
    return cells;
  };

  // Show API key setup if no key is available
  if (!hasApiKey) {
    return <ApiKeySetup onApiKeySet={() => setHasApiKey(true)} />;
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="flex items-center mb-4">
              <i className="fas fa-star-and-crescent text-6xl text-amber-600 mr-4"></i>
              <div>
                <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-2">نظام الجفر الذكي المتقدم</h1>
                <div className="flex items-center justify-center">
                  <Badge className="ai-badge text-white px-4 py-2 rounded-full text-sm font-bold flex items-center">
                    <i className="fas fa-robot mr-2"></i>
                    مدعوم بالذكاء الاصطناعي
                  </Badge>
                </div>
              </div>
            </div>
            <p className="text-gray-600 text-xl mt-4 max-w-4xl leading-relaxed">
              تحليل الأوفاق التلقائي باستخدام خوارزميات متقدمة في علم الحروف والأعداد مع قوة الذكاء الاصطناعي لتحليل أدق وأعمق
            </p>
          </div>
        </header>

        {/* API Status Indicator */}
        <div className="mb-6 flex justify-center items-center space-x-4">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm">
            <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2 animate-pulse"></div>
            <span className="text-gray-700">نظام الذكاء الاصطناعي جاهز للتحليل</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.removeItem("openrouter_api_key");
              setHasApiKey(false);
            }}
            className="text-amber-600 border-amber-300 hover:bg-amber-50"
          >
            <i className="fas fa-key mr-2"></i>
            تغيير مفتاح API
          </Button>
        </div>

        {/* Input Section */}
        <Card className="analysis-card mb-8 border border-amber-200">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-gray-700 font-bold mb-3 text-lg">
                    <i className="fas fa-user mr-2 text-amber-600"></i>
                    اسم الشخص
                  </label>
                  <div className="relative">
                    <Input
                      id="name"
                      type="text"
                      placeholder="اكتب الاسم الكامل"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="px-5 py-4 rounded-xl border-2 border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 text-lg"
                    />
                    {nameAnalysis && (
                      <div className="text-sm text-gray-500 mt-2 slide-in">
                        القيمة العددية: {nameAnalysis.total} - {getBasicMeaning(nameAnalysis.total)}
                      </div>
                    )}
                  </div>
                </div>
                        
                <div>
                  <label htmlFor="mother" className="block text-gray-700 font-bold mb-3 text-lg">
                    <i className="fas fa-female mr-2 text-amber-600"></i>
                    اسم الأم
                  </label>
                  <div className="relative">
                    <Input
                      id="mother"
                      type="text"
                      placeholder="اسم الأم كاملاً"
                      value={mother}
                      onChange={(e) => setMother(e.target.value)}
                      className="px-5 py-4 rounded-xl border-2 border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 text-lg"
                    />
                    {motherAnalysis && (
                      <div className="text-sm text-gray-500 mt-2 slide-in">
                        القيمة العددية: {motherAnalysis.total} - {getBasicMeaning(motherAnalysis.total)}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="question" className="block text-gray-700 font-bold mb-3 text-lg">
                  <i className="fas fa-question-circle mr-2 text-amber-600"></i>
                  السؤال أو النية
                </label>
                <Textarea
                  id="question"
                  rows={8}
                  placeholder="اكتب سؤالك أو نيتك بالتفصيل... كلما كان السؤال أوضح، كان التحليل أدق"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="px-5 py-4 rounded-xl border-2 border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition duration-300 text-lg resize-none"
                />
                {questionWordCount > 0 && (
                  <div className="text-sm text-gray-500 mt-2 slide-in">
                    عدد الكلمات: {questionWordCount} - طول مناسب للتحليل
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="border-t border-gray-200 pt-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-700">خيارات متقدمة للتحليل</h3>
                <Button
                  variant="ghost"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-amber-600 hover:text-amber-700 transition"
                >
                  <i className={`fas ${showAdvanced ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </Button>
              </div>
              {showAdvanced && (
                <div className="space-y-4 fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="deepAnalysis"
                        checked={deepAnalysis}
                        onChange={(e) => setDeepAnalysis(e.target.checked)}
                        className="ml-2"
                      />
                      <label htmlFor="deepAnalysis" className="text-gray-700">تحليل عميق بالذكاء الاصطناعي</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="numerologyDetails"
                        checked={numerologyDetails}
                        onChange={(e) => setNumerologyDetails(e.target.checked)}
                        className="ml-2"
                      />
                      <label htmlFor="numerologyDetails" className="text-gray-700">تفاصيل علم الأعداد</label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="contextualInterpretation"
                        checked={contextualInterpretation}
                        onChange={(e) => setContextualInterpretation(e.target.checked)}
                        className="ml-2"
                      />
                      <label htmlFor="contextualInterpretation" className="text-gray-700">تفسير سياقي متقدم</label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button
                onClick={handleCalculate}
                disabled={analysisMutation.isPending}
                className="px-12 py-4 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-105 flex items-center text-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-brain ml-3"></i>
                <span>{analysisMutation.isPending ? "جاري التحليل..." : "احسب الجواب بالذكاء الاصطناعي"}</span>
                {analysisMutation.isPending && <div className="loading-spinner ml-3"></div>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        {showProgress && (
          <Card className="mb-8 border border-amber-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-700 font-medium">جاري التحليل...</span>
                <span className="text-amber-600 font-bold">{progress}%</span>
              </div>
              <Progress value={progress} className="mb-2" />
              <div className="text-sm text-gray-500 typing-animation">{progressText}</div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Alert className="mb-8 border-red-200 bg-red-50">
            <i className="fas fa-exclamation-triangle text-red-600"></i>
            <AlertDescription className="text-red-700">
              <strong className="text-red-800">حدث خطأ في التحليل:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Section */}
        {results && (
          <div id="results" className="space-y-8 fade-in">
            {/* AI Analysis Results */}
            <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-200 ai-glow analysis-card">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl text-emerald-800">
                  <i className="fas fa-robot text-3xl text-emerald-600 mr-4"></i>
                  التحليل الذكي المتقدم
                  <Badge className="ai-badge text-white px-3 py-1 rounded-full text-xs font-bold mr-4">
                    <i className="fas fa-sparkles mr-1"></i>
                    AI
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Card className="border border-emerald-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-emerald-800 mb-3">التفسير الروحي</h4>
                      <p className="text-gray-700 leading-relaxed">{results.aiAnalysis.spiritualInterpretation}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-emerald-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-emerald-800 mb-3">تحليل الأرقام</h4>
                      <p className="text-gray-700 leading-relaxed">{results.aiAnalysis.numericalInsights}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-emerald-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-emerald-800 mb-3">التوجيه والإرشاد</h4>
                      <p className="text-gray-700 leading-relaxed">{results.aiAnalysis.guidance}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-emerald-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-emerald-800 mb-3">تحليل الطاقات</h4>
                      <p className="text-gray-700 leading-relaxed">{results.aiAnalysis.energyAnalysis}</p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Traditional Jafr Results */}
            <Card className="analysis-card border border-amber-200">
              <CardHeader>
                <CardTitle className="text-2xl text-amber-800 flex items-center">
                  <i className="fas fa-calculator ml-3 text-amber-700"></i>
                  نتائج حساب الجُمَّل والأوفاق
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Card className="bg-amber-50 border border-amber-200">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-amber-800 mb-4 flex items-center">
                          <i className="fas fa-user mr-2"></i>
                          تحليل الاسم
                        </h4>
                        <div className="space-y-3">
                          <p><strong>القيمة العددية:</strong> {results.traditionalResults.nameAnalysis.total}</p>
                          <p><strong>القيمة المختزلة:</strong> {reduceToSingleDigit(results.traditionalResults.nameAnalysis.total)}</p>
                          <p><strong>المعنى:</strong> {getBasicMeaning(results.traditionalResults.nameAnalysis.total)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-amber-50 border border-amber-200">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-amber-800 mb-4 flex items-center">
                          <i className="fas fa-female mr-2"></i>
                          تحليل اسم الأم
                        </h4>
                        <div className="space-y-3">
                          <p><strong>القيمة العددية:</strong> {results.traditionalResults.motherAnalysis.total}</p>
                          <p><strong>القيمة المختزلة:</strong> {reduceToSingleDigit(results.traditionalResults.motherAnalysis.total)}</p>
                          <p><strong>المعنى:</strong> {getBasicMeaning(results.traditionalResults.motherAnalysis.total)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="space-y-6">
                    <Card className="bg-amber-50 border border-amber-200">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-amber-800 mb-4 flex items-center">
                          <i className="fas fa-question-circle mr-2"></i>
                          تحليل السؤال
                        </h4>
                        <div className="space-y-3">
                          <p><strong>القيمة العددية:</strong> {results.traditionalResults.questionAnalysis.total}</p>
                          <p><strong>القيمة المختزلة:</strong> {reduceToSingleDigit(results.traditionalResults.questionAnalysis.total)}</p>
                          <p><strong>المعنى:</strong> {getBasicMeaning(results.traditionalResults.questionAnalysis.total)}</p>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-r from-amber-100 to-amber-200 border-2 border-amber-300">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-amber-900 mb-4 flex items-center">
                          <i className="fas fa-calculator mr-2"></i>
                          النتيجة الإجمالية
                        </h4>
                        <div className="space-y-3">
                          <p className="text-lg"><strong>القيمة الإجمالية:</strong> {results.traditionalResults.totalValue}</p>
                          <p className="text-lg"><strong>القيمة المختزلة:</strong> {results.traditionalResults.reducedValue}</p>
                          <p className="text-lg"><strong>حجم الوفق المقترح:</strong> {results.traditionalResults.wafqSize}×{results.traditionalResults.wafqSize}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="mt-8">
                  <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200">
                    <CardContent className="p-6">
                      <h4 className="font-bold text-purple-800 mb-4 flex items-center">
                        <i className="fas fa-th mr-2"></i>
                        الوفق المحسوب ({results.traditionalResults.wafqSize}×{results.traditionalResults.wafqSize})
                      </h4>
                      <div 
                        className="grid gap-2 max-w-md mx-auto"
                        style={{ gridTemplateColumns: `repeat(${results.traditionalResults.wafqSize}, minmax(0, 1fr))` }}
                      >
                        {generateWafqGrid(results.traditionalResults.wafqSize, results.traditionalResults.totalValue)}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Combined Interpretation */}
            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-200 analysis-card">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl text-purple-800">
                  <i className="fas fa-brain text-3xl text-purple-600 mr-4"></i>
                  التفسير المتكامل
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div dangerouslySetInnerHTML={{ __html: results.combinedInterpretation }} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Section */}
        <Card className="mt-16 bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 analysis-card">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-800 flex items-center">
              <i className="fas fa-info-circle ml-3 text-amber-700"></i>
              عن نظام الجفر الذكي المتقدم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-bold text-amber-700 mb-4 flex items-center">
                  <i className="fas fa-cogs mr-2"></i>
                  المنهجية العلمية
                </h4>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  يدمج النظام بين علم الحروف والأعداد التقليدي مع قوة الذكاء الاصطناعي الحديث، مما يوفر تحليلاً شاملاً ودقيقاً للأسئلة والاستفسارات.
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 pr-4">
                  <li>تحليل دقيق للحروف باستخدام حساب الجُمَّل الكبير والصغير</li>
                  <li>استخدام نماذج الذكاء الاصطناعي المتقدمة لتحليل السياق</li>
                  <li>دمج المعرفة التقليدية مع التقنيات الحديثة</li>
                  <li>تفسير شامل يراعي جميع جوانب السؤال</li>
                </ul>
              </div>
              
              <div>
                <h4 className="text-xl font-bold text-amber-700 mb-4 flex items-center">
                  <i className="fas fa-star mr-2"></i>
                  الميزات المتقدمة
                </h4>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <i className="fas fa-robot text-emerald-600 text-xl mt-1 mr-3"></i>
                    <div>
                      <h5 className="font-bold text-gray-800">تحليل ذكي متعدد الطبقات</h5>
                      <p className="text-gray-700">استخدام الذكاء الاصطناعي لفهم السياق والمعاني العميقة</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <i className="fas fa-chart-line text-amber-600 text-xl mt-1 mr-3"></i>
                    <div>
                      <h5 className="font-bold text-gray-800">دقة عالية في التحليل</h5>
                      <p className="text-gray-700">دمج الحسابات التقليدية مع التحليل الذكي للنصوص</p>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <i className="fas fa-language text-purple-600 text-xl mt-1 mr-3"></i>
                    <div>
                      <h5 className="font-bold text-gray-800">فهم سياقي متقدم</h5>
                      <p className="text-gray-700">تحليل معاني الكلمات والجمل في سياقها الصحيح</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
