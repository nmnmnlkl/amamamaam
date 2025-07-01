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
      
      if (!apiKey || !apiKey.trim()) {
        return res.status(400).json({ 
          message: "مفتاح API مطلوب",
          success: false 
        });
      }

      // Test the API key with a simple request to OpenRouter
      const testRequest = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://jafr-analyzer.com",
          "X-Title": "نظام الجفر الذكي"
        }
      });

      if (testRequest.ok) {
        res.json({ 
          message: "مفتاح API صحيح وجاهز للاستخدام",
          success: true 
        });
      } else {
        const errorData = await testRequest.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || "مفتاح API غير صحيح أو غير مفعل";
        
        console.error("API key test failed:", errorMessage);
        res.status(400).json({ 
          message: errorMessage,
          success: false 
        });
      }
      
    } catch (error) {
      console.error("API key test error:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      res.status(500).json({ 
        message: `حدث خطأ في التحقق من مفتاح API: ${errorMessage}`,
        success: false,
        error: errorMessage
      });
    }
  });

  // Jafr Analysis Route
  app.post("/api/jafr/analyze", async (req, res) => {
    try {
      // Validate request body
      const validatedData = jafrAnalysisRequestSchema.parse(req.body);
      
      // Perform traditional calculations
      const traditionalResults: TraditionalResults = {
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

      // Get AI analysis if deep analysis is enabled
      let aiAnalysis;
      if (validatedData.options?.deepAnalysis !== false) {
        // Use the API key from request body if provided
        const apiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
        aiAnalysis = await aiService.analyzeJafrContext(validatedData, traditionalResults, apiKey);
      } else {
        // Fallback basic analysis
        aiAnalysis = {
          spiritualInterpretation: "تم تعطيل التحليل العميق. النتائج مبنية على الحسابات التقليدية فقط.",
          numericalInsights: `القيمة الإجمالية ${traditionalResults.totalValue} تشير إلى معاني مهمة في حياتك.`,
          guidance: "استخدم النتائج العددية للتأمل والتفكير في سؤالك.",
          energyAnalysis: "الطاقات محايدة، اعتمد على حدسك الشخصي."
        };
      }

      // Generate combined interpretation
      const apiKey = req.body.apiKey || process.env.OPENROUTER_API_KEY;
      const combinedInterpretation = await aiService.generateCombinedInterpretation(
        traditionalResults, 
        aiAnalysis,
        apiKey
      );

      // Save analysis to database
      try {
        const analysisData = {
          userId: null, // For now, no user authentication
          name: validatedData.name,
          mother: validatedData.mother,
          question: validatedData.question,
          totalValue: traditionalResults.totalValue,
          reducedValue: traditionalResults.reducedValue,
          wafqSize: traditionalResults.wafqSize,
          nameAnalysis: traditionalResults.nameAnalysis,
          motherAnalysis: traditionalResults.motherAnalysis,
          questionAnalysis: traditionalResults.questionAnalysis,
          traditionalResults: traditionalResults,
          aiAnalysis: aiAnalysis,
          combinedInterpretation: combinedInterpretation,
          aiEnabled: validatedData.options?.deepAnalysis !== false
        };

        await storage.saveJafrAnalysis(analysisData);
      } catch (dbError) {
        console.warn("Failed to save analysis to database:", dbError);
        // Continue without failing the request
      }

      const response: JafrAnalysisResponse = {
        traditionalResults,
        aiAnalysis,
        combinedInterpretation
      };

      res.json(response);
      
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
