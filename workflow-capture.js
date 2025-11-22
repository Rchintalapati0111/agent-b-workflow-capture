// workflow-capture.js - Complete Workflow Logic
import { AIAgent } from './ai-agent-fixed.js';
import { PlaywrightExecutor } from './playwright-executor.js';
import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

export class WorkflowCapture {
  constructor() {
    this.aiAgent = new AIAgent();
    this.executor = new PlaywrightExecutor();
    this.screenshots = [];
    this.browserInitialized = false;
    this.workflowContext = {
      steps: [],
      totalDuration: 0,
      actionHistory: []
    };
  }

  async waitForEnter(message) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise(resolve => {
      rl.question(message, () => {
        rl.close();
        resolve();
      });
    });
  }

  async captureWorkflow(taskDescription, startUrl, outputDir, skipNavigation = false, closeBrowserAfter = true) {
    console.log(`\n🚀 Starting workflow capture`);
    console.log(`📋 Task: ${taskDescription}`);
    if (!skipNavigation) console.log(`🔗 URL: ${startUrl}\n`);

    const startTime = Date.now();
    await fs.mkdir(outputDir, { recursive: true });

    try {
      if (!skipNavigation) {
        if (!this.browserInitialized) {
          await this.executor.initialize(false);
          this.browserInitialized = true;
        }
        console.log('🌐 Navigating to app...');
        await this.executor.navigateTo(startUrl);
        console.log('\n⏸️  Please log in to the app if needed.');
        await this.waitForEnter('Press ENTER to continue: ');
      } else {
        console.log('📌 Staying on current page...');
        await this.executor.page.waitForTimeout(2000);
      }

      console.log('\n🧠 AI is planning the workflow...\n');
      
      // CRITICAL: Wipe Memory
      this.aiAgent.resetConversation(); 
      
      const plan = await this.aiAgent.planWorkflow(taskDescription);
      
      console.log('📝 Workflow Plan:');
      plan.steps.forEach(step => console.log(`   ${step.stepNumber}. ${step.description}`));
      console.log('');

      await this.executor.page.waitForTimeout(3000);

      const initialScreenshot = path.join(outputDir, '00-initial-state.png');
      await this.executor.takeScreenshot(initialScreenshot);
      this.screenshots.push({
        step: 0, description: 'Initial state', filename: '00-initial-state.png',
        url: await this.executor.getPageUrl(), timestamp: Date.now()
      });

      const globalLocationContext = this.aiAgent.extractLocation(taskDescription, "");
      if (globalLocationContext) {
        console.log(`📍 Global Location Context Detected: "${globalLocationContext}"`);
      }

      for (const step of plan.steps) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📍 Step ${step.stepNumber}: ${step.description}`);
        console.log('='.repeat(60));

        const stepResult = await this.executeStepWithVision(
          step, outputDir, plan.textToExtract, taskDescription, globalLocationContext
        );
        
        this.workflowContext.steps.push(stepResult);
        this.workflowContext.actionHistory.push(step.description);

        if (!stepResult.success) break;
        if (step.stepNumber < plan.steps.length) await this.executor.page.waitForTimeout(3000);
      }

      await this.generateReadme(outputDir, taskDescription, plan);
      await this.generateMetadata(outputDir);

      this.workflowContext.totalDuration = Date.now() - startTime;
      console.log(`\n✨ Workflow complete! Output: ${outputDir}`);
      
      return { success: true, screenshotCount: this.screenshots.length, outputDir, duration: this.workflowContext.totalDuration };

    } catch (error) {
      console.error(`\n❌ Error:`, error);
      throw error;
    } finally {
      if (closeBrowserAfter) {
        console.log('🔒 Closing browser...');
        await this.executor.close();
        this.browserInitialized = false;
      }
    }
  }

  async executeStepWithVision(step, outputDir, textToExtract, taskDescription, locationContext, maxRetries = 2) {
    const stepStartTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (attempt > 1) console.log(`\n🔄 Retry attempt ${attempt}...`);

      try {
        const beforeHtml = await this.executor.getPageHtml();
        const beforeScreenshot = path.join(outputDir, `${step.stepNumber.toString().padStart(2, '0')}-before.png`);
        await this.executor.takeScreenshot(beforeScreenshot);
        
        console.log('🔍 AI is analyzing the UI...');
        
        const analysis = await this.aiAgent.analyzeUIAndFindSelector(
          step.description, beforeScreenshot, beforeHtml, 
          this.workflowContext.actionHistory, locationContext
        );
        
        // Fix: Always extract fresh text
        let textToType = null;
        if (step.action === 'type') {
          console.log('📝 Extracting text to type...');
          textToType = await this.aiAgent.extractTextToType(taskDescription, step.description);
          console.log(`📝 Text to type: "${textToType}"`);
        }

        const instruction = {
          action: step.action,
          domSelectors: analysis.domSelectors,
          textToType: textToType
        };

        console.log('⚡ Executing action...');
        const actionResult = await this.executor.executeAction(instruction);

        if (!actionResult.success) throw new Error('Action execution failed');

        console.log(`✅ Action executed successfully!`);
        console.log('⏳ Waiting for UI to update...');
        await this.executor.page.waitForTimeout(2000);

        const afterScreenshot = path.join(outputDir, `${step.stepNumber.toString().padStart(2, '0')}-after.png`);
        await this.executor.takeScreenshot(afterScreenshot);
        
        this.screenshots.push({
            step: step.stepNumber, description: `After: ${step.description}`,
            filename: path.basename(afterScreenshot), url: await this.executor.getPageUrl(), timestamp: Date.now()
        });

        console.log('🔍 AI is verifying...');
        const verification = await this.aiAgent.verifyActionSuccess(step.description, beforeScreenshot, afterScreenshot, beforeHtml, await this.executor.getPageHtml());
        console.log(`✅ Verification: ${verification.success ? 'SUCCESS' : 'FAILED'}`);

        return {
          stepNumber: step.stepNumber, description: step.description, success: verification.success,
          selectorUsed: actionResult.selector, duration: Date.now() - stepStartTime
        };

      } catch (error) {
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        if (attempt < maxRetries) await this.executor.page.waitForTimeout(2000);
      }
    }

    return { success: false, stepNumber: step.stepNumber, description: step.description };
  }

  async generateReadme(outputDir, taskDescription, plan) {
    const readmePath = path.join(outputDir, 'README.md');
    await fs.writeFile(readmePath, `# Workflow: ${taskDescription}\n\nGenerated by Generic AI Agent`);
  }

  async generateMetadata(outputDir) {
    const metadataPath = path.join(outputDir, 'workflow-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(this.workflowContext, null, 2));
  }

  slugify(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
}