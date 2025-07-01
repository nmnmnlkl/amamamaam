import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "your-api-key-here",
  defaultHeaders: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Jafr Analysis System"
  },
});

// Function to calculate Abjad (Jafr) value of a letter
function getAbjadValue(letter) {
  const abjadMap = {
    'ا': 1, 'أ': 1, 'إ': 1, 'آ': 1, 'ء': 1,
    'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'ة': 5, 'و': 6,
    'ز': 7, 'ح': 8, 'ط': 9, 'ي': 10, 'ى': 10,
    'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60,
    'ع': 70, 'ف': 80, 'ص': 90, 'ق': 100, 'ر': 200,
    'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600, 'ذ': 700,
    'ض': 800, 'ظ': 900, 'غ': 1000
  };
  
  return abjadMap[letter] || 0;
}

// Function to calculate total numerical value of a name
function calculateNameValue(name) {
  let total = 0;
  for (const char of name) {
    total += getAbjadValue(char);
  }
  return total;
}

// Function to reduce number to a single digit
function reduceToSingleDigit(num) {
  while (num > 9) {
    num = num.toString().split('').reduce((sum, digit) => sum + parseInt(digit), 0);
  }
  return num;
}

async function analyzeJafr(name, motherName, question) {
  // Calculate numerical values
  const nameValue = calculateNameValue(name);
  const motherNameValue = calculateNameValue(motherName);
  const questionValue = calculateNameValue(question);
  const totalValue = nameValue + motherNameValue + questionValue;
  const reducedValue = reduceToSingleDigit(totalValue);

  // Prepare prompt for AI analysis
  const prompt = `
  قم بتحليل الجفر التالي:
  - الاسم: ${name} (قيمة عددية: ${nameValue})
  - اسم الأم: ${motherName} (قيمة عددية: ${motherNameValue})
  - السؤال: ${question} (قيمة عددية: ${questionValue})
  - المجموع الكلي: ${totalValue}
  - الرقم المختزل: ${reducedValue}

  قدم تحليلاً شاملاً يشمل:
  1. تفسير القيم العددية
  2. العلاقة بين الأرقام والمعاني الروحية
  3. التوجيهات المستخلصة من هذه الأرقام
  4. التوقعات المحتملة بناءً على هذه الحسابات
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-4-maverick:free",
      messages: [
        {
          role: "system",
          content: "أنت خبير في علم الجفر والتحليل العددي الإسلامي. قم بتحليل الأرقام وتقديم تفسيرات واضحة ومفيدة."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    return {
      name,
      motherName,
      question,
      values: {
        nameValue,
        motherNameValue,
        questionValue,
        totalValue,
        reducedValue
      },
      analysis: completion.choices[0].message.content
    };
  } catch (error) {
    console.error('Error in Jafr analysis:', error);
    throw new Error('حدث خطأ أثناء تحليل الجفر');
  }
}

// Example usage
async function main() {
  try {
    const result = await analyzeJafr(
      "محمد",  // Name
      "فاطمة",  // Mother's name
      "ما هو مستقبلي المهني؟"  // Question
    );
    
    console.log("نتيجة تحليل الجفر:");
    console.log("-------------------");
    console.log("الاسم:", result.name);
    console.log("اسم الأم:", result.motherName);
    console.log("السؤال:", result.question);
    console.log("\nالقيم العددية:");
    console.log("- قيمة الاسم:", result.values.nameValue);
    console.log("- قيمة اسم الأم:", result.values.motherNameValue);
    console.log("- قيمة السؤال:", result.values.questionValue);
    console.log("- المجموع الكلي:", result.values.totalValue);
    console.log("- الرقم المختزل:", result.values.reducedValue);
    console.log("\nالتحليل:");
    console.log(result.analysis);
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the analysis
main();
