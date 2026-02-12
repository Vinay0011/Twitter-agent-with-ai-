const fs = require("fs");
const puppeteer = require("puppeteer-core");

// ===== CONFIG =====
const TWEETS_PER_BATCH = 50;
const MIN_DELAY = 30 * 1000; // 30 sec minimum
const MAX_DELAY = 60 * 1000; // 60 sec maximum
const COOLDOWN = 30 * 60 * 1000; // 30 min

// Random delay generator
function getRandomDelay() {
  return Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
}

// Groq API Configuration
const GROQ_API_KEY = "Enter Your Groq API Key";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Chrome paths for Groq profile
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA_DIR = "C:\\Users\\crypt\\AppData\\Local\\Google\\Chrome\\User Data";
const PROFILE_DIR = "Profile 1"; // Groq X account

// ===== LOAD TWEET LINKS =====
const links = fs
  .readFileSync("input/links.txt", "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== AI REPLY GENERATOR USING GROQ =====
async function generateAIReply(tweetText) {
  try {
    console.log("  🤖 Groq AI is thinking...");
    
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", // Fast and smart model
        messages: [
          {
            role: "system",
            content: "You are a professional and thoughtful Twitter user. Generate brief, engaging, and contextual short replies to tweets. Keep replies under 100 characters. Be professional, supportive, and add value to the conversation. Avoid generic responses - make it specific to the tweet content."
          },
          {
            role: "user",
            content: `Generate a professional and engaging short reply to this tweet:\n\n"${tweetText}"\n\nReply should be thoughtful, relevant, and under 100 characters.`
          }
        ],
        temperature: 0.8,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiReply = data.choices[0].message.content.trim();
    
    // Remove any quotes that AI might add
    return aiReply.replace(/^["']|["']$/g, '');
    
  } catch (error) {
    console.log(`  ⚠️  AI generation failed: ${error.message}`);
    // Fallback to a generic professional reply
    const fallbackReplies = [
      "Great insight! Thanks for sharing this.",
      "Really valuable perspective here.",
      "This is exactly what I was thinking about.",
      "Appreciate you sharing this!",
    ];
    return fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  }
}

(async () => {
  console.log("🚀 Starting Groq Twitter Bot with AI Replies...");
  console.log(`📊 Total tweets to process: ${links.length}`);
  console.log(`🤖 AI Model: Llama 3.3 70B (via Groq)\n`);

  // Connect to existing Chrome running on port 9222
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: "http://localhost:9222",
      defaultViewport: null,
    });
    console.log("✅ Connected to Chrome (Profile 1 - Groq account)\n");
  } catch (err) {
    console.error("❌ Failed to connect to Chrome!");
    console.error("Make sure Chrome is running with --remote-debugging-port=9222");
    console.error("\nRun this command first:");
    console.error('Start-Process "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" -ArgumentList "--remote-debugging-port=9222","--user-data-dir=C:\\Users\\crypt\\AppData\\Local\\Google\\Chrome\\User Data","--profile-directory=Profile 1"');
    process.exit(1);
  }

  let count = 0;

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${i + 1}/${links.length}] Processing: ${link}`);

    try {
      // Open new tab
      const page = await browser.newPage();
      
      // Navigate to tweet
      await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });
      console.log("  ✅ Tweet page loaded");

      // Wait for content to render
      await wait(5000);

      // Scroll to make elements visible
      await page.evaluate(() => window.scrollBy(0, 200));
      await wait(1000);

      // ===== READ TWEET TEXT =====
      let tweetText = "";
      try {
        // Try to extract tweet text
        tweetText = await page.evaluate(() => {
          const tweetElement = document.querySelector('[data-testid="tweetText"]');
          return tweetElement ? tweetElement.innerText : "";
        });
        
        if (tweetText) {
          console.log(`  📖 Tweet: "${tweetText.substring(0, 100)}${tweetText.length > 100 ? '...' : ''}"`);
        } else {
          console.log("  ⚠️  Could not extract tweet text, using fallback");
        }
      } catch (err) {
        console.log("  ⚠️  Could not read tweet text");
      }

      // ===== LIKE TWEET =====
      try {
        await page.waitForSelector('[data-testid="like"]', { timeout: 10000 });
        
        const alreadyLiked = await page.$('[data-testid="unlike"]');
        
        if (alreadyLiked) {
          console.log("  ℹ️  Already liked this tweet");
        } else {
          await page.click('[data-testid="like"]');
          await wait(2000);
          console.log("  ❤️  Liked successfully");
        }
      } catch (err) {
        console.log("  ⚠️  Could not like tweet");
      }

      // ===== GENERATE AI REPLY =====
      const aiReply = await generateAIReply(tweetText || "Interesting post");
      
      // ===== REPLY TO TWEET =====
      try {
        // Click reply button
        await page.waitForSelector('[data-testid="reply"]', { timeout: 10000 });
        await page.click('[data-testid="reply"]');
        await wait(3000);
        console.log("  💬 Reply dialog opened");

        // Wait for text area
        await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
        
        // Type AI-generated reply with human-like delay
        await page.type('[data-testid="tweetTextarea_0"]', aiReply, { delay: 100 });
        await wait(2000);
        console.log(`  ✍️  AI Reply: "${aiReply}"`);

        // Post reply
        await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 5000 });
        await page.click('[data-testid="tweetButton"]');
        await wait(3000);
        console.log("  ✅ Reply posted successfully");
      } catch (err) {
        console.log(`  ⚠️  Could not post reply: ${err.message}`);
      }

      // Close the tab
      await page.close();
      
      count++;
      console.log(`\n📊 Progress: ${count}/${links.length} tweets completed`);

      // Wait before next tweet (except for last one)
      if (i < links.length - 1) {
        const randomDelay = getRandomDelay();
        console.log(`⏳ Waiting ${Math.floor(randomDelay / 1000)} seconds before next tweet...`);
        await wait(randomDelay);
      }

      // ===== COOLDOWN AFTER BATCH =====
      if (count % TWEETS_PER_BATCH === 0 && i < links.length - 1) {
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`⏸️  BATCH COMPLETED: ${TWEETS_PER_BATCH} tweets processed`);
        console.log(`😴 Cooldown period: ${COOLDOWN / 60000} minutes`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        await wait(COOLDOWN);
        console.log("🔥 Cooldown finished! Resuming automation...\n");
      }
    } catch (err) {
      console.error(`  ❌ Error processing tweet: ${err.message}`);
      console.log("  ⏭️  Skipping to next tweet...");
      continue;
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 ===== AUTOMATION COMPLETED =====");
  console.log(`✅ Successfully processed ${count} out of ${links.length} tweets`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  await browser.disconnect();
  process.exit(0);

})();
