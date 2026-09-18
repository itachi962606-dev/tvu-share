/**
 * TVU Books & Materials - NOVA AI Multi-Provider Engine for Vercel Serverless
 * Uses the official Google Gen AI SDK (@google/genai) and Groq SDK.
 * Handles English, Tamil, and Tanglish naturally with tool calling and strict user data isolation.
 * Supports academic books, complete regulation syllabuses, and approved question papers.
 */

import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import {
  searchAvailableBooks,
  getUserOrders,
  getUserWishlist,
  getSellerBooks,
  getSellerOrders,
  searchAcademicSyllabus,
  searchApprovedQuestionPapers,
  getPlatformFaq
} from './firestore-tools.js';

const SYSTEM_INSTRUCTION = `You are NOVA 🤖, the official AI Assistant for "TVU Books & Materials", the academic textbook & study material marketplace for Thiruvalluvar University students and faculty.

Core Responsibilities & Capabilities:
1. Multilingual Natural Communication:
   - You MUST understand and reply naturally in English, Tamil (தமிழ்), and Tanglish (Tamil in English script like "Java book iruka?", "En order status ena?", "Epdi book sell panradhu?", "Computer science syllabus download epdi?").
   - Match the user's language and tone seamlessly. If the user speaks Tanglish, reply helpfully in friendly Tanglish/English. If Tamil script is used, reply in Tamil.

2. Academic Resources (Syllabus & Question Papers):
   - Guide students to the "📥 Download Syllabus" portal (download-syllabus.html).
   - Help students find department-based complete regulation syllabus PDFs (all semesters).
   - Help students find approved previous year semester exam question papers.
   - Explain that student question paper submissions undergo administrator verification before publication.
   - Never display or mention pending or rejected uploads.

3. Student & Customer Assistance:
   - Help users search available academic textbooks, course materials, and reference books across all departments.
   - Explain pricing, discounts, and availability.
   - Explain how Cash on Delivery (COD) works on campus.
   - Check customer's own orders and status (when authenticated).
   - Check customer's saved wishlist (when authenticated).

4. Seller Hub Assistance:
   - Explain how to register as a seller, list textbooks, upload cover photos, set discounts, and update stock.
   - Check seller's own listed books and incoming orders from students (when authenticated).

5. Strict Data Integrity & Grounding:
   - Always use the provided tools to query real Firestore data.
   - Never invent or fabricate book titles, order IDs, prices, or inventory.
   - If an unauthenticated user asks for private data (e.g., "my orders", "en order ena", "my wishlist"), explain politely that they need to sign in with their Google account first.

6. Formatting:
   - Use clear formatting with bullet points and bold highlights for readability.`;

// Tool declarations for Google Gen AI SDK (@google/genai)
const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: 'searchAvailableBooks',
    description: 'Search available university textbooks and study materials in the TVU inventory by keyword, subject, or category.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search term e.g. "Java", "Python", "Physics", "DBMS", "Accounting"' },
        category: { type: 'STRING', description: 'Category filter e.g. "Computer Science", "Mathematics", "Science", "Commerce", "Management", "Arts", "Study Materials"' },
        maxPrice: { type: 'NUMBER', description: 'Optional maximum price filter in INR' }
      }
    }
  },
  {
    name: 'searchAcademicSyllabus',
    description: 'Search complete regulation syllabus PDF for an academic department (all semesters combined).',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: { type: 'STRING', description: 'Department name e.g. "Computer Science", "Mathematics", "Commerce", "Physics", "English"' }
      }
    }
  },
  {
    name: 'searchApprovedQuestionPapers',
    description: 'Search approved and published university previous year exam question papers by department or subject.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: { type: 'STRING', description: 'Department name e.g. "Computer Science", "Commerce"' },
        subject: { type: 'STRING', description: 'Subject name e.g. "Data Structures", "Java", "Financial Accounting"' }
      }
    }
  },
  {
    name: 'getUserOrders',
    description: 'Retrieve the authenticated customer\'s own order history and order statuses.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getUserWishlist',
    description: 'Retrieve the authenticated customer\'s saved wishlist books.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getSellerBooks',
    description: 'Retrieve the books listed by the authenticated seller in the TVU Seller Hub.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getSellerOrders',
    description: 'Retrieve incoming student purchase orders for the authenticated seller.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'getPlatformFaq',
    description: 'Retrieve platform rules, how to buy with COD, syllabus download guides, or how to sell books.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Topic e.g. "syllabus", "question papers", "buying", "selling", "cod"' }
      }
    }
  }
];

