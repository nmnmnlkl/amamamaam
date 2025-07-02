import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { 
  jafrAnalysisRequestSchema, 
  type JafrAnalysisResponse, 
  type TraditionalResults,
  type JafrAnalysisRequest,
  type AIAnalysis
} from "@shared/schema";
import { aiService } from "./services/ai-service";

// Import utility functions with proper types
type JafrUtils = {
  calculateBasicNumerology: (input: string) => { result: number; details: any[] };
  calculateWafqSize: (num: number) => number;
  reduceToSingleDigit: (num: number) => number;
  getBasicMeaning: (num: number) => string;
};

// Use dynamic import with type assertion
const jafrUtils = require('../../../client/src/lib/jafr-utils') as JafrUtils;
const { 
  calculateBasicNumerology, 
  calculateWafqSize, 
  reduceToSingleDigit,
  getBasicMeaning 
} = jafrUtils;

import { storage } from "./storage";

// Extend Express types
declare global {
  namespace Express {
    interface Request {
      apiKey?: string;
    }
  }
}

// Type Definitions
interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: any;
  [key: string]: any; // Allow additional properties
}

interface AnalysisRequest extends Omit<JafrAnalysisRequest, 'options'> {
  birthDate?: string;
  options?: {
    deepAnalysis?: boolean;
    numerologyDetails?: boolean;
    contextualInterpretation?: boolean;
  };
  [key: string]: any; // Allow additional properties
}

// Helper Functions
function handleError(res: Response, error: unknown, message: string = 'An error occurred'): Response {
  console.error('Error:', error);
  const errorMessage = error instanceof Error ? error.message : String(error);
  return res.status(500).json({
    success: false,
    message,
    error: errorMessage,
    ...(process.env.NODE_ENV !== 'production' && { stack: error instanceof Error ? error.stack : undefined })
  });
}

function validateApiKey(apiKey: string | undefined): { valid: boolean; message: string } {
  if (!apiKey) {
    return { valid: false, message: 'API key is required' };
  }
  if (!apiKey.startsWith('sk-')) {
    return { valid: false, message: 'Invalid API key format' };
  }
  return { valid: true, message: 'API key is valid' };
}

// Helper function to handle rate limiting
function handleRateLimit(res: Response, retryAfter: string): Response {
  const retryAfterSeconds = parseInt(retryAfter, 10) || 60;
  res.setHeader('Retry-After', retryAfterSeconds.toString());
  return res.status(429).json({
    success: false,
    message: `لقد تجاوزت الحد المسموح من الطلبات. يرجى المحاولة بعد ${retryAfterSeconds} ثانية`,
    error: 'RATE_LIMIT_EXCEEDED',
    retryAfter: retryAfterSeconds
  });
}

