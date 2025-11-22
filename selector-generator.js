// selector-generator.js - Generate robust selector chains for Trello and Linear
export class SelectorGenerator {
  generateSelectorChain(stepDescription, domContext, appName) {
    const selectors = [];
    
    // Strategy 1: Stable attributes
    const stableSelectors = this.extractStableSelectors(domContext);
    selectors.push(...stableSelectors);
    
    // Strategy 2: App-specific patterns
    if (appName === 'Trello') {
      const trelloSelectors = this.generateTrelloSelectors(stepDescription, domContext);
      selectors.push(...trelloSelectors);
    } else if (appName === 'Linear') {
      const linearSelectors = this.generateLinearSelectors(stepDescription, domContext);
      selectors.push(...linearSelectors);
    }
    
    // Strategy 3: Text-based with constraints
    const textSelectors = this.generateTextBasedSelectors(stepDescription);
    selectors.push(...textSelectors);
    
    // Strategy 4: Semantic selectors
    const semanticSelectors = this.generateSemanticSelectors(stepDescription, domContext);
    selectors.push(...semanticSelectors);
    
    // Deduplicate and score
    const uniqueSelectors = [...new Set(selectors)];
    const scoredSelectors = uniqueSelectors.map(sel => ({
      selector: sel,
      score: this.scoreSelectorStability(sel)
    })).sort((a, b) => b.score - a.score);
    
    return {
      primary: scoredSelectors[0]?.selector || 'button',
      fallbacks: scoredSelectors.slice(1, 5).map(s => s.selector),
      confidence: scoredSelectors[0]?.score || 0.5
    };
  }

  extractStableSelectors(domContext) {
    const selectors = [];
    
    if (!domContext || !domContext.interactiveElements) {
      return selectors;
    }
    
    for (const el of domContext.interactiveElements) {
      // data-testid is most stable
      if (el.testId) {
        selectors.push(`[data-testid="${el.testId}"]`);
      }
      
      // aria-label is semantic and stable
      if (el.ariaLabel) {
        selectors.push(`[aria-label="${el.ariaLabel}"]`);
      }
      
      // role + aria-label combo
      if (el.role && el.ariaLabel) {
        selectors.push(`[role="${el.role}"][aria-label="${el.ariaLabel}"]`);
      }
      
      // id (if not generated)
      if (el.id && !el.id.match(/^[a-z0-9]{8,}$/i)) {
        selectors.push(`#${el.id}`);
      }
    }
    
    return selectors;
  }

  generateTrelloSelectors(stepDescription, domContext) {
    const selectors = [];
    const lower = stepDescription.toLowerCase();
    
    // Extract list name if mentioned
    const listMatch = lower.match(/(?:in|to|within) (?:the )?["']?([^"']+?)["']? (?:list|column)/);
    const listName = listMatch ? listMatch[1] : null;
    
    if (listName && lower.includes('add a card')) {
      // Trello list-specific "Add a card" button
      selectors.push(
        `h2:has-text("${listName}") >> xpath=ancestor::*[contains(@class, 'list')]//button[contains(text(), 'Add a card')]`,
        `[aria-label*="${listName}"] >> button:has-text("Add a card")`,
        `div:has(h2:has-text("${listName}")) >> button:has-text("Add a card")`,
        `.list-header:has-text("${listName}") >> xpath=ancestor::*//button:has-text("Add a card")`
      );
    }
    
    if (lower.includes('card') && !lower.includes('add')) {
      // Opening/viewing a card
      const cardNameMatch = stepDescription.match(/["']([^"']+?)["'] card/);
      const cardName = cardNameMatch ? cardNameMatch[1] : null;
      
      if (cardName) {
        selectors.push(
          `a:has-text("${cardName}")`,
          `[data-testid*="card"]:has-text("${cardName}")`,
          `.list-card:has-text("${cardName}")`
        );
      }
    }
    
    // Trello "Add card" button generic
    if (lower.includes('add a card') || lower.includes('add card')) {
      selectors.push(
        'button:has-text("Add a card")',
        'button:has-text("Add card")',
        '.js-add-card',
        '[data-testid*="add-card"]'
      );
    }
    
    // Trello card composer textarea
    if (lower.includes('type') || lower.includes('enter') || lower.includes('title')) {
      selectors.push(
        'textarea[placeholder*="Enter a title"]',
        'textarea.list-card-composer-textarea',
        '.list-card-composer textarea',
        'textarea[name="title"]'
      );
    }
    
    return selectors;
  }