// Tool declarations for Groq
const GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'searchAvailableBooks',
      description: 'Search available university textbooks and study materials.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term' },
          category: { type: 'string', description: 'Category' },
          maxPrice: { type: 'number', description: 'Max price' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchAcademicSyllabus',
      description: 'Search department complete syllabus PDF.',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Department name' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchApprovedQuestionPapers',
      description: 'Search approved previous year question papers.',
      parameters: {
        type: 'object',
        properties: {
          department: { type: 'string', description: 'Department name' },
          subject: { type: 'string', description: 'Subject name' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getUserOrders',
      description: 'Retrieve authenticated user orders.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getUserWishlist',
      description: 'Retrieve authenticated user wishlist.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSellerBooks',
      description: 'Retrieve seller books.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getSellerOrders',
      description: 'Retrieve seller orders.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPlatformFaq',
      description: 'Retrieve platform FAQ.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic' }
        }
      }
    }
  }
];

/**
 * Tool dispatcher helper
 */
async function executeToolCall(toolName, args, verifiedUid) {
  let structuredData = { books: null, orders: null, resources: null };
  let result = null;

  switch (toolName) {
    case 'searchAvailableBooks':
      result = await searchAvailableBooks(args || {});
      if (result && result.books && result.books.length > 0) {
        structuredData.books = result.books;
      }
      break;

    case 'searchAcademicSyllabus':
      result = await searchAcademicSyllabus(args || {});
      break;

    case 'searchApprovedQuestionPapers':
      result = await searchApprovedQuestionPapers(args || {});
      break;

    case 'getUserOrders':
      result = await getUserOrders({ verifiedUid });
      if (result && result.orders && result.orders.length > 0) {
        structuredData.orders = result.orders;
      }
      break;

    case 'getUserWishlist':
      result = await getUserWishlist({ verifiedUid });
      if (result && result.wishlist && result.wishlist.length > 0) {
        structuredData.books = result.wishlist;
      }
      break;

    case 'getSellerBooks':
      result = await getSellerBooks({ verifiedUid });
      if (result && result.books && result.books.length > 0) {
        structuredData.books = result.books;
      }
      break;

    case 'getSellerOrders':
      result = await getSellerOrders({ verifiedUid });
      if (result && result.orders && result.orders.length > 0) {
        structuredData.orders = result.orders;
      }
      break;

    case 'getPlatformFaq':
      result = getPlatformFaq(args || {});
      break;

    default:
      result = { error: `Tool ${toolName} not found` };
  }

  return { result, structuredData };
}

/**
 * Process Chat with Google Gen AI SDK (@google/genai)
 */
