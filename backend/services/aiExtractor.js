/**
 * AI Document Extractor — Uses Llama via Ollama for document understanding.
 *
 * Handles:
 *   - Image documents (prescriptions, bills) via Llama 3.2 Vision
 *   - PDF text extraction via pdf-parse, then structured extraction via Llama
 *   - Text-based extraction with few-shot prompting
 *
 * Gracefully falls back if Ollama is not running.
 */

const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'llama3.2-vision';

const ollama = new Ollama({ host: OLLAMA_BASE_URL });

// ─── Extraction Prompt ───────────────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are a medical document data extractor for an insurance claims system.
Analyze the provided medical document and extract information as JSON.

Return ONLY a valid JSON object with these fields (use null for missing fields):

{
  "document_type": "prescription | bill | diagnostic_report | pharmacy_bill",
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "doctor_registration_number": "string in format STATE/NUMBER/YEAR, or null",
  "hospital_clinic_name": "string or null",
  "date": "YYYY-MM-DD or null",
  "diagnosis": "string or null",
  "medicines_prescribed": ["medicine name 1", "medicine name 2"],
  "procedures": ["procedure 1"],
  "tests_prescribed": ["test 1"],
  "treatment": "string or null",
  "consultation_fee": 0,
  "diagnostic_test_charges": 0,
  "medicine_charges": 0,
  "total_amount": 0
}

Rules:
1. Extract ONLY what is visible. Do not guess or hallucinate.
2. For amounts, use numeric values.
3. For dates, convert to YYYY-MM-DD format.
4. Return ONLY the JSON object, no markdown, no explanation.`;

// ─── Check Ollama Availability ───────────────────────────────────────────────

async function isOllamaAvailable() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Extract from Image ─────────────────────────────────────────────────────

/**
 * Extract structured data from an image document using Llama Vision.
 * @param {string} imagePath - path to the image file
 * @returns {Object} extracted data
 */
async function extractFromImage(imagePath) {
  const available = await isOllamaAvailable();
  if (!available) {
    return {
      extracted: false,
      error: 'Ollama is not running. Start Ollama and pull llama3.2-vision to enable AI document extraction.',
    };
  }

  try {
    // Read image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const response = await ollama.chat({
      model: OLLAMA_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + '\n\nAnalyze this medical document image and extract the data:',
          images: [base64Image],
        },
      ],
      options: { temperature: 0.1 },
    });

    return parseExtractionResponse(response.message.content);
  } catch (error) {
    return {
      extracted: false,
      error: `Vision extraction failed: ${error.message}. Make sure '${OLLAMA_VISION_MODEL}' model is pulled.`,
    };
  }
}

// ─── Extract from PDF ────────────────────────────────────────────────────────

/**
 * Extract text from PDF, then use Llama to structure it.
 * @param {string} pdfPath - path to the PDF file
 * @returns {Object} extracted data
 */
async function extractFromPDF(pdfPath) {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);

    if (!pdfData.text || !pdfData.text.trim()) {
      return { extracted: false, error: 'PDF appears empty or is image-based. Try uploading as an image.' };
    }

    return await extractFromText(pdfData.text);
  } catch (error) {
    return { extracted: false, error: `PDF extraction failed: ${error.message}` };
  }
}

// ─── Extract from Text ───────────────────────────────────────────────────────

/**
 * Extract structured data from raw text using Llama.
 * @param {string} text - document text
 * @returns {Object} extracted data
 */
async function extractFromText(text) {
  const available = await isOllamaAvailable();
  if (!available) {
    return {
      extracted: false,
      error: 'Ollama is not running. Start Ollama to enable AI text extraction.',
    };
  }

  try {
    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nHere is the document text:\n---\n${text}\n---\n\nExtract the data and return ONLY the JSON object:`,
        },
      ],
      options: { temperature: 0.1 },
    });

    return parseExtractionResponse(response.message.content);
  } catch (error) {
    return {
      extracted: false,
      error: `Text extraction failed: ${error.message}. Make sure '${OLLAMA_MODEL}' model is pulled.`,
    };
  }
}

// ─── Parse LLM Response ─────────────────────────────────────────────────────

function parseExtractionResponse(responseText) {
  try {
    let text = responseText.trim();

    // Remove markdown code blocks if present
    if (text.startsWith('```')) {
      const parts = text.split('```');
      text = parts[1] || parts[0];
      if (text.startsWith('json')) text = text.substring(4);
      text = text.trim();
    }

    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      extracted.extracted = true;
      return extracted;
    }

    return { extracted: false, error: 'No valid JSON found in AI response', raw: responseText };
  } catch (error) {
    return { extracted: false, error: `Failed to parse AI response: ${error.message}`, raw: responseText };
  }
}

// ─── Convert Extracted → Claim Format ────────────────────────────────────────

/**
 * Convert AI-extracted data into the format expected by the rule engine.
 */
function convertExtractedToClaimFormat(extracted) {
  const prescription = {};
  const bill = {};

  if (extracted.doctor_name) prescription.doctor_name = extracted.doctor_name;
  if (extracted.doctor_registration_number) prescription.doctor_reg = extracted.doctor_registration_number;
  if (extracted.diagnosis) prescription.diagnosis = extracted.diagnosis;
  if (extracted.medicines_prescribed) {
    prescription.medicines_prescribed = extracted.medicines_prescribed.map(
      m => typeof m === 'object' ? m.name : m
    );
  }
  if (extracted.procedures) prescription.procedures = extracted.procedures;
  if (extracted.treatment) prescription.treatment = extracted.treatment;
  if (extracted.tests_prescribed) prescription.tests_prescribed = extracted.tests_prescribed;

  if (extracted.consultation_fee) bill.consultation_fee = extracted.consultation_fee;
  if (extracted.diagnostic_test_charges) bill.diagnostic_tests = extracted.diagnostic_test_charges;
  if (extracted.medicine_charges) bill.medicines = extracted.medicine_charges;

  return {
    prescription,
    bill,
    patient_name: extracted.patient_name || null,
    treatment_date: extracted.date || null,
    total_amount: extracted.total_amount || null,
  };
}

module.exports = {
  isOllamaAvailable,
  extractFromImage,
  extractFromPDF,
  extractFromText,
  convertExtractedToClaimFormat,
};
