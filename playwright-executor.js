// playwright-executor.js - Complete Updated Version with Smart Focus Detection + Enhanced Debugging
import { chromium } from 'playwright';

export class PlaywrightExecutor {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize(headless = false) {
    this.browser = await chromium.launch({ 
      headless,
      slowMo: 1000 // Human-like delay
    });
    
    const context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    
    this.page = await context.newPage();
    this.page.setDefaultTimeout(60000);
  }

  async navigateTo(url) {
    try {
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await this.page.waitForTimeout(3000);
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.log('⚠️  Page loading continued...');
    }
  }

  async takeScreenshot(filename) {
    try {
      await this.page.addStyleTag({
        content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
      });
      await this.page.waitForTimeout(500);
      await this.page.screenshot({ 
        path: filename,
        fullPage: false,
        animations: 'disabled'
      });
      console.log(`📸 Screenshot saved: ${filename}`);
      return { success: true, path: filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  sanitizeSelector(selector) {
    if (!selector) return selector;
    
    // Handle :has-text() properly - leave as is
    if (selector.includes(':has-text(')) {
      return selector;
    }
    
    // Handle :contains() - convert to :has-text()
    if (selector.includes(':contains(')) {
      return selector.replace(/:contains\((['"][^'"]+['"])\)/g, ':has-text($1)');
    }
    
    // Add :visible to button selectors if not already present and not a SPATIAL command
    if (selector.includes('button') && 
        !selector.includes(':visible') && 
        !selector.startsWith('SPATIAL:') &&
        !selector.includes('[role="dialog"]')) {
      // Only add :visible if it makes sense
      if (!selector.includes(':has-text(') || selector.endsWith(')')) {
        selector = selector + ':visible';
      }
    }
    
    return selector;
  }

  async executeAction(instruction) {
    const { action, textToType, domSelectors } = instruction;
    let selectors = [];
    
    if (domSelectors?.primary) selectors.push(domSelectors.primary);
    if (domSelectors?.fallbacks) selectors.push(...domSelectors.fallbacks);

    selectors = selectors.map(s => this.sanitizeSelector(s));

    console.log(`\n🎯 Executing ${action} action with ${selectors.length} selectors`);
    return await this.executeActionWithFallbacks(selectors, action, textToType);
  }

  async executeActionWithFallbacks(selectors, action, textToType) {
    let lastError = null;

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      if (!selector || selector.length < 2) continue;

      // ============================================================
      // 1. SPATIAL COMMAND HANDLER
      // ============================================================
      if (selector.startsWith('SPATIAL:')) {
        console.log(`📐 Executing Spatial Geometry Search: ${selector}`);
        const [headerText, targetTag] = selector.replace('SPATIAL:', '').split('|');
        
        const spatialResult = await this.executeSpatialSearch(headerText, targetTag, action, textToType);
        
        if (spatialResult.success) {
          if (spatialResult.interaction === 'handled') {
             return { success: true, selector: selector, action };
          }
          
          const targetElement = this.page.locator(spatialResult.uniqueSelector);
          try {
            if (action === 'click') {
              await targetElement.click();
              console.log(`✅ Spatial Success: Clicked target (Score: ${spatialResult.score})`);
            }
            if (action === 'type') {
                // SAFE TYPING FIX: Never Click. Just Focus.
                try { await targetElement.focus(); } catch(e) {} 
                await targetElement.fill(String(textToType));
                console.log(`✅ Spatial Success: Typed via geometry`);
            }
            await targetElement.evaluate(el => el.removeAttribute('data-spatial-id')).catch(() => {});
            return { success: true, selector: selector, action };
          } catch (e) { 
            console.log(`⚠️ Spatial interaction failed: ${e.message}`);
            lastError = e.message;
          }
        } else {
          lastError = spatialResult.error;
        }
        continue;
      }

      // ============================================================
      // 2. STANDARD SELECTOR HANDLER
      // ============================================================
      console.log(`🎯 Trying selector ${i + 1}/${selectors.length}: ${selector.slice(0, 80)}`);
      try {
        const result = await this.executeSingleAction(selector, action, textToType);
        if (result.success) {
          console.log(`✅ Success with selector: ${selector.slice(0, 60)}`);
          return result;
        }
      } catch (error) {
        lastError = error.message;
        console.log(`   ❌ Failed: ${error.message.slice(0, 100)}`);
        continue;
      }
    }

    return { 
      success: false, 
      error: `All selectors failed. Last error: ${lastError}`,
      selectorsTried: selectors
    };
  }

  /**
   * THE SPATIAL ENGINE
   */
  async executeSpatialSearch(headerText, targetTag, action, textToType) {
    try {
      return await this.page.evaluate(({ headerText, targetTag, action, textToType }) => {
        const allElements = Array.from(document.querySelectorAll('*'));
        let header = allElements.find(el => 
          el.innerText?.trim() === headerText && 
          el.offsetParent !== null && 
          ['H2','H3','H4','DIV','SPAN','STRONG','P'].includes(el.tagName)
        );
        
        if (!header) {
          header = allElements.find(el => el.innerText?.includes(headerText) && el.tagName.match(/H[1-6]|STRONG/));
        }
        if (!header) return { success: false, error: `Header "${headerText}" not found` };

        const headerRect = header.getBoundingClientRect();
        const headerCenterX = headerRect.left + (headerRect.width / 2);

        const candidates = Array.from(document.querySelectorAll(targetTag))
          .map(el => {
             const rect = el.getBoundingClientRect();
             // Fix: Check Value for inputs
             const rawText = el.innerText || el.value || '';
             return { 
               el, rect, 
               text: rawText.toLowerCase(), 
               aria: el.getAttribute('aria-label')?.toLowerCase() || '' 
             };
          })
          .filter(item => {
            if (item.rect.width === 0 || item.rect.height === 0) return false;
            if (item.rect.top <= headerRect.top) return false;

            const itemCenterX = item.rect.left + (item.rect.width / 2);
            const dist = Math.abs(itemCenterX - headerCenterX);
            return dist < 150; 
          });

        if (candidates.length === 0) return { success: false, error: 'No aligned candidates' };

        const ranked = candidates.map(item => {
          let score = 1000 - (item.rect.top - headerRect.bottom);

          if (item.text.includes('add') || item.aria.includes('add')) score += 2000;
          if (item.text.includes('save') || item.aria.includes('save')) score += 2000;
          if (item.text.includes('create') || item.aria.includes('create')) score += 2000;
          if (item.text.includes('+') || item.aria.includes('+')) score += 500;
          
          // Penalize Menus/Cancels
          if (item.aria.includes('menu') || item.aria.includes('actions')) score -= 5000;
          if (item.text.includes('cancel') || item.text.includes('x')) score -= 5000;

          return { ...item, score };
        });

        ranked.sort((a, b) => b.score - a.score);
        const bestMatch = ranked[0].el;

        // Smart Focus Check (Browser side)
        if (action === 'type') {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                const activeRect = active.getBoundingClientRect();
                const activeDist = Math.abs(activeRect.left - headerRect.left);
                if (activeDist < 300) {
                    active.value = textToType;
                    active.dispatchEvent(new Event('input', { bubbles: true }));
                    return { success: true, interaction: 'handled', message: 'Used active focus' };
                }
            }
        }

        const uniqueId = 'spatial-target-' + Math.random().toString(36).substr(2, 9);
        bestMatch.setAttribute('data-spatial-id', uniqueId);
        return { 
          success: true, 
          uniqueSelector: `[data-spatial-id="${uniqueId}"]`, 
          score: ranked[0].score 
        };

      }, { headerText, targetTag, action, textToType: textToType || '' });

    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async executeSingleAction(selector, action, textToType) {
    try {
      console.log(`   🔍 Attempting selector: ${selector.slice(0, 100)}`);
      
      // ============================================================
      // SMART FOCUS DETECTION - CRITICAL FOR LINEAR!
      // ============================================================
      if (action === 'type') {
        const focusedInfo = await this.page.evaluate(() => {
          const el = document.activeElement;
          if (el && (
            el.tagName === 'INPUT' || 
            el.tagName === 'TEXTAREA' ||
            el.getAttribute('contenteditable') === 'true'
          )) {
            return {
              isFocused: true,
              tag: el.tagName,
              ariaLabel: el.getAttribute('aria-label'),
              contenteditable: el.getAttribute('contenteditable'),
              placeholder: el.placeholder,
              isVisible: el.offsetParent !== null
            };
          }
          return { isFocused: false };
        });
        
        if (focusedInfo.isFocused && focusedInfo.isVisible) {
          console.log('🎯 Smart Focus Detection: Field already focused!');
          console.log(`   Tag: ${focusedInfo.tag}${focusedInfo.contenteditable ? '[contenteditable]' : ''}`);
          console.log(`   Aria-label: ${focusedInfo.ariaLabel || 'none'}`);
          console.log(`   Placeholder: ${focusedInfo.placeholder || 'none'}`);
          console.log('   ✅ Typing directly with keyboard...');
          
          // Type with slight delay for stability
          await this.page.keyboard.type(String(textToType), { delay: 50 });
          await this.page.waitForTimeout(500);
          
          return { 
            success: true, 
            selector: ':focus (smart detection)', 
            action 
          };
        }
      }

      // ============================================================
      // STANDARD SELECTOR EXECUTION WITH ENHANCED DEBUGGING
      // ============================================================
      
      // First check if selector exists
      const count = await this.page.locator(selector).count();
      console.log(`   📊 Found ${count} element(s) matching selector`);
      
      if (count === 0) {
        throw new Error(`Selector not found: ${selector}`);
      }
      
      await this.page.waitForSelector(selector, { timeout: 4000, state: 'attached' });
      const element = this.page.locator(selector).first();
      
      // Check visibility
      const isVisible = await element.isVisible().catch(() => false);
      console.log(`   👁️  Element visible: ${isVisible}`);
      
      if (!isVisible) {
        console.log('   📜 Scrolling element into view...');
        await element.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(500);
      }

      if (action === 'click') {
        console.log(`   🖱️  Clicking element...`);
        await element.click({ timeout: 5000 });
        await this.page.waitForTimeout(1000);
        console.log(`   ✅ Click successful`);
      } 
      else if (action === 'type') {
        console.log(`   ⌨️  Typing text: "${String(textToType).slice(0, 30)}..."`);
        
        // SAFE TYPING: Focus, don't Click
        try { 
          console.log('   🎯 Focusing element...');
          await element.focus(); 
        } catch(e) {
          console.log('   ⚠️  Focus failed, trying click...');
          await element.click();
        }
        await this.page.waitForTimeout(300);
        
        // Type with fill for contenteditable
        const isContenteditable = await element.evaluate(el => 
          el.getAttribute('contenteditable') === 'true'
        );
        
        console.log(`   📝 Element type: ${isContenteditable ? 'contenteditable' : 'input/textarea'}`);
        
        if (isContenteditable) {
          // For contenteditable, use keyboard.type
          await this.page.keyboard.type(String(textToType), { delay: 50 });
        } else {
          // For input/textarea, use fill
          await element.fill(String(textToType));
        }
        
        await this.page.waitForTimeout(500);
        console.log(`   ✅ Typing successful`);
      }

      return { success: true, selector, action };
    } catch (error) {
      console.log(`   ❌ Action failed: ${error.message}`);
      return { success: false, error: error.message, selector };
    }
  }

  async getPageHtml() { 
    try { 
      return await this.page.content(); 
    } catch (e) { 
      return ''; 
    } 
  }
  
  async getPageUrl() { 
    return this.page.url(); 
  }
  
  async close() { 
    if (this.browser) {
      await this.browser.close(); 
    }
  }
}