async function processWithGemini(userMessage, chatHistory = [], verifiedUser = null, apiKey, modelName) {
  const ai = new GoogleGenAI({ apiKey });
  const preferredModel = modelName || 'gemini-3.6-flash';
  const fallbackModels = [preferredModel, 'gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-3.7-flash']
    .filter((v, i, a) => a.indexOf(v) === i); // unique

  const verifiedUid = verifiedUser ? verifiedUser.uid : null;
  let structuredDataOut = { books: null, orders: null };
  let contextInfo = [];

  const lowerQuery = (userMessage || '').toLowerCase();

  // 1. Context grounding: Query live database based on student query
  if (lowerQuery.includes('order') || lowerQuery.includes('track') || lowerQuery.includes('booking')) {
    if (verifiedUid) {
      try {
        const orderResult = await getUserOrders({ verifiedUid });
        if (orderResult && orderResult.orders && orderResult.orders.length > 0) {
          structuredDataOut.orders = orderResult.orders;
          contextInfo.push(`[Customer's Orders: ${JSON.stringify(orderResult.orders)}]`);
        } else {
          contextInfo.push(`[Customer has 0 active orders]`);
        }
      } catch (e) {}
    } else {
      contextInfo.push(`[Note: User is not logged in. If they ask about personal orders, remind them to sign in.]`);
    }
  }

  if (lowerQuery.includes('wishlist') || lowerQuery.includes('saved')) {
    if (verifiedUid) {
      try {
        const wishResult = await getUserWishlist({ verifiedUid });
        if (wishResult && wishResult.wishlist && wishResult.wishlist.length > 0) {
          structuredDataOut.books = wishResult.wishlist;
          contextInfo.push(`[Customer's Saved Wishlist: ${JSON.stringify(wishResult.wishlist)}]`);
        }
      } catch (e) {}
    }
  }

  if (lowerQuery.includes('syllabus') || lowerQuery.includes('curriculum') || lowerQuery.includes('regulation')) {
    try {
      const sylResult = await searchAcademicSyllabus({ department: userMessage });
      if (sylResult && sylResult.syllabuses && sylResult.syllabuses.length > 0) {
        contextInfo.push(`[Available Syllabuses: ${JSON.stringify(sylResult.syllabuses)}]`);
      }
      contextInfo.push(`[Syllabus Portal Link: /download-syllabus.html]`);
    } catch (e) {}
  }

  if (lowerQuery.includes('question paper') || lowerQuery.includes('pyq') || lowerQuery.includes('exam paper')) {
    try {
      const qpResult = await searchApprovedQuestionPapers({ department: userMessage });
      if (qpResult && qpResult.questionPapers && qpResult.questionPapers.length > 0) {
        contextInfo.push(`[Approved Exam Question Papers: ${JSON.stringify(qpResult.questionPapers)}]`);
      }
      contextInfo.push(`[Question Paper Portal: download-syllabus.html]`);
    } catch (e) {}
  }

  // Search books for book search / price queries
  if (!lowerQuery.includes('syllabus') && !lowerQuery.includes('question paper')) {
    try {
      const bookResult = await searchAvailableBooks({ query: userMessage });
      if (bookResult && bookResult.books && bookResult.books.length > 0) {
        structuredDataOut.books = bookResult.books;
        contextInfo.push(`[Inventory Books Found: ${JSON.stringify(bookResult.books)}]`);
      }
    } catch (e) {}
  }

  // FAQ context
  const faqData = getPlatformFaq({ topic: userMessage });
  if (faqData && faqData.guidelines) {
    contextInfo.push(`[Platform Guide: ${JSON.stringify(faqData.guidelines)}]`);
  }

  const userContextStr = contextInfo.length > 0 ? `\n\n--- Live Context & Inventory Data ---\n${contextInfo.join('\n')}` : '';

  const promptText = verifiedUser 
    ? `[User Status: Authenticated as ${verifiedUser.name || 'Student'} (UID: ${verifiedUser.uid}, Email: ${verifiedUser.email})]${userContextStr}\n\nUser Question: ${userMessage}`
    : `[User Status: Guest / Unauthenticated]${userContextStr}\n\nUser Question: ${userMessage}`;

  const contents = [
    ...chatHistory.slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || '' }]
    })),
    {
      role: 'user',
      parts: [{ text: promptText }]
    }
  ];

  let response = null;
  let lastError = null;

  for (const modelToTry of fallbackModels) {
    try {
      response = await ai.models.generateContent({
        model: modelToTry,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });
      break;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelToTry} attempt failed:`, err.message);
    }
  }

  if (!response) {
    throw lastError || new Error("Failed to generate response with Gemini AI.");
  }

  return {
    reply: response.text || "Here is the information from TVU Books & Materials.",
    books: structuredDataOut.books,
    orders: structuredDataOut.orders
  };
}

/**
 * Process Chat with Groq API
 */
async function processWithGroq(userMessage, chatHistory = [], verifiedUser = null, apiKey, modelName) {
  const groq = new Groq({ apiKey });
  const verifiedUid = verifiedUser ? verifiedUser.uid : null;

  const messages = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...chatHistory.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    })),
    {
      role: 'user',
      content: verifiedUser
        ? `[User Status: Authenticated as ${verifiedUser.name || 'Student'} (UID: ${verifiedUser.uid}, Email: ${verifiedUser.email})]\n${userMessage}`
        : `[User Status: Guest / Unauthenticated]\n${userMessage}`
    }
  ];

  let structuredDataOut = { books: null, orders: null };

  const completion = await groq.chat.completions.create({
    messages,
    model: modelName || 'llama-3.3-70b-versatile',
    tools: GROQ_TOOLS,
    tool_choice: 'auto',
    temperature: 0.7
  });

  const responseMessage = completion.choices[0].message;

  if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let functionArgs = {};
      try {
        functionArgs = JSON.parse(toolCall.function.arguments || '{}');
      } catch (e) {}

      const { result, structuredData } = await executeToolCall(functionName, functionArgs, verifiedUid);

      if (structuredData.books) structuredDataOut.books = structuredData.books;
      if (structuredData.orders) structuredDataOut.orders = structuredData.orders;

      messages.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify(result)
      });
    }

    const secondResponse = await groq.chat.completions.create({
      messages,
      model: modelName || 'llama-3.3-70b-versatile'
    });

    return {
      reply: secondResponse.choices[0].message.content,
      books: structuredDataOut.books,
      orders: structuredDataOut.orders
    };
  }

  return {
    reply: responseMessage.content,
    books: null,
    orders: null
  };
}

/**
 * Main Entry: Dispatches to configured AI provider
 */
export async function generateNovaResponse({ message, history = [], verifiedUser = null }) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    throw new Error(`Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file or hosting environment variables (Provider: ${provider}).`);
  }

  if (provider === 'groq') {
    return await processWithGroq(message, history, verifiedUser, apiKey, modelName);
  } else {
    return await processWithGemini(message, history, verifiedUser, apiKey, modelName);
  }
}
