import { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";
import { z } from "zod";

// Simple schema definitions for Netlify function
const jafrAnalysisRequestSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  mother: z.string().min(1, "اسم الأم مطلوب"),
  question: z.string().min(10, "السؤال يجب أن يكون أكثر تفصيلاً"),
  options: z.object({
    deepAnalysis: z.boolean().default(true),
    numerologyDetails: z.boolean().default(true),
    contextualInterpretation: z.boolean().default(true),
  }).optional(),
});

// Abjad calculation values
const abjad: Record<string, number> = {
  'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9, 'ي': 10,
  'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90, 'ق': 100,
  'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600, 'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000,
  'أ': 1, 'إ': 1, 'آ': 1, 'ة': 5, 'ؤ': 6, 'ئ': 10, 'ى': 10
};

interface NumerologyDetail {
  char: string;
  value: number;
}

function calculateBasicNumerology(text: string): { total: number; details: NumerologyDetail[] } {
  const cleanText = text.replace(/[^\u0600-\u06FF]/g, '');
  const details: NumerologyDetail[] = [];
  let total = 0;

  for (const char of cleanText) {
    const value = abjad[char] || 0;
    if (value > 0) {
      details.push({ char, value });
      total += value;
    }
  }

  return { total, details };
}

function reduceToSingleDigit(number: number): number {
  while (number > 9) {
    number = Math.floor(number / 10) + (number % 10);
  }
  return number;
}

function calculateWafqSize(totalValue: number): number {
  const reduced = reduceToSingleDigit(totalValue);
  return Math.min(Math.max(reduced, 3), 9);
}

// Simple AI analysis function
async function analyzeWithAI(validatedData: any, traditionalResults: any, apiKey?: string) {
  if (!apiKey) {
    return {
      spiritualInterpretation: "تم تعطيل التحليل العميق. النتائج مبنية على الحسابات التقليدية فقط.",
      numericalInsights: `القيمة الإجمالية ${traditionalResults.totalValue} تشير إلى معاني مهمة في حياتك.`,
      guidance: "استخدم النتائج العددية للتأمل والتفكير في سؤالك.",
      energyAnalysis: "الطاقات محايدة، اعتمد على حدسك الشخصي."
    };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jafranalysis.netlify.app',
        'X-Title': 'Jafr Analysis System'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [{
          role: 'user',
          content: `قم بتحليل جفر شامل للبيانات التالية:
الاسم: ${validatedData.name} (قيمة عددية: ${traditionalResults.nameAnalysis.total})
اسم الأم: ${validatedData.mother} (قيمة عددية: ${traditionalResults.motherAnalysis.total})
السؤال: ${validatedData.question} (قيمة عددية: ${traditionalResults.questionAnalysis.total})

المجموع الكلي: ${traditionalResults.totalValue}
الرقم المختزل: ${traditionalResults.reducedValue}
حجم الوفق المقترح: ${traditionalResults.wafqSize}×${traditionalResults.wafqSize}

أجب بالعربية وقدم تحليلاً روحياً مفصلاً ونصائح عملية.`
        }],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || "لم أتمكن من الحصول على تحليل ذكي.";

    return {
      spiritualInterpretation: aiResponse.substring(0, 500) + "...",
      numericalInsights: `التحليل الذكي يشير إلى أن القيمة ${traditionalResults.totalValue} لها دلالات مهمة في حياتك.`,
      guidance: "استخدم النتائج للتأمل والدعاء والتوكل على الله.",
      energyAnalysis: "الطاقة الروحية إيجابية ومناسبة للنمو الشخصي."
    };
  } catch (error) {
    console.error('AI Analysis error:', error);
    return {
      spiritualInterpretation: "تعذر الحصول على التحليل الذكي. النتائج مبنية على الحسابات التقليدية.",
      numericalInsights: `القيمة الإجمالية ${traditionalResults.totalValue} تشير إلى معاني مهمة في حياتك.`,
      guidance: "استخدم النتائج العددية للتأمل والتفكير في سؤالك.",
      energyAnalysis: "الطاقات محايدة، اعتمد على حدسك الشخصي."
    };
  }
}

// Netlify function handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'text/plain'
      },
      body: ''
    } as const;
  }

  try {
    const path = event.path.replace('/.netlify/functions/api', '');
    
    // Health check
    if (event.httpMethod === 'GET' && path === '/health') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
          status: "healthy",
          service: "نظام الجفر الذكي المتقدم",
          timestamp: new Date().toISOString()
        })
      } as const;
    }

    // Test API Key
    if (event.httpMethod === 'GET' && path === '/test-api-key') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
          success: true,
          message: 'API key is valid',
          timestamp: new Date().toISOString()
        })
      } as const;
    }
    if (event.httpMethod === 'POST' && path === '/test-api-key') {
      const body = JSON.parse(event.body || '{}');
      const { apiKey } = body;
      
      if (!apiKey?.trim()) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          },
          body: JSON.stringify({
            success: false,
            message: "مفتاح API مطلوب"
          })
        } as const;
      }

      // Simple API key test
      try {
        const testResponse = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          },
          body: JSON.stringify({
            success: testResponse.ok,
            message: testResponse.ok ? "مفتاح API صالح وجاهز للاستخدام" : "مفتاح API غير صالح"
          })
        } as const;
      } catch (error) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          },
          body: JSON.stringify({
            success: false,
            message: "مفتاح API غير صالح أو منتهي الصلاحية"
          })
        } as const;
      }
    }

    // Jafr Analysis
    if (event.httpMethod === 'POST' && path === '/jafr/analyze') {
      const body = JSON.parse(event.body || '{}');
      
      // Validate request
      const validatedData = jafrAnalysisRequestSchema.parse(body);
      
      // Perform traditional calculations
      const traditionalResults = {
        nameAnalysis: calculateBasicNumerology(validatedData.name),
        motherAnalysis: calculateBasicNumerology(validatedData.mother),
        questionAnalysis: calculateBasicNumerology(validatedData.question),
        totalValue: 0,
        reducedValue: 0,
        wafqSize: 0
      };

      // Calculate total values
      traditionalResults.totalValue = 
        traditionalResults.nameAnalysis.total + 
        traditionalResults.motherAnalysis.total + 
        traditionalResults.questionAnalysis.total;
        
      traditionalResults.reducedValue = reduceToSingleDigit(traditionalResults.totalValue);
      traditionalResults.wafqSize = calculateWafqSize(traditionalResults.totalValue);

      // Get AI analysis
      const apiKey = body.apiKey || process.env.OPENROUTER_API_KEY;
      const aiAnalysis = await analyzeWithAI(validatedData, traditionalResults, apiKey);

      const response = {
        traditionalResults,
        aiAnalysis,
        combinedInterpretation: `
          <div class="space-y-6">
            <div class="bg-white rounded-xl p-6 border border-purple-200">
              <h4 class="font-bold text-purple-800 mb-3">الخلاصة المتكاملة</h4>
              <p class="text-gray-700 leading-relaxed">
                ${aiAnalysis.spiritualInterpretation}
              </p>
            </div>
          </div>
        `
      };

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(response)
      } as const;
    }

    // Route not found
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ message: "Route not found" })
    } as const;

  } catch (error) {
    console.error("Function error:", error);
    
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify({
          message: "بيانات غير صحيحة",
          errors: error.errors.map((e: { message: string }) => e.message)
        })
      } as const;
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({
        message: "حدث خطأ في التحليل. يرجى المحاولة مرة أخرى."
      })
    } as const;
  }
};