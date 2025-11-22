// index.js - Updated Trello Tasks with Better Descriptions
import { WorkflowCapture } from './workflow-capture.js';

/**
 * ============================================================
 * TRELLO TASKS - UPDATED WITH PRECISE DESCRIPTIONS
 * ============================================================
 */
const trelloTasks = [
  {
    taskDescription: 'In the "Today" list, click the "Add a card" button, then type "Review Q4 metrics" and click "Add card" to save',
    appName: 'Trello',
    startUrl: 'https://trello.com/b/uYVu9mp1/my-trello-board',
    outputDir: './captured-workflows/trello/01-create-card-today',
    skipNavigation: false,
    closeBrowserAfter: false
  },
  {
    taskDescription: 'In the "This Week" list, click the "Add a card" button, then type "Plan team offsite" and click "Add card" to save',
    appName: 'Trello',
    startUrl: 'https://trello.com/b/uYVu9mp1/my-trello-board',
    outputDir: './captured-workflows/trello/02-create-card-this-week',
    skipNavigation: true,
    closeBrowserAfter: false
  },
  {
    taskDescription: 'In the "Later" list, click the "Add a card" button, then type "Draft annual report" and click "Add card" to save',
    appName: 'Trello',
    startUrl: 'https://trello.com/b/uYVu9mp1/my-trello-board',
    outputDir: './captured-workflows/trello/03-create-card-later',
    skipNavigation: true,
    closeBrowserAfter: false
  }
];

/**
 * ============================================================
 * LINEAR TASKS
 * ============================================================
 */
const linearTasks = [
  {
    taskDescription: 'Click the button to create a new project',
    appName: 'Linear',
    startUrl: 'https://linear.app/renukac/projects/all',
    outputDir: './captured-workflows/linear/01-linear-spatial-open',
    skipNavigation: false,
    closeBrowserAfter: false
  },
  {
    taskDescription: 'Type "AI Automation Project" in the field under "Name", then click the Create project button to submit',
    appName: 'Linear',
    startUrl: 'https://linear.app/renukac/projects/all',
    outputDir: './captured-workflows/linear/02-linear-spatial-type',
    skipNavigation: true,
    closeBrowserAfter: true
  }
];

/**
 * ============================================================
 * COMBINE ALL TASKS
 * ============================================================
 */
const allTasks = [
  ...trelloTasks,
  ...linearTasks
];

/**
 * ============================================================
 * MAIN EXECUTION
 * ============================================================
 */
async function main() {
  console.log('🤖 Agent B: Multi-App AI-Driven Workflow Capture System');
  console.log('='.repeat(70));
  console.log('📋 Total Tasks: ' + allTasks.length);
  console.log('🧠 100% AI-driven - No hardcoded app logic');
  console.log('👁️  Uses GPT-4 Vision to analyze UI and generate selectors');
  console.log('📐 Spatial geometry engine for element location');
  console.log('🎯 Smart focus detection for form fields');
  console.log('='.repeat(70));
  
  console.log('\n📱 Apps in this demo:');
  console.log(`   ✅ Trello (${trelloTasks.length} tasks)`);
  console.log(`   ✅ Linear (${linearTasks.length} tasks)`);
  console.log('');
  
  const capture = new WorkflowCapture();
  const results = [];

  for (let i = 0; i < allTasks.length; i++) {
    const task = allTasks[i];
    
    console.log(`\n${'*'.repeat(70)}`);
    console.log(`📦 Task ${i + 1}/${allTasks.length}: ${task.appName}`);
    console.log(`📋 ${task.taskDescription}`);
    console.log('*'.repeat(70));
    
    try {
      const result = await capture.captureWorkflow(
        task.taskDescription,
        task.startUrl,
        task.outputDir,
        task.skipNavigation || false,
        task.closeBrowserAfter !== false
      );
      
      results.push({
        task: task.taskDescription,
        appName: task.appName,
        success: true,
        ...result
      });
      
      console.log('\n✅ Task completed!');
      console.log(`   Screenshots: ${result.screenshotCount}`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
      
      if (i < allTasks.length - 1) {
        const waitTime = task.skipNavigation ? 3 : 5;
        console.log(`\n⏳ Waiting ${waitTime}s before next task...\n`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      
    } catch (error) {
      console.error(`\n❌ Task failed: ${error.message}\n`);
      results.push({
        task: task.taskDescription,
        appName: task.appName,
        success: false,
        error: error.message
      });
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const trelloResults = results.filter(r => r.appName === 'Trello');
  const linearResults = results.filter(r => r.appName === 'Linear');
  const trelloSuccess = trelloResults.filter(r => r.success).length;
  const linearSuccess = linearResults.filter(r => r.success).length;
  
  console.log(`\n📊 Overall:`);
  console.log(`   ✅ Successful: ${successful}/${allTasks.length}`);
  console.log(`   ❌ Failed: ${allTasks.length - successful}/${allTasks.length}`);
  console.log(`   📈 Success Rate: ${((successful / allTasks.length) * 100).toFixed(1)}%`);
  
  console.log(`\n📊 Trello:`);
  console.log(`   ✅ Successful: ${trelloSuccess}/${trelloResults.length}`);
  console.log(`   ❌ Failed: ${trelloResults.length - trelloSuccess}/${trelloResults.length}`);
  
  console.log(`\n📊 Linear:`);
  console.log(`   ✅ Successful: ${linearSuccess}/${linearResults.length}`);
  console.log(`   ❌ Failed: ${linearResults.length - linearSuccess}/${linearResults.length}`);
  
  console.log('\n📋 Detailed Results:');
  results.forEach((r, idx) => {
    const status = r.success ? '✅' : '❌';
    const taskNum = idx + 1;
    const shortDesc = r.task.slice(0, 60) + (r.task.length > 60 ? '...' : '');
    console.log(`  ${status} Task ${taskNum} [${r.appName}]: ${r.success ? 'Success' : r.error}`);
    console.log(`      ${shortDesc}`);
  });
  
  console.log('\n🎉 Demo complete! Check ./captured-workflows/ for all screenshots and READMEs');
  console.log('🧠 All decisions made by AI vision analysis - zero hardcoding!');
  console.log('👁️  GPT-4 Vision analyzed UI states and generated selectors on the fly');
  console.log('📐 Spatial geometry engine found elements by their visual position');
  console.log('🎯 Smart focus detection handled contenteditable fields automatically');
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});