export function registerRoutes(app: Express): Server {
  // Initialize server with default port if not provided
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const server = createServer(app);
  
  // Middleware
  app.use((req, res, next) => {
    // Parse API key from headers
    const apiKey = req.headers['x-api-key'] as string || 
                  (req.headers['authorization'] as string)?.replace('Bearer ', '');
    req.apiKey = apiKey;
    next();
  });
  
  // Helper function to send consistent API responses
  const sendResponse = (res: Response, status: number, data: ApiResponse): Response => {
    return res.status(status).json(data);
  };

  // Jafr Analysis Endpoint
  app.post("/api/jafr/analyze", async (req: Request, res: Response) => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Validate request body
      const validation = jafrAnalysisRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          success: false,
          message: 'بيانات غير صالحة',
          errors: validation.error.errors
        });
      }
      
      const { name, mother, question, options } = validation.data;
      
      // Set up timeout for the request
      const controller = new AbortController();
      const timeoutMs = 30000; // 30 seconds timeout
      timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);
      
      // Calculate traditional results
      const cleanBirthDate = (req.body.birthDate || '').toString().replace(/[^0-9]/g, '');
      
      // Calculate numerology values with error handling
      let nameNum = 0;
      let motherNum = 0;
      let birthNum = 0;
      let questionNum = 0;
      
      try {
        // Calculate basic numerology values
        nameNum = name ? Number(calculateBasicNumerology(name)) : 0;
        motherNum = mother ? Number(calculateBasicNumerology(mother)) : 0;
        birthNum = cleanBirthDate ? Number(calculateBasicNumerology(cleanBirthDate)) : 0;
        questionNum = question ? Number(calculateBasicNumerology(question)) || 0 : 0;
      } catch (error) {
        console.error('Error in numerology calculation:', error);
        // Continue with default values if calculation fails
      }
      
      // Calculate derived values with fallbacks
      const totalValue = (nameNum || 0) + (motherNum || 0) + (birthNum || 0);
      const reducedValue = reduceToSingleDigit(totalValue) || 0;
      const wafqSize = calculateWafqSize(reducedValue) || 0;
      
      // Create traditional results object with all calculated values and proper typing
      const traditionalResults: TraditionalResults = {
        nameAnalysis: {
          total: nameNum || 0,
          details: name ? calculateBasicNumerology(name).details : []
        },
        motherAnalysis: {
          total: motherNum || 0,
          details: mother ? calculateBasicNumerology(mother).details : []
        },
        questionAnalysis: {
          total: questionNum || 0,
          details: question ? calculateBasicNumerology(question).details : []
        },
        totalValue,
        reducedValue,
        wafqSize
      };
      
      // Create additional metadata for the response
      const analysisMetadata = {
        nameMeaning: getBasicMeaning(nameNum || 0),
        motherMeaning: getBasicMeaning(motherNum || 0),
        birthMeaning: getBasicMeaning(birthNum || 0),
        questionMeaning: getBasicMeaning(questionNum || 0),
        wafqMeaning: getBasicMeaning(wafqSize),
        timestamp: new Date().toISOString()
      };

      // Only perform AI analysis if deepAnalysis is enabled (defaults to true if not specified)
      const shouldPerformDeepAnalysis = options?.deepAnalysis !== false;
      let aiAnalysis: AIAnalysis | null = null;
      
      if (shouldPerformDeepAnalysis) {
        try {
          // Call AI service for deep analysis using analyzeJafrContext
          const analysisRequest: JafrAnalysisRequest = {
            name: name || '',
            mother: mother || '',
            question: question || '',
            options: {
              deepAnalysis: options?.deepAnalysis ?? true,
              numerologyDetails: options?.numerologyDetails ?? true,
              contextualInterpretation: options?.contextualInterpretation ?? true
            }
          };
          
          // Make sure traditionalResults matches the expected type
          const analysisResults = await aiService.analyzeJafrContext(
            analysisRequest,
            traditionalResults,
            req.apiKey
          );
          
          // Ensure the response matches the AIAnalysis type
          if (analysisResults) {
            // Map the response to match the AIAnalysis schema
            aiAnalysis = {
              spiritualInterpretation: analysisResults.spiritualInterpretation || 'لا يوجد تفسير روحي متوفر',
              numericalInsights: analysisResults.numericalInsights || 'لا توجد رؤى عددية متوفرة',
              guidance: 'guidance' in analysisResults ? analysisResults.guidance : 'لا يوجد توجيه متوفر',
              energyAnalysis: 'energyAnalysis' in analysisResults ? analysisResults.energyAnalysis : 'لا يوجد تحليل للطاقة متوفر'
            };
          } else {
            // Provide default values if analysisResults is undefined
            aiAnalysis = {
              spiritualInterpretation: 'لا يوجد تفسير روحي متوفر',
              numericalInsights: 'لا توجد رؤى عددية متوفرة',
              guidance: 'لا يوجد توجيه متوفر',
              energyAnalysis: 'لا يوجد تحليل للطاقة متوفر'
            };
          }
        } catch (error) {
          console.error('AI analysis error:', error);
          // Continue with traditional results even if AI analysis fails
        }
      }
      
      // Ensure we have a valid AI analysis object
      const defaultAIAnalysis: AIAnalysis = {
        spiritualInterpretation: 'لا يوجد تفسير روحي متوفر',
        numericalInsights: 'لا توجد رؤى عددية متوفرة',
        guidance: 'لا يوجد توجيه متوفر',
        energyAnalysis: 'لا يوجد تحليل للطاقة متوفر'
      };

      // Create the response data matching JafrAnalysisResponse type exactly
      const responseData: JafrAnalysisResponse = {
        traditionalResults,
        aiAnalysis: aiAnalysis || defaultAIAnalysis,
        combinedInterpretation: aiAnalysis 
          ? `تفسير روحي: ${aiAnalysis.spiritualInterpretation || ''}\n\nرؤية عددية: ${aiAnalysis.numericalInsights || ''}`
          : 'لا يوجد تحليل متوفر'
      };
      
      // Add metadata to the response object (not part of JafrAnalysisResponse)
      const responseWithMetadata = {
        ...responseData,
        analysisId: Math.random().toString(36).substring(2, 15),
        ...analysisMetadata
      };
      
      // Create the API response with proper typing
      const apiResponse: ApiResponse = {
        success: true,
        message: 'تم تحليل البيانات بنجاح',
        data: responseWithMetadata,
        timestamp: new Date().toISOString()
      };
      
      return res.status(200).json(apiResponse);
      
    } catch (error) {
      console.error('Error in Jafr analysis:', error);
      return handleError(res, error, 'حدث خطأ في تحليل الجفر');
    } finally {
      // Clear the timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });
  
  // API Key Validation Endpoint
  app.post("/api/validate-key", async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      const validation = validateApiKey(apiKey);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
          valid: false
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'مفتاح API صالح',
        valid: true
      });
      
    } catch (error) {
      console.error('API key validation error:', error);
      return handleError(res, error, 'فشل في التحقق من صحة مفتاح API');
    }
  });
  
  // Health Check Endpoint
  app.get("/health", (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      message: "Service is healthy",
      data: {
        status: "healthy",
        timestamp: new Date().toISOString()
      }
    });
  });
  
  // 404 Handler
  app.use((_req: Request, res: Response) => {
    return res.status(404).json({
      success: false,
      message: "الرابط غير موجود",
      error: "NOT_FOUND"
    });
  });
  
  // Global Error Handler
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', error);
    return handleError(res, error, 'حدث خطأ غير متوقع');
  });
  
  // Start the server
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
  
  return server;
}
