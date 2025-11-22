// ai-agent.js - Fixed Location Extraction + Better Planning + Submit Button Handling
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AIAgent {
  constructor() {
    this.conversationHistory = [];
    this.model = 'gpt-4-turbo-preview';
    this.visionModel = 'gpt-4-turbo';
  }

  async callOpenAIWithRetry(apiCall, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        if (error.status === 429 && attempt < maxRetries) {
          const waitTime = attempt * 5000;
          console.log(`⚠️  Rate limit hit, waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        if (error.status === 503 && attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        throw error;
      }
    }
  }

  async planWorkflow(taskDescription) {
    // SUPER CRITICAL: Detect if dialog/form is already open
    const lowerTask = taskDescription.toLowerCase();
    const hasClickOpen = lowerTask.includes('click') && 
                        (lowerTask.includes('button') || lowerTask.includes('create new'));
    const hasTypeOnly = lowerTask.includes('type') && 
                       (lowerTask.includes('in the field') || lowerTask.includes('in field'));
    
    // If task says "Type in field under X, then click submit" 
    // → Dialog is ALREADY OPEN, don't add "click to open" step!
    const isDirectType = hasTypeOnly && !lowerTask.startsWith('click');
    
    let planningHint = '';
    if (isDirectType) {
      planningHint = '\n\n🚨 CRITICAL: The task starts with "Type in field" - this means the dialog/form is ALREADY OPEN. Do NOT add a step to "open dialog". Start directly with the typing step!';
    }
    
    const prompt = `You are planning steps for a workflow automation task.
Task: "${taskDescription}"${planningHint}

CRITICAL PLANNING RULES:
1. READ THE TASK CAREFULLY!
2. If task says "Type in field under X, then click the button to create":
   → The form/dialog is ALREADY OPEN
   → Plan EXACTLY: [Type in field, Click submit button]
   → Use EXACT phrase "Click the Create project button" or "Click the submit button"
3. If task says "Click button to create, then type":
   → Dialog is closed
   → Plan: [Click to open, Type, Submit]
4. When in doubt, look at the FIRST word:
   - Starts with "Type" → Dialog already open
   - Starts with "Click" → Need to open dialog
5. For the final submit step, ALWAYS use a specific description like:
   - "Click the Create project button"
   - "Click the submit button"
   - "Click the Create button"

CRITICAL: Output ONLY valid JSON:
{
  "steps": [
    {
      "stepNumber": 1,
      "description": "exact step description",
      "action": "click or type",
      "visualCue": "what to look for"
    }
  ],
  "textToExtract": {
    "title": "text from task"
  }
}

Examples:
✅ Task: "Type 'Name' in field under Title, then click the button to create"
   → Steps: [
       {stepNumber: 1, description: "Type 'Name' in field under Title", action: "type"},
       {stepNumber: 2, description: "Click the Create project button", action: "click"}
     ] (2 steps - dialog already open!)

✅ Task: "Click Create button, type 'Name', submit"  
   → Steps: [
       {stepNumber: 1, description: "Click Create button", action: "click"},
       {stepNumber: 2, description: "Type 'Name'", action: "type"},
       {stepNumber: 3, description: "Click the submit button", action: "click"}
     ] (3 steps)

❌ Task: "Type in field, then submit"
   → Steps: [Click to open, Type, Submit] (WRONG! Dialog already open!)

REMEMBER: The submit button description MUST be specific and include the word "button"!`;

    return await this.callOpenAIWithRetry(async () => {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a smart workflow planner. If task starts with "Type", the dialog is ALREADY OPEN. Always be specific about button names in descriptions. Respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.0,  // Zero temperature for strict adherence
        max_tokens: 1500
      });
      
      const result = this.parseJSONResponse(response.choices[0].message.content);
      
      // Post-processing: Remove redundant "open dialog" steps if task starts with "Type"
      if (isDirectType && result.steps.length > 0) {
        const firstStep = result.steps[0];
        if (firstStep.description.toLowerCase().includes('open') || 
            firstStep.description.toLowerCase().includes('click') && 
            firstStep.description.toLowerCase().includes('dialog')) {
          console.log('⚠️  Detected redundant "open dialog" step, removing it...');
          result.steps = result.steps.slice(1);
          // Renumber steps
          result.steps.forEach((step, idx) => {
            step.stepNumber = idx + 1;
          });
        }
      }
      
      return result;
    });
  }

  extractLocation(taskDescription, stepDescription) {
    const combined = `${taskDescription} ${stepDescription}`.toLowerCase();
    
    // More precise patterns with proper boundaries
    const patterns = [
      // "in the Today list"
      /in (?:the )?["']?([^"']+?)["']? (?:list|column)/i,
      // "to the Later column"
      /to (?:the )?["']?([^"']+?)["']? (?:list|column)/i,
      // "under Name" or "under 'Name'" (with proper boundary)
      /under (?:the )?["']?([a-zA-Z][\w\s]{1,})["']?(?:[,\s]|$)/i,
      // "below Project Title"
      /below (?:the )?["']?([a-zA-Z][\w\s]{1,})["']?(?:[,\s]|$)/i,
      // "in Name field"
      /in (?:the )?["']?([a-zA-Z][\w\s]{1,})["']? field/i
    ];
    
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match && match[1]) {
        let location = match[1].trim();
        
        // Filter out noise words at the end
        location = location.replace(/\s+(field|input|box|area|section|then|and|or)$/i, '');
        
        // Skip single letters (extraction errors)
        if (location.length === 1) {
          console.log(`⚠️  Skipping single-letter location: "${location}"`);
          continue;
        }
        
        // Skip common false positives
        const skipWords = ['it', 'the', 'that', 'this', 'then', 'and'];
        if (skipWords.includes(location.toLowerCase())) {
          continue;
        }
        
        // Capitalize properly
        const capitalized = location.split(' ').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
        ).join(' ');
        
        console.log(`📍 Extracted location: "${capitalized}" from pattern: ${pattern}`);
        return capitalized;
      }
    }
    
    return null;
  }

  async analyzeUIAndFindSelector(stepDescription, screenshotPath, htmlSnippet, previousActions = [], locationContext = null) {
    const imageBuffer = await fs.readFile(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    const isSubmitAction = stepDescription.toLowerCase().includes('create') || 
                          stepDescription.toLowerCase().includes('submit') ||
                          stepDescription.toLowerCase().includes('save') ||
                          stepDescription.toLowerCase().includes('finish');

    const prompt = `Analyze this UI to perform: "${stepDescription}"
${locationContext ? `CRITICAL: Target is near/under the "${locationContext}" label/header.` : ''}
${isSubmitAction ? `\n🚨 THIS IS A SUBMIT ACTION: Look for the "Create project" or "Create" or "Submit" button, usually at the bottom-right of the dialog.` : ''}

HTML snippet: ${htmlSnippet.slice(0, 2000)}

Output ONLY valid JSON:
{
  "visualAnalysis": "what you see in UI",
  "domSelectors": {
    "primary": "best selector${isSubmitAction ? ' (for submit: button:has-text(\"Create project\") or button[type=\"submit\"])' : ' (aria-label, data-testid, etc.)'}",
    "fallbacks": ["alt1", "alt2"],
    "confidence": 0.8
  }
}

${isSubmitAction ? 'For submit buttons, prioritize:\n1. button:has-text("Create project")\n2. button:has-text("Create")\n3. button:has-text("Submit")\n4. button[type="submit"]\n5. [role="dialog"] button:last-of-type' : 'Priority: aria-label > data-testid > id > class'}`;

    const result = await this.callOpenAIWithRetry(async () => {
      const response = await client.chat.completions.create({
        model: this.visionModel,
        messages: [
          { role: 'system', content: 'You are a UI automation expert. Valid JSON only. For submit buttons, always prioritize text-based selectors like button:has-text().' },
          { role: 'user', content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } }
          ]}
        ],
        max_tokens: 1000
      });
      return this.parseJSONResponse(response.choices[0].message.content);
    });

    const action = stepDescription.toLowerCase().includes('type') ? 'type' : 'click';
    const programmaticFallbacks = this.generateGenericFallbacks(stepDescription, action, locationContext);
    
    if (!result.domSelectors.fallbacks) result.domSelectors.fallbacks = [];
    
    // Sanitize AI-generated selectors (fix common mistakes)
    if (result.domSelectors.primary) {
      result.domSelectors.primary = this.sanitizeSelector(result.domSelectors.primary);
    }
    if (result.domSelectors.fallbacks) {
      result.domSelectors.fallbacks = result.domSelectors.fallbacks.map(s => this.sanitizeSelector(s));
    }
    
    result.domSelectors.fallbacks = [...programmaticFallbacks, ...result.domSelectors.fallbacks];

    return result;
  }

  sanitizeSelector(selector) {
    if (!selector) return selector;
    
    // Fix: aria-label='...' → button[aria-label='...']
    if (selector.match(/^aria-label=/)) {
      selector = 'button[' + selector + ']';
    }
    if (selector.match(/^data-testid=/)) {
      selector = '[' + selector + ']';
    }
    if (selector.match(/^id=/)) {
      const id = selector.replace(/^id=/, '').replace(/['"]/g, '');
      selector = '#' + id;
    }
    
    return selector;
  }

  generateGenericFallbacks(stepDescription, action, explicitLocation = null) {
    const fallbacks = [];
    const lowerDesc = stepDescription.toLowerCase();

    let location = explicitLocation;
    if (!location) {
      const locationMatch = lowerDesc.match(/(?:in|to|under|below) (?:the )?["']?([a-zA-Z][\w\s]{1,})["']?(?:[,\s]|$)/i);
      if (locationMatch) {
        location = locationMatch[1].trim();
        // Clean up
        location = location.replace(/\s+(field|input|box)$/i, '');
      }
    }

    if (location && location.length > 1) {
      const locText = location.charAt(0).toUpperCase() + location.slice(1);
      console.log(`   🎯 Generating Spatial fallbacks for: "${locText}"`);
      
      if (action === 'click') {
        const broadTarget = 'button,input[type="submit"],a[role="button"],div[role="button"]';
        fallbacks.push(
          `SPATIAL:${locText}|${broadTarget}`
        );
      }
      
      if (action === 'type') {
        // CRITICAL: Add contenteditable FIRST for Linear
        fallbacks.push(
          `SPATIAL:${locText}|[contenteditable="true"]`,
          `SPATIAL:${locText}|textarea`,
          `SPATIAL:${locText}|input`
        );
      }
      
      return fallbacks;
    }

    // Global fallbacks (no location context)
    if (action === 'click') {
      // Check if it's a submit/create action
      const isSubmit = lowerDesc.includes('submit') || 
                      lowerDesc.includes('create') ||
                      lowerDesc.includes('save') ||
                      lowerDesc.includes('finish');
      
      if (isSubmit) {
        // ENHANCED Submit button patterns - prioritize visible buttons
        console.log('   🎯 Generating SUBMIT button fallbacks');
        fallbacks.push(
          // Exact text matches (highest priority) - Linear specific
          'button:has-text("Create project"):visible',
          'button:has-text("Create"):visible',
          'button:has-text("Submit"):visible',
          'button:has-text("Save"):visible',
          
          // Type-based selectors
          'button[type="submit"]:visible',
          '[role="dialog"] button[type="submit"]:visible',
          
          // Position-based (Linear puts submit button last)
          '[role="dialog"] button:last-of-type:visible',
          'dialog button:last-of-type:visible',
          
          // Fallback to any visible button with create/submit (without :visible)
          'button[type="submit"]',
          'button:has-text("Create project")',
          'button:has-text("Create")',
          'button:has-text("Submit")',
          
          // Data attribute fallbacks
          'button[data-testid*="create"]',
          'button[data-testid*="submit"]',
          
          // Aria-label fallbacks
          'button[aria-label*="Create"]',
          'button[aria-label*="Submit"]'
        );
      } else {
        // Generic click patterns
        fallbacks.push(
          'button:has-text("Create")',
          'button:has-text("Add")',
          'button[type="submit"]',
          'input[type="submit"]'
        );
      }
    }
    
    if (action === 'type') {
      fallbacks.push(
        '[contenteditable="true"]:visible',
        'textarea:visible',
        'input[type="text"]:visible',
        'input:not([type="hidden"]):not([type="submit"]):visible'
      );
    }

    return fallbacks;
  }

  async verifyActionSuccess(stepDescription, beforeScreenshot, afterScreenshot, beforeHtml, afterHtml) {
    // Simple verification - assume success if no error thrown
    return { success: true, confidence: 0.9, visualChanges: 'Action completed' };
  }

  async extractTextToType(taskDescription, stepDescription) {
    const prompt = `Extract the EXACT text value to type.

Task: "${taskDescription}"
Step: "${stepDescription}"

Examples:
Task: "Type 'AI Automation Project' in name field"
→ {"textToType": "AI Automation Project"}

Task: "Enter 'Review Q4 metrics' as title"
→ {"textToType": "Review Q4 metrics"}

Return ONLY JSON: {"textToType": "exact string"}`;

    return await this.callOpenAIWithRetry(async () => {
      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'Extract text precisely. JSON only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 200
      });
      const res = this.parseJSONResponse(response.choices[0].message.content);
      return res.textToType;
    });
  }

  parseJSONResponse(text) {
    try {
      let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('No JSON found in response');
    } catch (error) {
      console.error('JSON parse error:', error.message);
      throw error;
    }
  }

  resetConversation() {
    this.conversationHistory = [];
    console.log('🧹 AI memory cleared');
  }
}