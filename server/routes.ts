import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { jafrAnalysisRequestSchema, type JafrAnalysisResponse, type TraditionalResults } from "@shared/schema";
import { aiService } from "./services/ai-service";
import { calculateBasicNumerology, calculateWafqSize, reduceToSingleDigit } from "../client/src/lib/jafr-utils";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test API Key Route
  app.post("/api/test-api-key", async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      // Validate request body
      if (!apiKey) {
        return res.status(400).json({ 
          valid: false, 
          success: false,
          message: "مطلوب مفتاح API" 
        });
      }
      
      // Basic validation for API key format
      if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-')) {
        return res.status(400).json({
          valid: false,
          success: false,
          message: "تنسيق مفتاح API غير صالح. يجب أن يبدأ المفتاح بـ 'sk-'"
        });
      }
      
      // Check API key length
      if (apiKey.length < 30) {
        return res.status(400).json({
          valid: false,
          success: false,
          message: "مفتاح API قصير جدًا. يرجى التأكد من نسخ المفتاح بالكامل."
        });
      }
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout
      
      try {
        // Make a test request to OpenRouter API
        const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://jafr-analysis.netlify.app',
            'X-Title': 'Jafr Analysis System'
          },
          signal: controller.signal as any
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || '60';
          return res.status(429).json({
            valid: false,
            success: false,
            message: `تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد ${retryAfter} ثانية.`,
            retryAfter: parseInt(retryAfter, 10)
          });
        }
        
        // Handle successful response
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          
          return res.json({ 
            valid: true, 
            success: true,
            message: "تم التحقق من صحة المفتاح بنجاح",
            data: {
              name: data.name || 'غير معروف',
              credits: data.credits || 0,
              expiresAt: data.expires_at || null,
            }
          });
        } 
        
        // Handle unauthorized/forbidden
        if (response.status === 401 || response.status === 403) {
          return res.status(200).json({ 
            valid: false,
            success: false,
            message: "مفتاح API غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح والمحاولة مرة أخرى." 
          });
        }
        
        // Handle other error responses
        const errorData = await response.json().catch(() => ({}));
        return res.status(200).json({
          valid: false,
          success: false,
          message: errorData.error?.message || `خطأ في الخادم: ${response.statusText}`,
          error: errorData.error || 'حدث خطأ غير متوقع'
        });
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          throw new Error('انتهت مهلة الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
        }
        
        throw error;
      }
      
    } catch (error) {
      console.error('Error validating API key:', error);
      return res.status(200).json({
        valid: false,
        success: false,
        message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء التحقق من صحة المفتاح',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Jafr Analysis Endpoint
  app.post("/api/jafr/analyze", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string || 
                   req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: "مطلوب مفتاح API",
          error: "MISSING_API_KEY"
        });
      }
      
      // Validate request body against schema
      const validation = jafrAnalysisRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: "بيانات الطلب غير صالحة",
          error: validation.error.format()
        });
      }
      
      const { name, mother, question, options } = validation.data;
      
      // Calculate traditional results
      const nameAnalysis = calculateBasicNumerology(name);
      const motherAnalysis = calculateBasicNumerology(mother);
      const questionAnalysis = calculateBasicNumerology(question);
      
      const totalValue = nameAnalysis.total + motherAnalysis.total + questionAnalysis.total;
      const reducedValue = reduceToSingleDigit(totalValue);
      const wafqSize = calculateWafqSize(reducedValue);
      
      const traditionalResults: TraditionalResults = {
        nameAnalysis,
        motherAnalysis,
        questionAnalysis,
        totalValue,
        reducedValue,
        wafqSize
      };
      
      let aiAnalysis = null;
      let combinedInterpretation = null;
      
      // Only perform AI analysis if deepAnalysis is enabled
      if (options?.deepAnalysis !== false) {
        try {
          // Perform AI analysis
          aiAnalysis = await aiService.analyzeJafrContext(
            { name, mother, question, options },
            traditionalResults,
            apiKey
          );
          
          // Generate combined interpretation
          combinedInterpretation = await aiService.generateCombinedInterpretation(
            traditionalResults,
            aiAnalysis,
            apiKey
          );
        } catch (error) {
          console.error('AI Analysis Error:', error);
          // Continue with traditional results even if AI fails
        }
      }
      
      // Return the analysis results
      return res.json({
        success: true,
        message: "تم تحليل البيانات بنجاح",
        data: {
          traditionalResults,
          aiAnalysis,
          combinedInterpretation
        }
      });
      
    } catch (error) {
      console.error('Analysis Error:', error);
      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء معالجة الطلب",
        error: error instanceof Error ? error.message : 'خطأ غير معروف'
      });
    }
  });

  // API Key Validation Endpoint
  app.post("/api/validate-key", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(400).json({ 
          valid: false, 
          message: "مطلوب إدخال مفتاح API في رأس الطلب (X-API-Key)",
          error: "MISSING_API_KEY"
        });
      }
      
      // Test the API key by making a request to OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000) // 10 seconds timeout
      }).catch(error => {
        console.error('Network error validating API key:', error);
        throw new Error('تعذر الاتصال بخادم OpenRouter. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
      });
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '60';
        return res.status(429).json({
          valid: false,
          message: `تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد ${retryAfter} ثانية.`,
          retryAfter: parseInt(retryAfter, 10)
        });
      }
      
      // Handle successful response
      if (response.status === 200) {
        const data = await response.json().catch(() => ({}));
        
        return res.json({ 
          valid: true, 
          message: "تم التحقق من صحة المفتاح بنجاح",
          data: {
            name: data.name || 'غير معروف',
            credits: data.credits || 0,
            expiresAt: data.expires_at || null,
          }
        });
      } 
      
      // Handle unauthorized/forbidden
      if (response.status === 401 || response.status === 403) {
        return res.status(401).json({ 
          valid: false, 
          message: "مفتاح API غير صالح أو منتهي الصلاحية" 
        });
      }
      
      // Handle other error responses
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        valid: false,
        message: errorData.message || `خطأ في الخادم: ${response.statusText}`,
        success: false,
        error: errorData.error || 'حدث خطأ غير متوقع'
      });
    } catch (error) {
      console.error('Error validating API key:', error);
      return res.status(500).json({
        valid: false,
        message: error instanceof Error ? error.message : 'حدث خطأ غير متوقع أثناء التحقق من صحة المفتاح',
        success: false
      });
    }
  });

  // Jafr Analysis Route
  app.post("/api/jafr/analyze", async (req, res) => {
    // Helper function to get basic meaning based on number and type
    const getBasicMeaning = (num: number, type: 'name' | 'mother' | 'birth'): string => {
      // Implementation remains the same as before
      const meanings: Record<string, Record<number, string>> = {
        name: {
          1: 'قائد طبيعي، مستقل، مبتكر',
          2: 'ديبلوماسي، متعاون، حساس',
          3: 'مبدع، معبر، اجتماعي',
          4: 'منظم، عملي، موثوق',
          5: 'مغامر، متعدد المواهب، متكيف',
          6: 'مسؤول، حنون، واقي',
          7: 'باحث، حدسي، حكيم',
          8: 'طموح، منظم، ناجح مادياً',
          9: 'إنساني، كريم، حكيم',
        },
        mother: {
          1: 'أم قوية الشخصية، مستقلة',
          2: 'أم حنونة، عاطفية',
          3: 'أم مبدعة، معبرة',
          4: 'أم منظمة، عملية',
          5: 'أم متكيفة، مرنة',
          6: 'أم حنونة، مسؤولة',
          7: 'أم حكيمة، باحثة',
          8: 'أم طموحة، منظمة',
          9: 'أم حكيمة، كريمة',
        },
        birth: {
          1: 'مسار حياة القيادة والاستقلالية',
          2: 'مسار حياة التعاون والشراكة',
          3: 'مسار حياة التعبير الإبداعي',
          4: 'مسار حياة البناء والاستقرار',
          5: 'مسار حياة الحرية والتغيير',
          6: 'مسار حياة المسؤولية والرعاية',
          7: 'مسار حياة البحث الروحي والفكري',
          8: 'مسار حياة الإنجاز المادي',
          9: 'مسار حياة الإنسانية والعطاء',
        }
      };

      const singleDigit = num % 9 || 9; // Convert to single digit (1-9)
      return meanings[type]?.[singleDigit] || 'لا يوجد وصف متوفر';
    };
    
    try {
      const { name, motherName, birthDate, options = {}, question } = req.body;
      const apiKey = req.headers['x-api-key'] as string;
      
      // Validate required fields
      const missingFields = [];
      if (!name?.trim()) missingFields.push('الاسم');
      if (!motherName?.trim()) missingFields.push('اسم الأم');
      if (!question?.trim()) missingFields.push('السؤال');
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `الحقول التالية مطلوبة: ${missingFields.join('، ')}`
        });
      }
      
      // Validate API key format
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: "مفتاح API مطلوب. يرجى إدخال مفتاح API صالح.",
          error: "MISSING_API_KEY"
        });
      }
      
      if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-') || apiKey.length < 30) {
        return res.status(400).json({
          success: false,
          message: "تنسيق مفتاح API غير صالح. يجب أن يبدأ بـ 'sk-' وأن يكون أطول من 30 حرفًا.",
          error: "INVALID_API_KEY_FORMAT"
        });
      }

      // Test the API key first with a timeout
      let keyTest;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      try {
        // Test the API key by making a request to OpenRouter
        keyTest = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://jafr-analysis.netlify.app',
            'X-Title': 'Jafr Analysis System'
          },
          signal: controller.signal as any
        });
        
        clearTimeout(timeoutId);
        
        // Handle rate limiting
        if (keyTest.status === 429) {
          const retryAfter = keyTest.headers.get('Retry-After') || '60';
          return res.status(429).json({
            success: false,
            message: `تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة بعد ${retryAfter} ثانية.`,
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: parseInt(retryAfter, 10)
          });
        }
        
        // Handle unauthorized/forbidden
        if (keyTest.status === 401 || keyTest.status === 403) {
          return res.status(200).json({
            success: false,
            message: "مفتاح API غير صالح أو منتهي الصلاحية. يرجى التحقق من المفتاح والمحاولة مرة أخرى.",
            error: 'INVALID_API_KEY'
          });
        }
        
        if (!keyTest.ok) {
          const errorData = await keyTest.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'فشل في التحقق من صحة مفتاح API');
        }
        
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          return res.status(504).json({
            success: false,
            message: "انتهت مهلة الاتصال بخادم OpenRouter. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.",
            error: 'CONNECTION_TIMEOUT'
          });
        }
        
        console.error('API key validation error:', error);
        return res.status(200).json({
          success: false,
          message: error.message || "حدث خطأ أثناء التحقق من صحة مفتاح API",
          error: error.error || 'API_KEY_VALIDATION_ERROR'
        });
      }

      // Prepare the analysis result with timestamp
      const startTime = Date.now();
      const result: any = {
        success: true,
        message: "تم تحليل البيانات بنجاح",
        timestamp: new Date().toISOString(),
        data: {
          name: name.trim(),
          motherName: motherName.trim(),
          birthDate: birthDate.trim(),
          basicAnalysis: {},
          advancedAnalysis: {}
        }
      };

      // 1. Basic Numerology Calculation
      try {
        // Helper function to get basic meaning based on number and type
        const getBasicMeaning = (num: number, type: 'name' | 'mother' | 'birth'): string => {
          // This is a simplified version - you might want to expand this with more detailed meanings
          const meanings: Record<string, Record<number, string>> = {
            name: {
              1: 'قائد طبيعي، مستقل، مبتكر',
              2: 'ديبلوماسي، متعاون، حساس',
              3: 'مبدع، معبر، اجتماعي',
              4: 'منظم، عملي، موثوق',
              5: 'مغامر، متعدد المواهب، متكيف',
              6: 'مسؤول، حنون، واقي',
              7: 'باحث، حدسي، حكيم',
              8: 'طموح، منظم، ناجح مادياً',
              9: 'إنساني، كريم، حكيم',
            },
            mother: {
              1: 'أم قوية الشخصية، مستقلة',
              2: 'أم حنونة، عاطفية',
              3: 'أم مبدعة، معبرة',
              4: 'أم منظمة، عملية',
              5: 'أم متكيفة، مرنة',
              6: 'أم حنونة، مسؤولة',
              7: 'أم حكيمة، باحثة',
              8: 'أم طموحة، منظمة',
              9: 'أم حكيمة، كريمة',
            },
            birth: {
              1: 'مسار حياة القيادة والاستقلالية',
              2: 'مسار حياة التعاون والشراكة',
              3: 'مسار حياة التعبير الإبداعي',
              4: 'مسار حياة البناء والاستقرار',
              5: 'مسار حياة الحرية والتغيير',
              6: 'مسار حياة المسؤولية والرعاية',
              7: 'مسار حياة البحث الروحي والفكري',
              8: 'مسار حياة الإنجاز المادي',
              9: 'مسار حياة الإنسانية والعطاء',
            }
          };

          const singleDigit = num % 9 || 9; // Convert to single digit (1-9)
          return meanings[type]?.[singleDigit] || 'لا يوجد وصف متوفر';
        };

        const nameNum = calculateBasicNumerology(name);
        const motherNameNum = calculateBasicNumerology(motherName);
        const birthNum = calculateBasicNumerology(birthDate.replace(/[^0-9]/g, ''));
        
        // Convert to numbers and ensure they are valid
        const nameNumValue = typeof nameNum === 'number' ? nameNum : 0;
        const motherNameNumValue = typeof motherNameNum === 'number' ? motherNameNum : 0;
        const birthNumValue = typeof birthNum === 'number' ? birthNum : 0;
        
        result.data.basicAnalysis = {
          nameNumber: nameNumValue,
          motherNameNumber: motherNameNumValue,
          birthNumber: birthNumValue,
          nameMeaning: getBasicMeaning(nameNumValue, "name"),
          motherNameMeaning: getBasicMeaning(motherNameNumValue, "mother"),
          birthMeaning: getBasicMeaning(birthNumValue, "birth"),
          timestamp: new Date().toISOString()
        };
        
        // Save basic analysis to database if needed
        try {
          // Add your database save logic here if needed
          // Example: await saveAnalysisToDatabase(result.data.basicAnalysis);
        } catch (dbError) {
          console.error("Failed to save to database:", dbError);
          // Continue even if save fails
        }
        
      } catch (error) {
        console.error("Error in basic analysis:", error);
        result.data.basicAnalysis = {
          error: "حدث خطأ في التحليل الأساسي",
          details: error instanceof Error ? error.message : "خطأ غير معروف"
        };
      }

      // 2. Advanced AI Analysis (if enabled)
      if (options.includeAdvancedAnalysis !== false) {
        try {
          const analysisPrompt = `
            قم بتحليل الشخصية بناءً على المعلومات التالية:
            - الاسم: ${name.trim()}
            - اسم الأم: ${motherName.trim()}
            - تاريخ الميلاد: ${birthDate.trim()}
            
            أرجو تحليل شامل للشخصية يشمل:
            1. تحليل الاسم واسم الأم
            2. تحليل تاريخ الميلاد
            3. السمات الشخصية الرئيسية
            4. نقاط القوة والضعف
            5. التحديات والفرص المتوقعة
            6. نصائح وتوصيات مخصصة
            
            يجب أن يكون الرد باللغة العربية الفصحى، وأن يكون تحليلاً مفصلاً ومفيداً.
          `;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
          
          const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://jafr-analysis.netlify.app',
              'X-Title': 'Jafr Analysis System'
            },
            body: JSON.stringify({
              model: "deepseek/deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: `أنت خبير في علم الجفر والأرقام. قم بتحليل الشخصية بناءً على المعلومات المقدمة بطريقة دقيقة ومفصلة.`
                },
                {
                  role: "user",
                  content: analysisPrompt
                }
              ],
              temperature: 0.7,
              max_tokens: 2000,
              top_p: 0.9,
              frequency_penalty: 0.2,
              presence_penalty: 0.2
            }),
            signal: controller.signal as any
          });
          
          clearTimeout(timeoutId);

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;
            
            result.data.advancedAnalysis = {
              analysis: content || "لا تتوفر نتائج",
              model: aiData.model,
              usage: aiData.usage,
              processingTime: `${(Date.now() - startTime) / 1000} ثانية`
            };
          } else {
            const errorData = await aiResponse.json().catch(() => ({}));
            console.error("OpenRouter API error:", errorData);
            result.data.advancedAnalysis = {
              error: "فشل في الحصول على التحليل المتقدم",
              details: errorData.error?.message || `خطأ ${aiResponse.status}: ${aiResponse.statusText}`,
              processingTime: `${(Date.now() - startTime) / 1000} ثانية`
            };
          }
        } catch (aiError) {
          console.error("AI Analysis error:", aiError);
          result.data.advancedAnalysis = {
            error: "حدث خطأ في التحليل المتقدم",
            details: aiError instanceof Error ? aiError.message : "خطأ غير معروف",
            processingTime: `${(Date.now() - startTime) / 1000} ثانية`
          };
        }
      }

      // Add processing time to the response
      result.processingTime = `${(Date.now() - startTime) / 1000} ثانية`;
      res.json(result);
    } catch (error) {
      console.error("Jafr analysis error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "بيانات غير صحيحة",
          errors: error.errors.map(e => e.message)
        });
      }
      
      res.status(500).json({ 
        message: "حدث خطأ في التحليل. يرجى المحاولة مرة أخرى." 
      });
    }
  });

  // Get analysis history
  app.get("/api/jafr/history", async (req, res) => {
    try {
      const analyses = await storage.getUserJafrAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analysis history:", error);
      res.status(500).json({ 
        message: "حدث خطأ في جلب السجل. يرجى المحاولة مرة أخرى." 
      });
    }
  });

  // Get specific analysis
  app.get("/api/jafr/analysis/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "معرف غير صحيح" });
      }

      const analysis = await storage.getJafrAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "التحليل غير موجود" });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ 
        message: "حدث خطأ في جلب التحليل. يرجى المحاولة مرة أخرى." 
      });
    }
  });

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      service: "نظام الجفر الذكي المتقدم",
      timestamp: new Date().toISOString()
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