  generateLinearSelectors(stepDescription, domContext) {
    const selectors = [];
    const lower = stepDescription.toLowerCase();
    
    // Create new project button
    if (lower.includes('create new project') || lower.includes('create project button')) {
      selectors.push(
        'button[aria-label="Create new project"]',
        'button:has-text("Create new project")',
        'button:has-text("Create project")',
        '[data-testid*="create-project"]'
      );
    }
    
    // Project name field
    if (lower.includes('project name') || (lower.includes('type') && lower.includes('name'))) {
      selectors.push(
        'div[aria-label="Project name"]',
        'div[aria-label="Project name"] div[contenteditable="true"]',
        '[role="dialog"] div[contenteditable="true"]:first',
        'input[placeholder*="name"]',
        'input[name="name"]'
      );
    }
    
    // Project summary field
    if (lower.includes('summary') || lower.includes('short summary')) {
      selectors.push(
        'div[aria-label="Project summary"]',
        'div[aria-label="Project summary"] div[contenteditable="true"]',
        'textarea[placeholder*="summary"]',
        'text=Add a short summary'
      );
    }
    
    // Project description field
    if (lower.includes('description') || lower.includes('write a description')) {
      selectors.push(
        'div[aria-label="Project description"]',
        'div[aria-label="Project description"] div[contenteditable="true"]',
        'textarea[placeholder*="description"]',
        'text=Write a description'
      );
    }
    
    // Submit/Create button
    if (lower.includes('click') && (lower.includes('create project') || lower.includes('submit'))) {
      selectors.push(
        'button:has-text("Create project")',
        '[role="dialog"] button[type="submit"]',
        'button[type="submit"]:has-text("Create")'
      );
    }
    
    // Generic contenteditable in Linear modal
    if (lower.includes('type')) {
      selectors.push(
        '[role="dialog"] div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]'
      );
    }
    
    return selectors;
  }

  generateTextBasedSelectors(stepDescription) {
    const selectors = [];
    
    // Extract quoted text or action verbs
    const quotedTextMatch = stepDescription.match(/["']([^"']+?)["']/);
    if (quotedTextMatch) {
      const text = quotedTextMatch[1];
      selectors.push(
        `button:has-text("${text}")`,
        `a:has-text("${text}")`,
        `[role="button"]:has-text("${text}")`,
        `*:has-text("${text}")`
      );
    }
    
    // Extract action keywords
    const actionMatch = stepDescription.match(/(?:click|press|select) (?:the )?(?:on )?(.+?)(?:\s|$|in|to|button|link)/i);
    if (actionMatch) {
      const action = actionMatch[1].trim();
      selectors.push(
        `button:has-text("${action}")`,
        `[aria-label*="${action}"]`
      );
    }
    
    return selectors;
  }

  generateSemanticSelectors(stepDescription, domContext) {
    const selectors = [];
    const lower = stepDescription.toLowerCase();
    
    // Button patterns
    if (lower.includes('button') || lower.includes('click')) {
      selectors.push('button', '[role="button"]', 'a[role="button"]');
    }
    
    // Input patterns
    if (lower.includes('type') || lower.includes('enter') || lower.includes('input')) {
      selectors.push(
        'input[type="text"]', 
        'textarea', 
        '[contenteditable="true"]',
        'div[contenteditable="true"]'
      );
    }
    
    // Link patterns
    if (lower.includes('link') || lower.includes('navigate')) {
      selectors.push('a[href]', '[role="link"]');
    }
    
    return selectors;
  }

  scoreSelectorStability(selector) {
    let score = 0.5; // base score
    
    // High stability attributes
    if (selector.includes('[data-testid')) score += 0.4;
    if (selector.includes('[data-test-id')) score += 0.4;
    if (selector.includes('[aria-label')) score += 0.3;
    if (selector.includes('[role=')) score += 0.2;
    if (selector.includes('#') && !selector.includes('[id*=')) score += 0.2;
    
    // Medium stability
    if (selector.includes(':has-text(')) score += 0.15;
    if (selector.includes('[aria-labelledby')) score += 0.15;
    
    // Penalties for fragile patterns
    if (selector.includes(':nth-child')) score -= 0.3;
    if (selector.includes(':nth-of-type')) score -= 0.3;
    if (selector.match(/div > div > div/)) score -= 0.2;
    if (selector.includes('[class*=')) score -= 0.1;
    if (selector.match(/^[a-z]+$/)) score -= 0.2; // bare tag selector
    
    // Bonus for specificity
    const parts = selector.split(/\s+|>>/);
    if (parts.length >= 2 && parts.length <= 4) score += 0.1;
    if (parts.length > 5) score -= 0.15; // too specific
    
    return Math.max(0, Math.min(1, score));
  }

  generateFallbackChain(primarySelector) {
    // Generate variations of a selector
    const fallbacks = [];
    
    // Remove :nth-child
    if (primarySelector.includes(':nth-child')) {
      fallbacks.push(primarySelector.replace(/:nth-child\(\d+\)/g, ''));
    }
    
    // Broaden class selectors
    if (primarySelector.includes('.')) {
      const withoutClasses = primarySelector.replace(/\.[a-zA-Z0-9_-]+/g, '');
      if (withoutClasses !== primarySelector) {
        fallbacks.push(withoutClasses);
      }
    }
    
    // Simplify chained selectors
    if (primarySelector.includes('>>')) {
      const parts = primarySelector.split('>>');
      if (parts.length > 2) {
        fallbacks.push(parts.slice(-2).join('>>').trim());
      }
    }
    
    return fallbacks;
  }
}